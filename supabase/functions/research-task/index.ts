const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Same models the chat uses. No live web search is used here, so we no longer depend on the
// small separate Google Search grounding quota that was causing the 429 errors.
const MODEL_FALLBACK_LIST = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];

function buildPrompt(query: string) {
  return `You are helping with a research task. You cannot browse the web, so answer from your own knowledge. Be clear and well organized.

If the task depends on recent or live information (prices, news, current events, latest versions), say that plainly, give the most recent information you know, and mention that it may be out of date.

TASK: ${query}`;
}

async function callGemini(model: string, query: string, apiKey: string, maxRetries = 2) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(query) }] }],
      }),
    });

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return { text };

    const code = data.error?.code;
    if (code === 503 && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      continue;
    }
    return { error: data.error ?? data };
  }
  return { error: 'Max retries exceeded' };
}

async function researchWithFallback(query: string, apiKey: string) {
  let lastError: unknown;
  for (const model of MODEL_FALLBACK_LIST) {
    const result = await callGemini(model, query, apiKey);
    if (result.text) return { text: result.text, modelUsed: model };
    lastError = result.error;
    console.error(`Model ${model} failed:`, JSON.stringify(result.error));
  }
  return { error: lastError };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing query' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const outcome = await researchWithFallback(query, apiKey);

    if (outcome.error) {
      return new Response(JSON.stringify({ error: outcome.error }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ result: outcome.text, modelUsed: outcome.modelUsed, searchUsed: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
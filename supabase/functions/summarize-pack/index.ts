const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL_FALLBACK_LIST = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];

async function callGeminiModel(model: string, text: string, apiKey: string, maxRetries = 2) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const instruction = `You are condensing study material into a structured knowledge pack for offline exam prep. Given the text below, produce:
1. A concise overview (3-5 sentences).
2. A bulleted list of key facts/concepts.
3. 5-10 likely exam-style questions with brief answers.

Keep it dense and factual — this will be used as reference material for a study AI with no internet access.

TEXT:
${text}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }] }),
    });

    const data = await res.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (resultText) return { text: resultText };

    const code = data.error?.code;
    if (code === 503 && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      continue;
    }
    return { error: data.error ?? data };
  }
  return { error: 'Max retries exceeded' };
}

async function summarizeWithFallback(text: string, apiKey: string) {
  let lastError: unknown;
  for (const model of MODEL_FALLBACK_LIST) {
    const result = await callGeminiModel(model, text, apiKey);
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
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Keeps one huge upload from burning your whole daily quota in a single call.
    const MAX_CHARS = 400_000;
    const trimmedText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const result = await summarizeWithFallback(trimmedText, apiKey);

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ summary: result.text, modelUsed: result.modelUsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
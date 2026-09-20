// Only these websites may call this function from a browser.
// (Add your own domain here later if you get one.)
const ALLOWED_ORIGINS = [
  'https://smrt-ii.vercel.app',
  'https://smrt-ii-git-main-smartalphas.vercel.app',
  'http://localhost:5173', // npm run dev
  'http://localhost:4173', // npm run preview
];

function corsFor(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  return {
    // If the caller's site isn't on the list, the browser gets a mismatched value and blocks it.
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Same models the chat uses. No live web search is used here, so we no longer depend on the
// small separate Google Search grounding quota that was causing the 429 errors.
const MODEL_FALLBACK_LIST = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];

const MAX_QUERY_CHARS = 2_000;

// Asks the database whether this user may make another request in this "bucket".
// Returns 'ok', 'limited' (over the limit), or 'error' (couldn't check).
async function checkLimit(req: Request, bucket: string): Promise<'ok' | 'limited' | 'error'> {
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: req.headers.get('apikey') ?? '',
        Authorization: req.headers.get('Authorization') ?? '',
      },
      body: JSON.stringify({ p_bucket: bucket }),
    });
    if (!res.ok) {
      console.error('Rate limit check failed:', res.status, await res.text().catch(() => ''));
      return 'error';
    }
    return (await res.json()) === true ? 'ok' : 'limited';
  } catch (err) {
    console.error('Rate limit check crashed:', err);
    return 'error';
  }
}

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
  const corsHeaders = corsFor(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return json({ error: 'Missing query' }, 400);
    }
    if (query.length > MAX_QUERY_CHARS) {
      return json({ error: 'That research question is too long.' }, 413);
    }

    const verdict = await checkLimit(req, 'research_day');
    if (verdict === 'limited') {
      return json(
        { error: "You've reached today's limit for research tasks. Try again tomorrow.", code: 'rate_limited' },
        429
      );
    }
    if (verdict === 'error') {
      return json({ error: "Couldn't verify your request limit right now. Try again shortly.", code: 'limit_check_failed' }, 503);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const outcome = await researchWithFallback(query, apiKey);

    if (outcome.error) {
      return json({ error: outcome.error }, 502);
    }

    return json({ result: outcome.text, modelUsed: outcome.modelUsed, searchUsed: false }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
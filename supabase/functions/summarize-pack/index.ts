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

const MODEL_FALLBACK_LIST = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];

// Refuse absurdly large uploads outright. Anything smaller is trimmed to MAX_CHARS below.
const MAX_INPUT_CHARS = 2_000_000;
const MAX_CHARS = 400_000;

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
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return json({ error: 'Missing text' }, 400);
    }
    if (text.length > MAX_INPUT_CHARS) {
      return json({ error: 'That document is too large.' }, 413);
    }

    const verdict = await checkLimit(req, 'summarize_day');
    if (verdict === 'limited') {
      return json(
        { error: "You've reached today's limit for adding knowledge packs. Try again tomorrow.", code: 'rate_limited' },
        429
      );
    }
    if (verdict === 'error') {
      return json({ error: "Couldn't verify your request limit right now. Try again shortly.", code: 'limit_check_failed' }, 503);
    }

    const trimmedText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const result = await summarizeWithFallback(trimmedText, apiKey);

    if (result.error) {
      return json({ error: result.error }, 502);
    }

    return json({ summary: result.text, modelUsed: result.modelUsed }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
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
    'Access-Control-Expose-Headers': 'X-Model-Used',
  };
}

const MODEL_FALLBACK_LIST = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];

// Attached files can make prompts big, but not unlimited.
const MAX_PROMPT_CHARS = 300_000;

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

function createTextExtractorStream() {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) controller.enqueue(encoder.encode(text));
        } catch {
          // Incomplete JSON split across chunks — skip, completes next time through.
        }
      }
    },
  });
}

async function getWorkingStream(prompt: string, apiKey: string) {
  for (const model of MODEL_FALLBACK_LIST) {
    for (let attempt = 0; attempt <= 1; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (res.ok && res.body) {
        return { body: res.body, model };
      }

      const errText = await res.text().catch(() => '');
      console.error(`Model ${model} attempt ${attempt} failed (${res.status}):`, errText);

      if (res.status === 503 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000 * 1));
        continue;
      }
      break;
    }
  }
  return null;
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
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return json({ error: 'Missing prompt' }, 400);
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return json({ error: 'That message is too large.' }, 413);
    }

    // Two checks: a short burst limit, then a daily limit.
    for (const bucket of ['chat_minute', 'chat_day']) {
      const verdict = await checkLimit(req, bucket);
      if (verdict === 'limited') {
        return json(
          {
            error:
              bucket === 'chat_minute'
                ? "You're sending messages too fast. Wait a minute and try again."
                : "You've reached today's message limit. Try again tomorrow.",
            code: 'rate_limited',
          },
          429
        );
      }
      if (verdict === 'error') {
        return json({ error: "Couldn't verify your request limit right now. Try again shortly.", code: 'limit_check_failed' }, 503);
      }
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const result = await getWorkingStream(prompt, apiKey);

    if (!result) {
      return json({ error: 'All models are currently unavailable.' }, 502);
    }

    const textStream = result.body.pipeThrough(createTextExtractorStream());

    return new Response(textStream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Model-Used': result.model,
      },
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
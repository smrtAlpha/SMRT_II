const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'X-Model-Used',
};

// Keep this in sync with whatever models you're currently using — extend freely.
const MODEL_FALLBACK_LIST = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];

// Converts Gemini's SSE format (lines like `data: {...json...}`) into plain text chunks.
function createTextExtractorStream() {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // last line may be incomplete — hold it for the next chunk

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
          // Incomplete JSON split across chunks — skip, it'll complete next time through.
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
        await new Promise((r) => setTimeout(r, 1000));
        continue; // one quick retry on the same model
      }
      break; // move to the next model
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const result = await getWorkingStream(prompt, apiKey);

    if (!result) {
      return new Response(JSON.stringify({ error: 'All models are currently unavailable.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
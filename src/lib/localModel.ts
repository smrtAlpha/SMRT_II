import type * as webllm from '@mlc-ai/web-llm';
import { loadWebLLMModule } from './webllmLoader';

export const LOCAL_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

let engine: webllm.MLCEngineInterface | null = null;
let loadingPromise: Promise<webllm.MLCEngineInterface> | null = null;

export function isLocalModelReady() {
  return engine !== null;
}

export async function loadLocalModel(
  onProgress: (report: webllm.InitProgressReport) => void
): Promise<webllm.MLCEngineInterface> {
  if (engine) return engine;
  if (loadingPromise) return loadingPromise;

  loadingPromise = loadWebLLMModule()
    .then((mod) => mod.CreateMLCEngine(LOCAL_MODEL_ID, { initProgressCallback: onProgress }))
    .then((e) => {
      engine = e;
      return e;
    })
    .catch((err) => {
      // Forget the failed attempt, otherwise every later tap would just get this same failure back
      // until the page is reloaded.
      loadingPromise = null;
      throw err;
    });

  return loadingPromise;
}

export async function generateLocalReply(
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  // Background context (e.g. remembered facts about the user) as a real system message, rather
  // than text stitched into the question — this small on-device model follows a plain question
  // much more reliably than a multi-section prompt with instructions embedded in it.
  systemContext?: string
): Promise<string> {
  if (!engine) throw new Error('Local model not loaded yet');
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  if (systemContext) messages.push({ role: 'system', content: systemContext });
  messages.push(...history, { role: 'user', content: prompt });

  const response = await engine.chat.completions.create({ messages });
  return response.choices[0]?.message?.content ?? '';
}

// Stops the on-device AI mid-answer. The reply written so far is still returned by generateLocalReply.
export function stopLocalGeneration() {
  void engine?.interruptGenerate();
}
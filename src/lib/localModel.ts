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
    });

  return loadingPromise;
}

export async function generateLocalReply(
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<string> {
  if (!engine) throw new Error('Local model not loaded yet');
  const response = await engine.chat.completions.create({
    // Earlier messages first, then the new question.
    messages: [...history, { role: 'user', content: prompt }],
  });
  return response.choices[0]?.message?.content ?? '';
}

// Stops the on-device AI mid-answer. The reply written so far is still returned by generateLocalReply.
export function stopLocalGeneration() {
  void engine?.interruptGenerate();
}
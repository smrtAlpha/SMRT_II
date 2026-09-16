// Kept as its own tiny file on purpose — this is what lets Vite split WebLLM
// into a separate chunk that only downloads when this function is actually called,
// instead of being bundled into the main app.
export function loadWebLLMModule() {
  return import('@mlc-ai/web-llm');
}
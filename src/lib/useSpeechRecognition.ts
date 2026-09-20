import { useCallback, useEffect, useRef, useState } from 'react';

// The browser's built-in speech-to-text. TypeScript doesn't ship types for it yet,
// so this describes just the parts we use.
type ResultLike = { 0: { transcript: string } };
type RecognitionEventLike = { results: ArrayLike<ResultLike> };
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => RecognitionLike;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// The accent the browser listens for. 'en-NG' is Nigerian English.
// If it sounds worse than it should, try 'en-GB' or 'en-US' and compare.
const VOICE_LANGUAGE = 'en-NG';
// Used automatically if the browser doesn't offer VOICE_LANGUAGE.
const FALLBACK_LANGUAGE = 'en-GB';

const OFFLINE_MESSAGE = 'Voice typing needs an internet connection.';

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': "Microphone access is blocked. Allow the microphone in your browser's site settings.",
  'service-not-allowed': "Microphone access is blocked. Allow the microphone in your browser's site settings.",
  'no-speech': "Didn't hear anything. Tap the mic and try again.",
  'audio-capture': 'No microphone found.',
  network: OFFLINE_MESSAGE,
  'language-not-supported': "Voice typing doesn't support your language here.",
};

// Turns speech into text. `onTranscript` receives everything heard so far in the current recording.
export function useSpeechRecognition(onTranscript: (text: string) => void) {
  const supported = getRecognitionConstructor() !== null;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<RecognitionLike | null>(null);

  // Always call the newest onTranscript, without restarting the recording when it changes.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  const startRecognition = useCallback((lang: string) => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition || recognitionRef.current) return;

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = false; // stops by itself after you pause, which suits questions
    recognition.interimResults = true; // words appear while you are still speaking

    recognition.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      onTranscriptRef.current(text.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      if (event.error === 'language-not-supported' && lang !== FALLBACK_LANGUAGE) {
        // This browser doesn't offer that accent: quietly use the closest widely supported one.
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognitionRef.current = null;
        startRecognition(FALLBACK_LANGUAGE);
        return;
      }
      setError(ERROR_MESSAGES[event.error] ?? `Voice typing stopped (${event.error}).`);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError('Could not start voice typing. Try again.');
    }
  }, []);

  const start = useCallback(() => {
    if (recognitionRef.current) return;
    setError('');
    if (!navigator.onLine) {
      setError(OFFLINE_MESSAGE);
      return;
    }
    startRecognition(VOICE_LANGUAGE);
  }, [startRecognition]);

  // Finish up: whatever was heard is still delivered.
  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // Cancel right now, and ignore anything still on its way.
  const abort = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognitionRef.current = null;
    recognition.abort();
    setListening(false);
  }, []);

  // Stop listening if the component goes away.
  useEffect(() => abort, [abort]);

  return { supported, listening, error, start, stop, abort };
}
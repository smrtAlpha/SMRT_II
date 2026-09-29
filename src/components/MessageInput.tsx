import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Paperclip, AudioLines, Mic, ArrowUp, Square, FileText, Loader2, X } from 'lucide-react';
import KnowledgePackPicker from './KnowledgePackPicker';
import { useSpeechRecognition } from '../lib/useSpeechRecognition';

type Props = {
  onSend: (text: string) => void;
  // True while SMRT is writing an answer: you can keep typing, and Send turns into Stop.
  isGenerating: boolean;
  onStop: () => void;
  userId: string;
  selectedPackId: string;
  onSelectPack: (id: string) => void;
  // Files attached but not sent yet
  attachments: { id: string; name: string }[];
  readingFile: boolean;
  attachError: string;
  onAttach: (file: File) => void;
  onRemoveAttachment: (id: string) => void;
};

// Resting state is glassy (translucent + blurred) with a real slate border — a white border on a
// pale page has no contrast, so the edge has to come from an actual color, not just transparency.
// Hover goes fully opaque with a darker border and a shadow, both clear regardless of what's behind it.
const PILL_BUTTON =
  'flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200/80 bg-white/50 px-3 text-sm font-medium text-slate-700 backdrop-blur-sm transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm sm:px-4';

export default function MessageInput({
  onSend,
  isGenerating,
  onStop,
  userId,
  selectedPackId,
  onSelectPack,
  attachments,
  readingFile,
  attachError,
  onAttach,
  onRemoveAttachment,
}: Props) {
  const [value, setValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice typing: what you say is added after whatever was already in the box.
  const textBeforeVoice = useRef('');
  const speech = useSpeechRecognition((transcript) => {
    const before = textBeforeVoice.current.trimEnd();
    setValue(before ? `${before} ${transcript}` : transcript);
  });

  function toggleVoice() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    textBeforeVoice.current = value;
    speech.start();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isGenerating || !value.trim()) return;
    speech.abort(); // stop listening, and ignore any words still on their way
    onSend(value.trim());
    setValue('');
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onAttach(file);
    e.target.value = ''; // lets you pick the same file again later
  }

  const hasChips = attachments.length > 0 || readingFile;

  return (
    <form
      onSubmit={handleSubmit}
      // Glass panel: translucent + blurred fill, a real slate border (not white-on-white, which
      // has no contrast against a pale page) plus a bright inset top edge for the glass highlight,
      // and a soft blue-tinted drop shadow with real, visible weight. Focus deepens all three.
      className="mx-auto mt-2 w-full max-w-4xl rounded-2xl border border-slate-200/80 bg-white/55 p-3 backdrop-blur-2xl transition-all duration-200 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-10px_rgba(30,64,175,0.25)] focus-within:border-blue-300 focus-within:bg-white/85 focus-within:ring-2 focus-within:ring-blue-100 focus-within:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.9),0_16px_40px_-12px_rgba(30,64,175,0.35)] dark:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.07),0_10px_30px_-10px_rgba(0,0,0,0.6)] dark:focus-within:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.1),0_16px_40px_-12px_rgba(37,99,235,0.4)]"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        onChange={handleFileChosen}
        className="hidden"
      />

      {/* Files waiting to be sent with your next message */}
      {hasChips && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <span
              key={file.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-blue-50 py-1 pr-1 pl-2.5 text-xs text-blue-800"
            >
              <FileText size={14} className="shrink-0" />
              <span className="max-w-[12rem] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(file.id)}
                aria-label={`Remove ${file.name}`}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-blue-100"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {readingFile && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              <Loader2 size={14} className="animate-spin" />
              Reading file…
            </span>
          )}
        </div>
      )}

      {attachError && <p className="mb-2 text-xs text-red-600">{attachError}</p>}
      {speech.error && <p className="mb-2 text-xs text-red-600">{speech.error}</p>}

      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
        {/* Row 1: paperclip icon + text box */}
        <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
          <button
            type="button"
            onClick={openFilePicker}
            aria-label="Attach a file"
            // A dark tint at low opacity reads clearly regardless of what's behind it — more
            // reliable on a glass/translucent parent than a light grey fill would be.
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-900/8 hover:text-slate-700"
          >
            <Paperclip size={18} />
          </button>
          <input
            value={value}
            onChange={(e) => {
              if (speech.listening) speech.abort(); // typing by hand ends voice typing
              setValue(e.target.value);
            }}
            placeholder={
              speech.listening
                ? 'Listening… speak now'
                : attachments.length > 0
                  ? 'Ask about your attached file...'
                  : 'Ask SMRT anything...'
            }
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {/* Row 2 (left): choose which knowledge pack SMRT uses */}
        <KnowledgePackPicker userId={userId} selectedPackId={selectedPackId} onSelect={onSelectPack} />

        {/* Right side: Attach, Voice and Send */}
        <div className="flex items-center gap-2 sm:col-start-2 sm:row-span-2 sm:row-start-1">
          <button
            type="button"
            onClick={openFilePicker}
            title="Attach a PDF, Word, TXT or MD file to this chat"
            aria-label="Attach"
            className={PILL_BUTTON}
          >
            <Paperclip size={16} />
            <span className="hidden sm:inline">Attach</span>
          </button>
          <button
            type="button"
            onClick={toggleVoice}
            disabled={!speech.supported}
            aria-label={speech.listening ? 'Stop voice typing' : 'Voice typing'}
            aria-pressed={speech.listening}
            title={
              !speech.supported
                ? "Voice typing isn't supported in this browser"
                : speech.listening
                  ? 'Tap to finish'
                  : 'Speak your question (your browser sends the audio to its speech service)'
            }
            className={
              speech.listening
                ? 'flex h-10 items-center justify-center gap-2 rounded-full border border-red-300 bg-red-50 px-3 text-sm font-medium text-red-600 hover:bg-red-100 sm:px-4'
                : `${PILL_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`
            }
          >
            {speech.listening ? <Mic size={16} className="animate-pulse" /> : <AudioLines size={16} />}
            <span className="hidden sm:inline">{speech.listening ? 'Listening…' : 'Voice'}</span>
          </button>
          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-slate-800 px-3 text-sm font-medium text-white transition-transform hover:bg-slate-900 active:scale-95 sm:px-5"
            >
              <Square size={14} className="fill-current" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={readingFile}
              aria-label="Send"
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-blue-700 px-3 text-sm font-medium text-white transition-transform hover:bg-blue-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
            >
              <ArrowUp size={16} />
              <span className="hidden sm:inline">Send</span>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
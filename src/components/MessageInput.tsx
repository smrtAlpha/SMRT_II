import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Paperclip, AudioLines, ArrowUp, Square, FileText, Loader2, X } from 'lucide-react';
import KnowledgePackPicker from './KnowledgePackPicker';

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

const PILL_BUTTON =
  'flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:px-4';

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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isGenerating || !value.trim()) return;
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
      className="mx-auto mt-2 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-3 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"
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

      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
        {/* Row 1: paperclip icon + text box */}
        <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
          <button
            type="button"
            onClick={openFilePicker}
            aria-label="Attach a file"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Paperclip size={18} />
          </button>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={attachments.length > 0 ? 'Ask about your attached file...' : 'Ask SMRT anything...'}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {/* Row 2 (left): choose which knowledge pack SMRT uses */}
        <KnowledgePackPicker userId={userId} selectedPackId={selectedPackId} onSelect={onSelectPack} />

        {/* Right side: Attach (real), Voice (placeholder) and Send (real) */}
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
          <button type="button" title="Voice input — coming soon" aria-label="Voice" className={PILL_BUTTON}>
            <AudioLines size={16} />
            <span className="hidden sm:inline">Voice</span>
          </button>
          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-slate-800 px-3 text-sm font-medium text-white hover:bg-slate-900 sm:px-5"
            >
              <Square size={14} className="fill-current" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={readingFile}
              aria-label="Send"
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-blue-700 px-3 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
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
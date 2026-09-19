import { useState } from 'react';
import type { FormEvent } from 'react';
import { Paperclip, FolderOpen, ChevronDown, AudioLines, ArrowUp } from 'lucide-react';

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

const PILL_BUTTON =
  'flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:px-4';

export default function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSend(value.trim());
    setValue('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-2 grid w-full max-w-4xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
    >
      {/* Row 1: paperclip icon + text box */}
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <Paperclip size={18} className="shrink-0 text-slate-400" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask SMRT anything..."
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
        />
      </div>

      {/* Row 2 (left): knowledge pack picker — placeholder */}
      <button
        type="button"
        title="Choose a knowledge pack — coming soon"
        className="col-start-1 flex h-10 min-w-0 items-center gap-2 justify-self-start rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <FolderOpen size={16} className="shrink-0 text-blue-600" />
        <span className="truncate">Select Knowledge Pack</span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </button>

      {/* Right side: Attach, Voice (placeholders) and Send (real) */}
      <div className="flex items-center gap-2 sm:col-start-2 sm:row-span-2 sm:row-start-1">
        <button type="button" title="Attach a file — coming soon" aria-label="Attach" className={PILL_BUTTON}>
          <Paperclip size={16} />
          <span className="hidden sm:inline">Attach</span>
        </button>
        <button type="button" title="Voice input — coming soon" aria-label="Voice" className={PILL_BUTTON}>
          <AudioLines size={16} />
          <span className="hidden sm:inline">Voice</span>
        </button>
        <button
          type="submit"
          disabled={disabled}
          aria-label="Send"
          className="flex h-10 items-center justify-center gap-2 rounded-full bg-blue-700 px-3 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
        >
          <ArrowUp size={16} />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </form>
  );
}
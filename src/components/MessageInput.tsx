import { useState } from 'react';
import type { FormEvent } from 'react';
import { Send } from 'lucide-react';

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

export default function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSend(value.trim());
    setValue('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 pt-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask SMRT anything..."
        disabled={disabled}
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled}
        className="flex items-center justify-center rounded-lg bg-blue-600 px-4 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send size={16} />
      </button>
    </form>
  );
}
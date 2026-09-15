import { useState } from 'react';
import type { FormEvent } from 'react';

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
    <form className="message-input" onSubmit={handleSubmit}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask SMRT anything..."
        disabled={disabled}
      />
      <button type="submit" disabled={disabled}>Send</button>
    </form>
  );
}
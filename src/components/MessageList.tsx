import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../types';

type Props = {
  messages: ChatMessage[];
};

export default function MessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-2">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`max-w-[80%] animate-[fadeInUp_0.25s_ease-out] rounded-xl px-3 py-2 ${
            msg.role === 'user' ? 'self-end bg-blue-600 text-white' : 'self-start bg-slate-200 text-slate-900'
          }`}
        >
          <span className="block text-xs opacity-70">{msg.role === 'user' ? 'You' : 'SMRT'}</span>
          {msg.role === 'assistant' && msg.content === '' ? (
            <div className="flex gap-1 py-1">
              <span className="h-1.5 w-1.5 animate-[bounce-dot_1.2s_ease-in-out_infinite] rounded-full bg-slate-500" />
              <span className="h-1.5 w-1.5 animate-[bounce-dot_1.2s_ease-in-out_infinite] rounded-full bg-slate-500" style={{ animationDelay: '0.15s' }} />
              <span className="h-1.5 w-1.5 animate-[bounce-dot_1.2s_ease-in-out_infinite] rounded-full bg-slate-500" style={{ animationDelay: '0.3s' }} />
            </div>
          ) : (
            <div className="text-sm [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
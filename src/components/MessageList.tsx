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
    <div className="message-list">
      {messages.map((msg) => (
        <div key={msg.id} className={`message ${msg.role}`}>
          <span className="role-label">{msg.role === 'user' ? 'You' : 'SMRT'}</span>
          {msg.role === 'assistant' && msg.content === '' ? (
            <div className="typing-dots">
              <span></span><span></span><span></span>
            </div>
          ) : (
            <div className="message-content">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
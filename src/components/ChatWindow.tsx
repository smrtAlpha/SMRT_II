import { useState } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import type { ChatMessage } from '../types';

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  function handleSend(text: string) {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    simulateStreamingReply(assistantMsg.id, `This is a placeholder reply to: "${text}". Phase 2 swaps this out for a real Gemini response.`);
  }

  // TEMPORARY — fakes a token-by-token reply so we can build and test the UI now.
  // Phase 2 deletes this function and replaces it with the real Gemini streaming call.
  function simulateStreamingReply(messageId: string, fullText: string) {
    setIsStreaming(true);
    const words = fullText.split(' ');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      const partial = words.slice(0, i).join(' ');
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: partial } : m))
      );
      if (i >= words.length) {
        clearInterval(interval);
        setIsStreaming(false);
      }
    }, 60);
  }

  return (
    <div className="chat-window">
      <MessageList messages={messages} />
      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
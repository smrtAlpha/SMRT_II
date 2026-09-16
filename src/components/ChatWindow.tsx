import { useState } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import type { ChatMessage } from '../types';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { searchLocalHistory } from '../lib/localSearch';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-chat`;

type Props = {
  userId: string;
};

export default function ChatWindow({ userId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isOnline = useOnlineStatus();

  async function respondFromCache(query: string, assistantId: string) {
    const match = await searchLocalHistory(userId, query);
    const content = match
      ? `*(from your offline history — asked ${new Date(match.record.timestamp).toLocaleDateString()})*\n\n${match.record.answer}`
      : "You're offline and I don't have a similar cached answer for this yet. I'll be able to help once you're back online.";
    setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content } : m)));
  }

  async function handleSend(text: string) {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setIsLoading(true);

    // Fast path: browser already knows there's no connection, skip straight to local search.
    if (!isOnline) {
      await respondFromCache(text, assistantId);
      setIsLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ prompt: text }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        );
      }

      await db.qaHistory.add({
        id: assistantId,
        userId,
        question: text,
        answer: accumulated,
        timestamp: Date.now(),
      });
    } catch (err) {
      // A real fetch-level failure (not an HTTP error status) means we're actually offline,
      // even if navigator.onLine hadn't caught up to that yet.
      if (err instanceof TypeError) {
        await respondFromCache(text, assistantId);
      } else {
        console.error('Gemini call failed:', err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Something went wrong reaching SMRT. Please try again.' }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="chat-window">
      <MessageList messages={messages} />
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
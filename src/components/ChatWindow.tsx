// import { useState } from 'react';
import { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import type { ChatMessage } from '../types';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { searchLocalHistory } from '../lib/localSearch';
import { useLocalModel } from '../lib/useLocalModel';
import { generateLocalReply } from '../lib/localModel';


const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-chat`;

type Props = {
  userId: string;
};

export default function ChatWindow({ userId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isOnline = useOnlineStatus();
  const localModel = useLocalModel();

  const [showReadyBanner, setShowReadyBanner] = useState(false);
  const wasReady = useRef(false);

  useEffect(() => {
    if (localModel.isReady && !wasReady.current) {
      wasReady.current = true;
      setShowReadyBanner(true);
      const timer = setTimeout(() => setShowReadyBanner(false), 5000);
      return () => clearTimeout(timer);
    }
    
}, [localModel.isReady]);



  async function respondOffline(query: string, assistantId: string) {
    const match = await searchLocalHistory(userId, query);
    if (match) {
      const content = `*(from your offline history — asked ${new Date(match.record.timestamp).toLocaleDateString()})*\n\n${match.record.answer}`;
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content } : m)));
      return;
    }

    if (localModel.isReady) {
      try {
        const reply = await generateLocalReply(query);
        const content = `*(generated offline by your on-device AI)*\n\n${reply}`;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content } : m)));
      } catch (err) {
        console.error('Local model generation failed:', err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "Your offline AI hit an error. Try again." } : m
          )
        );
      }
      return;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: "No cached answer for this, and your offline AI isn't downloaded yet — see the banner below." }
          : m
      )
    );
  }

  async function handleSend(text: string) {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setIsLoading(true);

    if (!isOnline) {
      await respondOffline(text, assistantId);
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

      await db.qaHistory.add({ id: assistantId, userId, question: text, answer: accumulated, timestamp: Date.now() });
    } catch (err) {
      if (err instanceof TypeError) {
        await respondOffline(text, assistantId);
      } else {
        console.error('Gemini call failed:', err);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: 'Something went wrong reaching SMRT. Please try again.' } : m))
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="chat-window">
      <MessageList messages={messages} />

      {showReadyBanner && (
        <div className="local-model-banner ready">✅ Offline AI downloaded and ready to use.</div>
      )}
      
      {!localModel.isReady && (
        <div className="local-model-banner">
          {localModel.isDownloading ? (
            <span>{localModel.progressText || 'Downloading offline AI...'}</span>
          ) : (
            <button onClick={localModel.download} className="download-button">
              Download offline AI (~880MB, do this on Wi-Fi)
            </button>
          )}
        </div>
      )}
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
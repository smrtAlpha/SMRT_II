import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2 } from 'lucide-react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import type { ChatMessage } from '../types';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import type { KnowledgePack, Message } from '../lib/db';
import { createConversation } from '../lib/conversations';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { searchLocalHistory } from '../lib/localSearch';
import { findRelevantKnowledgePack } from '../lib/knowledgePackSearch';
import type { useLocalModel } from '../lib/useLocalModel';
import { generateLocalReply } from '../lib/localModel';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-chat`;

type Props = {
  userId: string;
  conversationId: string | null;
  onNewConversation: (id: string) => void;
  // Offline-AI state now lives in App so the header badge and this chat share it.
  localModel: ReturnType<typeof useLocalModel>;
};

function buildAugmentedPrompt(query: string, pack: KnowledgePack | null): string {
  if (!pack) return query;
  return `Use the following reference material if it's relevant to the question. If it isn't relevant, just answer normally from your own knowledge.

REFERENCE MATERIAL (${pack.subject}, from "${pack.sourceFileName}"):
${pack.summary}

QUESTION: ${query}`;
}

export default function ChatWindow({ userId, conversationId, onNewConversation, localModel }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [transientMessages, setTransientMessages] = useState<ChatMessage[]>([]);
  const isOnline = useOnlineStatus();

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

  useEffect(() => {
    setTransientMessages([]);
  }, [conversationId]);

  const persistedMessages = useLiveQuery(
    (): Promise<Message[]> =>
      conversationId
        ? db.messages.where('conversationId').equals(conversationId).sortBy('timestamp')
        : Promise.resolve([]),
    [conversationId]
  );

  const messages: ChatMessage[] = [
    ...(persistedMessages ?? []).map((m) => ({ id: m.id, role: m.role, content: m.content })),
    ...transientMessages,
  ];

  async function persistExchange(convId: string, question: string, answerContent: string, assistantId: string) {
    await db.messages.add({
      id: crypto.randomUUID(),
      conversationId: convId,
      userId,
      role: 'user',
      content: question,
      timestamp: Date.now(),
    });
    await db.messages.add({
      id: assistantId,
      conversationId: convId,
      userId,
      role: 'assistant',
      content: answerContent,
      timestamp: Date.now(),
    });
    await db.conversations.update(convId, { updatedAt: Date.now() });
  }

  async function respondOffline(userMsg: ChatMessage, assistantId: string, convId: string) {
    const match = await searchLocalHistory(userId, userMsg.content);
    let content: string;

    if (match) {
      content = `*(from your offline history — asked ${new Date(match.record.timestamp).toLocaleDateString()})*\n\n${match.record.answer}`;
    } else if (localModel.isReady) {
      try {
        const pack = await findRelevantKnowledgePack(userId, userMsg.content);
        const augmentedPrompt = buildAugmentedPrompt(userMsg.content, pack);
        const reply = await generateLocalReply(augmentedPrompt);
        const label = pack
          ? `*(generated offline by your on-device AI, using your ${pack.subject} knowledge pack)*`
          : `*(generated offline by your on-device AI)*`;
        content = `${label}\n\n${reply}`;
      } catch (err) {
        console.error('Local model generation failed:', err);
        content = 'Your offline AI hit an error. Try again.';
      }
    } else {
      content =
        "No cached answer for this, and your offline AI isn't downloaded yet. Tap “Get Offline AI” at the top when you're back online (about 880 MB, best on Wi-Fi).";
    }

    await persistExchange(convId, userMsg.content, content, assistantId);
    setTransientMessages([]);
  }

  async function handleSend(text: string) {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const assistantId = crypto.randomUUID();
    setTransientMessages([userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setIsLoading(true);

    const convId: string = conversationId ?? (await createConversation(userId, text));
    if (!conversationId) {
      onNewConversation(convId);
    }

    if (!isOnline) {
      await respondOffline(userMsg, assistantId, convId);
      setIsLoading(false);
      return;
    }

    try {
      const pack = await findRelevantKnowledgePack(userId, text);
      const augmentedPrompt = buildAugmentedPrompt(text, pack);

      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ prompt: augmentedPrompt }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = pack ? `*(using your ${pack.subject} knowledge pack)*\n\n` : '';

      setTransientMessages([userMsg, { id: assistantId, role: 'assistant', content: accumulated }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setTransientMessages([userMsg, { id: assistantId, role: 'assistant', content: accumulated }]);
      }

      await persistExchange(convId, text, accumulated, assistantId);
      await db.qaHistory.add({ id: crypto.randomUUID(), userId, question: text, answer: accumulated, timestamp: Date.now() });
      setTransientMessages([]);
    } catch (err) {
      if (err instanceof TypeError) {
        await respondOffline(userMsg, assistantId, convId);
      } else {
        console.error('Gemini call failed:', err);
        await persistExchange(convId, text, 'Something went wrong reaching SMRT. Please try again.', assistantId);
        setTransientMessages([]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList messages={messages} />
      {showReadyBanner && (
        <div className="flex items-center justify-center gap-1.5 py-1 text-sm font-medium text-green-700">
          <CheckCircle2 size={14} />
          Offline AI downloaded and ready to use.
        </div>
      )}
      {/* Download progress (or a failure message) — the download button itself is now the header badge. */}
      {!localModel.isReady && localModel.progressText && (
        <p className="py-1 text-center text-sm text-slate-500">{localModel.progressText}</p>
      )}
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
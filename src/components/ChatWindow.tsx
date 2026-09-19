import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2 } from 'lucide-react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import type { ChatMessage } from '../types';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import type { Attachment, KnowledgePack, Message } from '../lib/db';
import { createConversation } from '../lib/conversations';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { searchLocalHistory } from '../lib/localSearch';
import { findRelevantKnowledgePack } from '../lib/knowledgePackSearch';
import type { useLocalModel } from '../lib/useLocalModel';
import { generateLocalReply } from '../lib/localModel';
import { NO_PACK, AUTO_PACK } from '../lib/packChoice';
import { extractTextFromFile } from '../lib/extractText';
import {
  MAX_FILE_BYTES,
  ONLINE_ATTACHMENT_BUDGET,
  OFFLINE_ATTACHMENT_BUDGET,
  saveAttachments,
  getConversationAttachments,
  buildAttachmentContext,
} from '../lib/attachments';
import type { PendingFile } from '../lib/attachments';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-chat`;

type Props = {
  userId: string;
  conversationId: string | null;
  onNewConversation: (id: string) => void;
  // Offline-AI state now lives in App so the header badge and this chat share it.
  localModel: ReturnType<typeof useLocalModel>;
};

function buildAugmentedPrompt(query: string, pack: KnowledgePack | null, attachmentContext: string): string {
  if (!pack && !attachmentContext) return query;

  const intro = attachmentContext
    ? `The user attached file(s) to this chat, shown below. Decide whether the question can be answered from them.
Begin your reply with exactly one of these two tags, alone on the first line, before anything else:
[[FROM_FILE]] - if the attached file(s) contain the answer. Then answer using them.
[[OUTSIDE]] - if they do NOT contain the answer (for example, the question is unrelated to the file). Then answer from your own general knowledge.
Never mention the tag in your answer. Put a blank line after the tag, then your answer.`
    : "Use the following reference material if it's relevant to the question. If it isn't relevant, just answer normally from your own knowledge.";

  const parts = [intro];
  if (attachmentContext) parts.push(attachmentContext);
  if (pack) parts.push(`REFERENCE MATERIAL (${pack.subject}, from "${pack.sourceFileName}"):\n${pack.summary}`);
  parts.push(`QUESTION: ${query}`);
  return parts.join('\n\n');
}

export default function ChatWindow({ userId, conversationId, onNewConversation, localModel }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  // Which knowledge pack the user picked: NO_PACK (default), AUTO_PACK (best match), or a pack id.
  const [selectedPackId, setSelectedPackId] = useState<string>(NO_PACK);
  const [transientMessages, setTransientMessages] = useState<ChatMessage[]>([]);
  // Files attached to the message being written (not sent yet).
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [readingFile, setReadingFile] = useState(false);
  const [attachError, setAttachError] = useState('');
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

  // Clear the in-progress messages when the user switches chats, but NOT when the message
  // being sent just created the chat (that would wipe it and bring the welcome screen back).
  const skipNextReset = useRef(false);
  useEffect(() => {
    if (skipNextReset.current) {
      skipNextReset.current = false;
      return;
    }
    setTransientMessages([]);
    setPendingFiles([]);
    setAttachError('');
  }, [conversationId]);

  const persistedMessages = useLiveQuery(
    (): Promise<Message[]> =>
      conversationId
        ? db.messages.where('conversationId').equals(conversationId).sortBy('timestamp')
        : Promise.resolve([]),
    [conversationId]
  );

  const messages: ChatMessage[] = [
    ...(persistedMessages ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      attachments: m.attachmentNames,
    })),
    ...transientMessages,
  ];

  async function persistExchange(
    convId: string,
    question: string,
    answerContent: string,
    assistantId: string,
    attachmentNames: string[] = []
  ) {
    await db.messages.add({
      id: crypto.randomUUID(),
      conversationId: convId,
      userId,
      role: 'user',
      content: question,
      timestamp: Date.now(),
      attachmentNames: attachmentNames.length > 0 ? attachmentNames : undefined,
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

  // Read the chosen file and hold it until the message is sent.
  async function handleAttach(file: File) {
    setAttachError('');
    if (file.size > MAX_FILE_BYTES) {
      setAttachError('That file is over 15 MB. Try a smaller one.');
      return;
    }
    setReadingFile(true);
    try {
      const text = (await extractTextFromFile(file)).trim();
      if (!text) {
        setAttachError("Couldn't find any text in that file. Scanned PDFs aren't supported yet.");
        return;
      }
      setPendingFiles((prev) => [...prev, { id: crypto.randomUUID(), name: file.name, text }]);
    } catch (err) {
      console.error('Reading attached file failed:', err);
      setAttachError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setReadingFile(false);
    }
  }

  function handleRemoveAttachment(id: string) {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  }

  // Decide which knowledge pack (if any) to use for this question.
  async function resolvePack(query: string): Promise<KnowledgePack | null> {
    if (selectedPackId === NO_PACK) return null;
    if (selectedPackId === AUTO_PACK) return findRelevantKnowledgePack(userId, query);
    // A specific pack. If it was deleted, use no pack.
    return (await db.knowledgePacks.get(selectedPackId)) ?? null;
  }

  async function respondOffline(
    userMsg: ChatMessage,
    assistantId: string,
    convId: string,
    attachments: Attachment[]
  ) {
    // Saved answers were written without any attached file, so don't reuse them when a file is attached.
    const match = attachments.length > 0 ? null : await searchLocalHistory(userId, userMsg.content);
    let content: string;

    if (match) {
      content = `*(from your offline history — asked ${new Date(match.record.timestamp).toLocaleDateString()})*\n\n${match.record.answer}`;
    } else if (localModel.isReady) {
      try {
        const pack = await resolvePack(userMsg.content);
        const attachmentContext = buildAttachmentContext(attachments, userMsg.content, OFFLINE_ATTACHMENT_BUDGET);
        const augmentedPrompt = buildAugmentedPrompt(userMsg.content, pack, attachmentContext);
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

    await persistExchange(convId, userMsg.content, content, assistantId, userMsg.attachments);
    setTransientMessages([]);
  }

  async function handleSend(text: string) {
    // Show the files attached to this message on the message itself.
    const attachedNames = pendingFiles.map((f) => f.name);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      attachments: attachedNames.length > 0 ? attachedNames : undefined,
    };
    const assistantId = crypto.randomUUID();
    setTransientMessages([userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setIsLoading(true);

    const convId: string = conversationId ?? (await createConversation(userId, text));
    if (!conversationId) {
      skipNextReset.current = true;
      onNewConversation(convId);
    }

    // Save any files attached to this message, then load every file attached to this chat so far.
    if (pendingFiles.length > 0) {
      await saveAttachments(userId, convId, pendingFiles);
      setPendingFiles([]);
    }
    const attachments = await getConversationAttachments(convId);

    if (!isOnline) {
      await respondOffline(userMsg, assistantId, convId, attachments);
      setIsLoading(false);
      return;
    }

    try {
      const pack = await resolvePack(text);
      const attachmentContext = buildAttachmentContext(attachments, text, ONLINE_ATTACHMENT_BUDGET);
      const augmentedPrompt = buildAugmentedPrompt(text, pack, attachmentContext);

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

      await persistExchange(convId, text, accumulated, assistantId, userMsg.attachments);
      // Answers based on an attached file only make sense for that chat, so don't save them for reuse.
      if (attachments.length === 0) {
        await db.qaHistory.add({ id: crypto.randomUUID(), userId, question: text, answer: accumulated, timestamp: Date.now() });
      }
      setTransientMessages([]);
    } catch (err) {
      if (err instanceof TypeError) {
        await respondOffline(userMsg, assistantId, convId, attachments);
      } else {
        console.error('Gemini call failed:', err);
        await persistExchange(convId, text, 'Something went wrong reaching SMRT. Please try again.', assistantId, userMsg.attachments);
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
      <MessageInput
        onSend={handleSend}
        disabled={isLoading}
        userId={userId}
        selectedPackId={selectedPackId}
        onSelectPack={setSelectedPackId}
        attachments={pendingFiles.map((f) => ({ id: f.id, name: f.name }))}
        readingFile={readingFile}
        attachError={attachError}
        onAttach={handleAttach}
        onRemoveAttachment={handleRemoveAttachment}
      />
    </div>
  );
}
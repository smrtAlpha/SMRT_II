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
import { generateLocalReply, stopLocalGeneration } from '../lib/localModel';
import { NO_PACK, AUTO_PACK } from '../lib/packChoice';
import { extractTextFromFile } from '../lib/extractText';
import { splitLabels } from '../lib/messageLabels';
import { buildHistory, lastQuestionIn, ONLINE_HISTORY, OFFLINE_HISTORY } from '../lib/chatHistory';
import type { HistoryTurn } from '../lib/chatHistory';
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

// Shown as the answer when you press Stop before SMRT has written anything.
const STOPPED_TEXT = 'Stopped before SMRT answered.';

type Props = {
  userId: string;
  conversationId: string | null;
  onNewConversation: (id: string) => void;
  // Offline-AI state lives in App so the header badge and this chat share it.
  localModel: ReturnType<typeof useLocalModel>;
};

// One request for an answer. A retry has no userMsg, because the question is already saved.
type AnswerJob = {
  convId: string;
  question: string;
  userMsg: ChatMessage | null;
  assistantId: string;
};

type AnswerResult = {
  content: string;
  // Whether the answer may be saved in the offline cache for reuse.
  cache: boolean;
  // True when this is really an error or a stopped answer, so it is never used as chat memory.
  failed?: boolean;
};

function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError';
}

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

  // For the Stop button
  const abortRef = useRef<AbortController | null>(null);
  const localGeneratingRef = useRef(false);
  const stopRequestedRef = useRef(false);

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

  // Stops whatever answer is being written (online or on-device).
  function stopGenerating() {
    stopRequestedRef.current = true;
    abortRef.current?.abort();
    if (localGeneratingRef.current) stopLocalGeneration();
  }

  // When the user switches chats: stop any answer in progress and clear the in-progress messages.
  // (Not when the message being sent just created the chat: that would wipe it and bring the welcome screen back.)
  const skipNextReset = useRef(false);
  useEffect(() => {
    if (skipNextReset.current) {
      skipNextReset.current = false;
      return;
    }
    stopGenerating();
    setTransientMessages([]);
    setPendingFiles([]);
    setAttachError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const persistedMessages = useLiveQuery(
    (): Promise<Message[]> =>
      conversationId
        ? db.messages.where('conversationId').equals(conversationId).sortBy('timestamp')
        : Promise.resolve([]),
    [conversationId]
  );

  // Saved messages, plus the in-progress ones. A message that has just been saved is skipped in the
  // in-progress list, so it never shows twice for a split second.
  const savedList = persistedMessages ?? [];
  const savedIds = new Set(savedList.map((m) => m.id));
  const messages: ChatMessage[] = [
    ...savedList.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      attachments: m.attachmentNames,
    })),
    ...transientMessages.filter((m) => !savedIds.has(m.id)),
  ];

  // Saves the answer (and, for a normal send, the question too).
  // Returns false if the chat was deleted while the answer was being written (nothing is saved then).
  async function saveAnswer(job: AnswerJob, content: string, failed = false): Promise<boolean> {
    if (!(await db.conversations.get(job.convId))) return false;
    const now = Date.now();
    if (job.userMsg) {
      await db.messages.add({
        id: job.userMsg.id,
        conversationId: job.convId,
        userId,
        role: 'user',
        content: job.question,
        timestamp: now,
        attachmentNames: job.userMsg.attachments,
      });
    }
    await db.messages.add({
      id: job.assistantId,
      conversationId: job.convId,
      userId,
      role: 'assistant',
      content,
      timestamp: now + 1,
      failed: failed || undefined,
    });
    await db.conversations.update(job.convId, { updatedAt: Date.now() });
    return true;
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

  async function answerOffline(
    job: AnswerJob,
    attachments: Attachment[],
    history: HistoryTurn[]
  ): Promise<AnswerResult> {
    // Saved answers were written without any attached file or earlier messages, so don't reuse them then.
    const match =
      attachments.length > 0 || history.length > 0 ? null : await searchLocalHistory(userId, job.question);

    if (match) {
      return {
        content: `*(from your offline history — asked ${new Date(match.record.timestamp).toLocaleDateString()})*\n\n${match.record.answer}`,
        cache: false,
      };
    }

    if (!localModel.isReady) {
      return {
        content:
          "No cached answer for this, and your offline AI isn't downloaded yet. Tap “Get Offline AI” at the top when you're back online (about 880 MB, best on Wi-Fi).",
        cache: false,
        failed: true,
      };
    }

    try {
      const pack = await resolvePack(job.question);
      // A follow-up like "explain more" has few keywords, so the last question also helps pick the right parts of a file.
      const relevanceQuery = `${job.question} ${lastQuestionIn(history)}`;
      const attachmentContext = buildAttachmentContext(attachments, relevanceQuery, OFFLINE_ATTACHMENT_BUDGET);
      const augmentedPrompt = buildAugmentedPrompt(job.question, pack, attachmentContext);

      localGeneratingRef.current = true;
      let reply: string;
      try {
        reply = await generateLocalReply(augmentedPrompt, history);
      } finally {
        localGeneratingRef.current = false;
      }

      if (!reply.trim()) {
        return {
          content: stopRequestedRef.current ? STOPPED_TEXT : 'Your offline AI hit an error. Try again.',
          cache: false,
          failed: true,
        };
      }
      const label = pack
        ? `*(generated offline by your on-device AI, using your ${pack.subject} knowledge pack)*`
        : `*(generated offline by your on-device AI)*`;
      return { content: `${label}\n\n${reply}`, cache: false };
    } catch (err) {
      console.error('Local model generation failed:', err);
      return { content: 'Your offline AI hit an error. Try again.', cache: false, failed: true };
    }
  }

  async function answerOnline(
    job: AnswerJob,
    attachments: Attachment[],
    history: HistoryTurn[],
    signal: AbortSignal,
    onProgress: (text: string) => void
  ): Promise<AnswerResult> {
    const pack = await resolvePack(job.question);
    const relevanceQuery = `${job.question} ${lastQuestionIn(history)}`;
    const attachmentContext = buildAttachmentContext(attachments, relevanceQuery, ONLINE_ATTACHMENT_BUDGET);
    const augmentedPrompt = buildAugmentedPrompt(job.question, pack, attachmentContext);

    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      // `history` is the chat so far, so the AI understands follow-up questions.
      body: JSON.stringify({ prompt: augmentedPrompt, history: history.length > 0 ? history : undefined }),
      signal,
    });

    if (!res.ok || !res.body) {
      // For these, the server sends a plain-language reason (too fast, daily limit, too large...).
      if (res.status === 413 || res.status === 429 || res.status === 503) {
        const data = await res.json().catch(() => null);
        if (data && typeof data.error === 'string') return { content: data.error, cache: false, failed: true };
      }
      throw new Error(`Request failed with status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = pack ? `*(using your ${pack.subject} knowledge pack)*\n\n` : '';
    onProgress(accumulated);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      onProgress(accumulated);
    }

    // Answers that depend on an attached file or on earlier messages only make sense inside that chat,
    // so they are not saved for reuse.
    return { content: accumulated, cache: attachments.length === 0 && history.length === 0 };
  }

  // Produces and saves one answer. Used for both a normal send and a retry.
  async function runAnswer(job: AnswerJob) {
    setIsLoading(true);
    stopRequestedRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;

    const show = (content: string) => {
      const placeholder: ChatMessage = { id: job.assistantId, role: 'assistant', content };
      setTransientMessages(job.userMsg ? [job.userMsg, placeholder] : [placeholder]);
    };
    show('');

    let partial = ''; // what has arrived so far, in case you press Stop

    try {
      const attachments = await getConversationAttachments(job.convId);

      // The chat so far, as "memory" for the AI. (A question being retried has no answer yet, so it is left out.)
      const saved = await db.messages.where('conversationId').equals(job.convId).sortBy('timestamp');
      const onlineHistory = buildHistory(saved, ONLINE_HISTORY);
      const offlineHistory = buildHistory(saved, OFFLINE_HISTORY);

      let result: AnswerResult;

      try {
        result = isOnline
          ? await answerOnline(job, attachments, onlineHistory, controller.signal, (text) => {
              partial = text;
              show(text);
            })
          : await answerOffline(job, attachments, offlineHistory);
      } catch (err) {
        if (isAbortError(err)) {
          // Keep what was written so far. If nothing real arrived yet, say it was stopped.
          const hasText = splitLabels(partial).body !== '';
          result = { content: hasText ? partial : STOPPED_TEXT, cache: false, failed: !hasText };
        } else if (err instanceof TypeError) {
          // The network failed: fall back to the offline path.
          result = await answerOffline(job, attachments, offlineHistory);
        } else {
          console.error('Gemini call failed:', err);
          result = { content: 'Something went wrong reaching SMRT. Please try again.', cache: false, failed: true };
        }
      }

      const savedOk = await saveAnswer(job, result.content, result.failed);
      if (savedOk && result.cache) {
        await db.qaHistory.add({
          id: crypto.randomUUID(),
          userId,
          question: job.question,
          answer: result.content,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.error('Saving the answer failed:', err);
    } finally {
      setTransientMessages([]);
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  }

  async function handleSend(text: string) {
    if (isLoading) return;

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

    try {
      const convId: string = conversationId ?? (await createConversation(userId, text));
      if (!conversationId) {
        skipNextReset.current = true;
        onNewConversation(convId);
      }

      // Save any files attached to this message.
      if (pendingFiles.length > 0) {
        await saveAttachments(userId, convId, pendingFiles);
        setPendingFiles([]);
      }

      await runAnswer({ convId, question: text, userMsg, assistantId });
    } catch (err) {
      console.error('Sending failed:', err);
      setTransientMessages([]);
      setIsLoading(false);
    }
  }

  // Write a fresh answer to the question above the given answer, replacing it.
  async function handleRetry(assistantMessageId: string) {
    if (isLoading || !conversationId) return;

    const list = persistedMessages ?? [];
    const index = list.findIndex((m) => m.id === assistantMessageId);
    const questionMsg = index > 0 ? list[index - 1] : undefined;
    if (!questionMsg || questionMsg.role !== 'user') return;

    const assistantId = crypto.randomUUID();
    setIsLoading(true);
    setTransientMessages([{ id: assistantId, role: 'assistant', content: '' }]);

    try {
      await db.messages.delete(assistantMessageId);
      // Forget the old saved answer to this question, so offline mode can't hand the same one back.
      await db.qaHistory
        .where('userId')
        .equals(userId)
        .filter((record) => record.question === questionMsg.content)
        .delete();

      await runAnswer({
        convId: conversationId,
        question: questionMsg.content,
        userMsg: null,
        assistantId,
      });
    } catch (err) {
      console.error('Retry failed:', err);
      setTransientMessages([]);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList messages={messages} canRetry={!isLoading} onRetry={handleRetry} />
      {showReadyBanner && (
        <div className="flex items-center justify-center gap-1.5 py-1 text-sm font-medium text-green-700">
          <CheckCircle2 size={14} />
          Offline AI downloaded and ready to use.
        </div>
      )}
      {/* Download progress (or a failure message) — the download button itself is the header badge. */}
      {!localModel.isReady && localModel.progressText && (
        <p className="py-1 text-center text-sm text-slate-500">{localModel.progressText}</p>
      )}
      <MessageInput
        onSend={handleSend}
        isGenerating={isLoading}
        onStop={stopGenerating}
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
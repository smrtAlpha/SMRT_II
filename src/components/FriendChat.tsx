import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, Clock, Loader2, Reply, RotateCw, Send, Trash2, WifiOff, X } from 'lucide-react';
import { db } from '../lib/db';
import type { FriendMessage, FriendOutboxItem } from '../lib/db';
import { discardFriendMessage, queueFriendMessage, retryFriendMessage, useFriendChat } from '../lib/friendChat';

type Props = {
  chatId: string;
  userId: string;
  isOnline: boolean;
  isGroup: boolean;
  // What to call the other person in a one-to-one chat (shown when quoting their messages).
  partnerName: string;
  // People you've blocked: their messages are hidden in groups.
  blockedIds: Set<string>;
  // When set, the message box is replaced by this note (the other person left, or you blocked them).
  lock: ChatLock | null;
};

export type ChatLock = { text: string; actionLabel?: string; onAction?: () => void };

type Item = { kind: 'saved'; message: FriendMessage } | { kind: 'waiting'; message: FriendOutboxItem };

// Saves (or, if empty, removes) the unsent text for a chat.
async function saveDraft(userId: string, chatId: string, text: string) {
  try {
    if (text.trim() === '') await db.friendDrafts.delete(chatId);
    else await db.friendDrafts.put({ chatId, userId, text, updatedAt: Date.now() });
  } catch (err) {
    console.error('Saving the draft failed:', err);
  }
}

function timeOf(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(ms: number): string {
  const day = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function FriendChat({ chatId, userId, isOnline, isGroup, partnerName, blockedIds, lock }: Props) {
  const { messages, outbox, people, hasMore, loadingEarlier, loadEarlier, error } = useFriendChat(
    chatId,
    userId,
    isOnline,
    isGroup
  );
  const [text, setText] = useState('');
  // The message being answered, if any.
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string; body: string } | null>(null);
  const textRef = useRef('');
  const draftLoaded = useRef(false);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Bring back what was typed but not sent (after a reload, or coming back to this chat).
  useEffect(() => {
    let cancelled = false;
    db.friendDrafts.get(chatId).then((draft) => {
      if (cancelled) return;
      // Don't overwrite anything typed in the meantime.
      if (draft && textRef.current === '') setText(draft.text);
      draftLoaded.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // Save the draft shortly after each change...
  useEffect(() => {
    if (!draftLoaded.current) return;
    const timer = window.setTimeout(() => void saveDraft(userId, chatId, textRef.current), 150);
    return () => window.clearTimeout(timer);
  }, [text, userId, chatId]);

  // ...and right away when the page is hidden or reloaded, or when this chat is closed.
  useEffect(() => {
    const flush = () => {
      if (draftLoaded.current) void saveDraft(userId, chatId, textRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [userId, chatId]);

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const heightBeforeEarlier = useRef<number | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // A message the server already has shouldn't also show as "waiting" (it can appear in both for a moment).
  const savedIds = new Set((messages ?? []).map((m) => m.id));
  const visibleMessages = (messages ?? []).filter(
    (m) => !(isGroup && m.senderId !== null && blockedIds.has(m.senderId))
  );
  const items: Item[] = [
    ...visibleMessages.map((message): Item => ({ kind: 'saved', message })),
    ...(outbox ?? []).filter((o) => !savedIds.has(o.id)).map((message): Item => ({ kind: 'waiting', message })),
  ];

  // Every message we have, so a reply can show the message it answers.
  const byId = new Map<string, FriendMessage | FriendOutboxItem>();
  for (const m of messages ?? []) byId.set(m.id, m);
  for (const o of outbox ?? []) byId.set(o.id, o);

  // Who to call the writer of a message when quoting it.
  function writerName(writerId: string | null | undefined, savedName?: string): string {
    if (writerId === undefined || writerId === userId) return 'You';
    if (writerId === null) return 'Deleted user';
    if (!isGroup) return partnerName;
    return people[writerId] ?? savedName ?? 'Member';
  }

  function startReply(message: FriendMessage) {
    setReplyingTo({ id: message.id, name: writerName(message.senderId, message.senderName), body: message.body });
    textarea.current?.focus();
  }

  // Scrolls to the quoted message and flashes it.
  function jumpTo(messageId: string) {
    const el = document.getElementById(`fm-${messageId}`);
    if (!el) return;
    stickToBottom.current = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'background-color 0.4s';
    el.style.backgroundColor = 'rgba(59, 130, 246, 0.18)';
    window.setTimeout(() => {
      el.style.backgroundColor = '';
    }, 1200);
  }

  const count = items.length;
  const firstId = items.length > 0 ? items[0].message.id : null;

  // Keep the newest message in view, unless you've scrolled up to read older ones.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (heightBeforeEarlier.current !== null) {
      // Older messages were added above: stay on the message you were looking at.
      el.scrollTop += el.scrollHeight - heightBeforeEarlier.current;
      heightBeforeEarlier.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [count, firstId]);

  function handleScroll() {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  function handleLoadEarlier() {
    heightBeforeEarlier.current = scroller.current?.scrollHeight ?? null;
    void loadEarlier();
  }

  async function handleSend() {
    const body = text.trim();
    if (!body || lock) return;
    const replyToId = replyingTo?.id ?? null;
    setText('');
    setReplyingTo(null);
    stickToBottom.current = true;
    await queueFriendMessage(userId, chatId, body, replyToId);
  }

  // Grow the box with what's typed (including a restored draft), up to a limit.
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  // On a phone, Enter makes a new line (the Send button sends). On a computer, Enter sends and Shift+Enter makes a line.
  const touchDevice = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {hasMore && (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={handleLoadEarlier}
              disabled={loadingEarlier || !isOnline}
              className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-white disabled:opacity-50"
            >
              {loadingEarlier && <Loader2 size={12} className="animate-spin" />}
              Load earlier messages
            </button>
          </div>
        )}

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-700">{error}</p>}

        {messages !== undefined && count === 0 && (
          <p className="mt-6 text-center text-sm text-slate-400">No messages yet. Say hello!</p>
        )}

        <div className="flex flex-col gap-1">
          {items.map((item, index) => {
            const m = item.message;
            const mine = item.kind === 'waiting' || (item.kind === 'saved' && item.message.senderId === userId);
            const previous = index > 0 ? items[index - 1].message : null;
            const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(m.createdAt);

            // Who wrote it (shown above the first of a run of messages, in group chats).
            const senderId = item.kind === 'saved' ? item.message.senderId : userId;
            const previousSenderId =
              previous === null ? undefined : 'senderId' in previous ? previous.senderId : userId;
            const showName = isGroup && !mine && (newDay || previousSenderId !== senderId);
            let name = '';
            if (showName && item.kind === 'saved') {
              name =
                item.message.senderId === null
                  ? 'Deleted user'
                  : (people[item.message.senderId] ?? item.message.senderName ?? 'Member');
            }

            const replyId = m.replyToId ?? null;
            const target = replyId ? byId.get(replyId) : undefined;

            const replyButton =
              item.kind === 'saved' ? (
                <button
                  type="button"
                  onClick={() => startReply(item.message)}
                  aria-label="Reply to this message"
                  title="Reply"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600 focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-60"
                >
                  <Reply size={14} />
                </button>
              ) : null;

            return (
              <div key={m.id} id={`fm-${m.id}`} className="rounded-lg">
                {newDay && (
                  <p className="my-2 text-center text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                    {dayLabel(m.createdAt)}
                  </p>
                )}
                {showName && <p className="mt-1 mb-0.5 px-1 text-xs font-medium text-slate-500">{name}</p>}
                <div className={`group flex items-center gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {mine && replyButton}
                  <div
                    className={`max-w-[82%] rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap ${
                      mine
                        ? 'rounded-br-md bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-sm shadow-blue-900/20'
                        : 'rounded-bl-md border border-slate-200/80 bg-white/80 text-slate-800'
                    } ${item.kind === 'waiting' ? 'opacity-70' : ''}`}
                  >
                    {replyId && (
                      <button
                        type="button"
                        onClick={() => target && jumpTo(replyId)}
                        className={`mb-1 block w-full rounded-lg border-l-2 px-2 py-1 text-left text-xs whitespace-normal ${
                          mine
                            ? 'border-blue-200 bg-white/15 text-blue-50'
                            : 'border-blue-400 bg-slate-100/80 text-slate-600'
                        }`}
                      >
                        <span className="block truncate font-medium">
                          {target ? ('senderId' in target ? writerName(target.senderId, target.senderName) : 'You') : 'Earlier message'}
                        </span>
                        {target && <span className="line-clamp-2 break-words">{target.body}</span>}
                      </button>
                    )}
                    {m.body}
                    {item.kind === 'saved' && (
                      <span className={`ml-2 inline-block text-[10px] ${mine ? 'text-blue-100' : 'text-slate-400'}`}>
                        {timeOf(m.createdAt)}
                      </span>
                    )}
                  </div>
                  {!mine && replyButton}
                </div>

                {item.kind === 'waiting' && (
                  <div className="mt-0.5 flex items-center justify-end gap-2 px-1 text-[11px]">
                    {item.message.error ? (
                      <>
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertCircle size={12} className="shrink-0" />
                          Not sent: {item.message.error}
                        </span>
                        <button
                          type="button"
                          onClick={() => retryFriendMessage(userId, item.message.id)}
                          className="flex items-center gap-1 font-medium text-blue-600 hover:underline"
                        >
                          <RotateCw size={11} /> Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => discardFriendMessage(item.message.id)}
                          className="flex items-center gap-1 font-medium text-slate-500 hover:text-red-600"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock size={11} />
                        {isOnline ? 'Sending...' : 'Waiting for connection'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200/80 p-2.5">
        {lock ? (
          <div className="flex flex-col items-center gap-2 px-2 py-1.5 text-center">
            <p className="text-xs text-slate-400">{lock.text}</p>
            {lock.onAction && (
              <button
                type="button"
                onClick={lock.onAction}
                className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
              >
                {lock.actionLabel}
              </button>
            )}
          </div>
        ) : (
          <>
            {!isOnline && (
              <p className="mb-2 flex items-center gap-1.5 px-1 text-xs text-amber-700">
                <WifiOff size={12} className="shrink-0" />
                You&apos;re offline. Messages will send when you reconnect.
              </p>
            )}
            {replyingTo && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-blue-400 bg-slate-100/80 px-2.5 py-1.5 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-600">Replying to {replyingTo.name}</p>
                  <p className="line-clamp-2 break-words text-slate-500">{replyingTo.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  aria-label="Cancel reply"
                  className="shrink-0 rounded-md p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={textarea}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && replyingTo) {
                    setReplyingTo(null);
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey && !touchDevice && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Write a message"
                aria-label="Write a message"
                className="max-h-[120px] min-h-[38px] flex-1 resize-none rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm backdrop-blur-sm transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!text.trim()}
                aria-label="Send message"
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-sm shadow-blue-900/20 transition-all hover:from-blue-500 hover:to-blue-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
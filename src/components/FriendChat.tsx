import { useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, Clock, Loader2, RotateCw, Send, Trash2, WifiOff } from 'lucide-react';
import type { FriendMessage, FriendOutboxItem } from '../lib/db';
import { discardFriendMessage, queueFriendMessage, retryFriendMessage, useFriendChat } from '../lib/friendChat';

type Props = {
  chatId: string;
  userId: string;
  isOnline: boolean;
  isGroup: boolean;
  // A one-to-one chat whose other person has left or deleted their account: nothing can be sent.
  readOnly: boolean;
};

type Item = { kind: 'saved'; message: FriendMessage } | { kind: 'waiting'; message: FriendOutboxItem };

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

export default function FriendChat({ chatId, userId, isOnline, isGroup, readOnly }: Props) {
  const { messages, outbox, people, hasMore, loadingEarlier, loadEarlier, error } = useFriendChat(
    chatId,
    userId,
    isOnline,
    isGroup
  );
  const [text, setText] = useState('');

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const heightBeforeEarlier = useRef<number | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // A message the server already has shouldn't also show as "waiting" (it can appear in both for a moment).
  const savedIds = new Set((messages ?? []).map((m) => m.id));
  const items: Item[] = [
    ...(messages ?? []).map((message): Item => ({ kind: 'saved', message })),
    ...(outbox ?? []).filter((o) => !savedIds.has(o.id)).map((message): Item => ({ kind: 'waiting', message })),
  ];

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
    if (!body || readOnly) return;
    setText('');
    stickToBottom.current = true;
    if (textarea.current) textarea.current.style.height = 'auto';
    await queueFriendMessage(userId, chatId, body);
  }

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

            return (
              <div key={m.id}>
                {newDay && (
                  <p className="my-2 text-center text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                    {dayLabel(m.createdAt)}
                  </p>
                )}
                {showName && <p className="mt-1 mb-0.5 px-1 text-xs font-medium text-slate-500">{name}</p>}
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap ${
                      mine
                        ? 'rounded-br-md bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-sm shadow-blue-900/20'
                        : 'rounded-bl-md border border-slate-200/80 bg-white/80 text-slate-800'
                    } ${item.kind === 'waiting' ? 'opacity-70' : ''}`}
                  >
                    {m.body}
                    {item.kind === 'saved' && (
                      <span className={`ml-2 inline-block text-[10px] ${mine ? 'text-blue-100' : 'text-slate-400'}`}>
                        {timeOf(m.createdAt)}
                      </span>
                    )}
                  </div>
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
        {readOnly ? (
          <p className="px-2 py-1.5 text-center text-xs text-slate-400">
            This person has left or deleted their account, so you can&apos;t send messages here.
          </p>
        ) : (
          <>
            {!isOnline && (
              <p className="mb-2 flex items-center gap-1.5 px-1 text-xs text-amber-700">
                <WifiOff size={12} className="shrink-0" />
                You&apos;re offline. Messages will send when you reconnect.
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={textarea}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
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
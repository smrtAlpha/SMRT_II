import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { FriendMessage } from './db';
import { supabase } from './supabase';
import { callServer, isOfflineMessage } from './friends';
import type { Outcome } from './friends';

// A message as the server stores it.
type ServerMessage = {
  id: string;
  chat_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
};

const PAGE = 50;
const MESSAGE_COLUMNS = 'id, chat_id, sender_id, body, created_at';

function toLocal(row: ServerMessage, viewerId: string, people?: Record<string, string>): FriendMessage {
  const local: FriendMessage = {
    id: row.id,
    chatId: row.chat_id,
    userId: viewerId,
    senderId: row.sender_id,
    body: row.body,
    createdAt: Date.parse(row.created_at),
  };
  const name = row.sender_id ? people?.[row.sender_id] : undefined;
  if (name) local.senderName = name;
  return local;
}

async function cacheRows(rows: ServerMessage[], viewerId: string, people?: Record<string, string>) {
  if (rows.length === 0) return;
  await db.friendMessages.bulkPut(rows.map((r) => toLocal(r, viewerId, people)));
}

function fetchPage(chatId: string, beforeMs?: number) {
  let filtered = supabase.from('chat_messages').select(MESSAGE_COLUMNS).eq('chat_id', chatId);
  if (beforeMs !== undefined) {
    // +1 ms, because the saved time has lost its microseconds; anything fetched twice is de-duplicated by id.
    filtered = filtered.lt('created_at', new Date(beforeMs + 1).toISOString());
  }
  const query = filtered.order('created_at', { ascending: false }).limit(PAGE);
  return callServer<ServerMessage[]>(() => query);
}

// Loads the newest messages and saves them on this device.
async function syncLatestMessages(
  chatId: string,
  viewerId: string,
  people?: Record<string, string>
): Promise<Outcome<{ full: boolean }>> {
  const result = await fetchPage(chatId);
  if (!result.ok) return result;
  const rows = result.data;

  if (rows.length === PAGE) {
    // A full page means there might be a gap between what was saved earlier and these newest messages.
    // If so, drop the older saved ones so the history on screen is always one unbroken run
    // ("Load earlier messages" fetches them again).
    const oldest = Date.parse(rows[rows.length - 1].created_at);
    const saved = await db.friendMessages.where('chatId').equals(chatId).reverse().sortBy('createdAt');
    if (saved.length > 0 && saved[0].createdAt < oldest) {
      await db.friendMessages
        .where('chatId')
        .equals(chatId)
        .filter((m) => m.createdAt < oldest)
        .delete();
    }
  }

  await cacheRows(rows, viewerId, people);
  return { ok: true, data: { full: rows.length === PAGE } };
}

async function loadEarlierMessages(
  chatId: string,
  viewerId: string,
  people?: Record<string, string>
): Promise<Outcome<{ full: boolean }>> {
  const saved = await db.friendMessages.where('chatId').equals(chatId).sortBy('createdAt');
  if (saved.length === 0) return syncLatestMessages(chatId, viewerId, people);

  const result = await fetchPage(chatId, saved[0].createdAt);
  if (!result.ok) return result;
  await cacheRows(result.data, viewerId, people);
  return { ok: true, data: { full: result.data.length === PAGE } };
}

// Who is in this chat: user id -> the name to show.
async function loadChatPeople(chatId: string): Promise<Outcome<Record<string, string>>> {
  const members = await callServer<{ user_id: string }[]>(() =>
    supabase.from('chat_members').select('user_id').eq('chat_id', chatId)
  );
  if (!members.ok) return members;
  const ids = members.data.map((m) => m.user_id);
  if (ids.length === 0) return { ok: true, data: {} };

  const profiles = await callServer<{ user_id: string; username: string; display_name: string | null }[]>(() =>
    supabase.from('profiles').select('user_id, username, display_name').in('user_id', ids)
  );
  if (!profiles.ok) return profiles;

  const map: Record<string, string> = {};
  for (const p of profiles.data) map[p.user_id] = p.display_name || `@${p.username}`;
  return { ok: true, data: map };
}

// ---------- Sending (works offline: messages wait in the outbox) ----------

let flushing: Promise<void> | null = null;

// Sends everything waiting in the outbox, oldest first. Stops quietly if there's no connection.
export function flushFriendOutbox(userId: string): Promise<void> {
  if (flushing) return flushing;

  const sendAll = async () => {
    try {
      if (!navigator.onLine) return;
      const items = await db.friendOutbox.where('userId').equals(userId).sortBy('createdAt');
      for (const item of items) {
        if (item.error) continue; // waiting for the person to retry or delete it
        const result = await callServer<ServerMessage>(() =>
          supabase.rpc('send_message', { p_id: item.id, p_chat: item.chatId, p_body: item.body })
        );
        if (result.ok) {
          await db.friendMessages.put(toLocal(result.data, userId));
          await db.friendOutbox.delete(item.id);
        } else if (isOfflineMessage(result.message)) {
          return; // no connection: keep everything and try again later
        } else {
          await db.friendOutbox.update(item.id, { error: result.message });
        }
      }
    } catch (err) {
      console.error('Sending queued Friends messages failed:', err);
    }
  };

  // Cleared only after it has been stored, so a run that finishes instantly can't leave a finished
  // promise behind that blocks every later send.
  flushing = sendAll().finally(() => {
    flushing = null;
  });
  return flushing;
}

export async function queueFriendMessage(userId: string, chatId: string, body: string): Promise<void> {
  const text = body.trim().slice(0, 4000);
  if (!text) return;
  await db.friendOutbox.add({ id: crypto.randomUUID(), chatId, userId, body: text, createdAt: Date.now() });
  void flushFriendOutbox(userId);
}

export async function retryFriendMessage(userId: string, id: string): Promise<void> {
  await db.friendOutbox.update(id, { error: undefined });
  void flushFriendOutbox(userId);
}

export async function discardFriendMessage(id: string): Promise<void> {
  await db.friendOutbox.delete(id);
}

// Keeps trying to send waiting messages: when the app opens, when the connection comes back,
// and when you return to the tab. Runs for the whole app, not just while Friends is open.
export function useFriendOutbox(userId: string | null, isOnline: boolean) {
  useEffect(() => {
    if (!userId || !isOnline) return;
    void flushFriendOutbox(userId);
    const onFocus = () => void flushFriendOutbox(userId);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [userId, isOnline]);
}

// ---------- One open chat ----------

export function useFriendChat(chatId: string, userId: string, isOnline: boolean, isGroup: boolean) {
  const messages = useLiveQuery(() => db.friendMessages.where('chatId').equals(chatId).sortBy('createdAt'), [chatId]);
  const outbox = useLiveQuery(() => db.friendOutbox.where('chatId').equals(chatId).sortBy('createdAt'), [chatId]);

  const [people, setPeople] = useState<Record<string, string>>({});
  const peopleRef = useRef(people);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  // null = not known yet. true = there may be older messages on the server.
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState('');

  // Names for a group chat.
  useEffect(() => {
    if (!isGroup || !isOnline) return;
    let cancelled = false;
    loadChatPeople(chatId).then(async (result) => {
      if (cancelled || !result.ok) return;
      setPeople(result.data);
      // Keep the names with the saved messages, so they still show offline.
      await db.friendMessages
        .where('chatId')
        .equals(chatId)
        .modify((m: FriendMessage) => {
          const name = m.senderId ? result.data[m.senderId] : undefined;
          if (name && m.senderName !== name) m.senderName = name;
        });
    });
    return () => {
      cancelled = true;
    };
  }, [chatId, isGroup, isOnline]);

  // Load the newest messages, then keep listening for new ones.
  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    const sync = async () => {
      const result = await syncLatestMessages(chatId, userId, peopleRef.current);
      if (cancelled) return;
      if (result.ok) {
        setError('');
        setHasMore((known) => (result.data.full ? (known ?? true) : false));
      } else {
        setError(result.message);
      }
    };

    void sync();
    const channel = supabase
      .channel(`friend-chat-${chatId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          void cacheRows([payload.new as ServerMessage], userId, peopleRef.current);
        }
      )
      .subscribe((status) => {
        // Once listening, fetch again to catch anything that arrived while connecting.
        if (status === 'SUBSCRIBED') void sync();
      });

    const onFocus = () => void sync();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      void supabase.removeChannel(channel);
    };
  }, [chatId, userId, isOnline]);

  // Mark the chat as read while it's open and visible.
  const latestId = messages && messages.length > 0 ? messages[messages.length - 1].id : null;
  useEffect(() => {
    if (!isOnline || !latestId) return;
    const mark = () => {
      if (document.visibilityState === 'visible') {
        void callServer<null>(() => supabase.rpc('mark_chat_read', { p_chat: chatId }));
      }
    };
    const timer = window.setTimeout(mark, 400);
    document.addEventListener('visibilitychange', mark);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', mark);
    };
  }, [chatId, isOnline, latestId]);

  const loadEarlier = useCallback(async () => {
    setLoadingEarlier(true);
    const result = await loadEarlierMessages(chatId, userId, peopleRef.current);
    setLoadingEarlier(false);
    if (result.ok) {
      setHasMore(result.data.full);
      setError('');
    } else {
      setError(result.message);
    }
  }, [chatId, userId]);

  return { messages, outbox, people, hasMore, loadingEarlier, loadEarlier, error };
}
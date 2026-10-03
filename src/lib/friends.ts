import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from './supabase';
import { db } from './db';

export type Profile = { user_id: string; username: string; display_name: string | null };

// One row of the chat list: a chat with its latest message and how many you haven't read.
export type ChatSummary = {
  chat_id: string;
  kind: 'direct' | 'group';
  title: string | null;
  other_user_id: string | null;
  other_username: string | null;
  other_display_name: string | null;
  last_body: string | null;
  last_sender_id: string | null;
  last_at: string;
  unread: number;
  member_count: number;
};

export type Outcome<T> = { ok: true; data: T } | { ok: false; message: string };

export const OFFLINE_MESSAGE = "You're offline. Connect to the internet to use Friends.";

// True when a failure was just "no connection" (worth retrying later) rather than the server saying no.
export function isOfflineMessage(message: string): boolean {
  return message === OFFLINE_MESSAGE;
}

// Turns a failure into words a person can act on. The server's own messages (taken username,
// blocked, too fast...) are already written in plain language, so they pass straight through.
function friendlyError(err: { message?: string } | null | undefined): string {
  const message = err?.message ?? '';
  if (!navigator.onLine || /failed to fetch|networkerror|load failed/i.test(message)) {
    return OFFLINE_MESSAGE;
  }
  return message || 'Something went wrong. Please try again.';
}

export async function callServer<T>(call: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>): Promise<Outcome<T>> {
  try {
    const { data, error } = await call();
    if (error) return { ok: false, message: friendlyError(error) };
    return { ok: true, data: data as T };
  } catch (err) {
    console.error('Friends request failed:', err);
    return { ok: false, message: friendlyError(err instanceof Error ? err : null) };
  }
}

// null = this account hasn't chosen a username yet.
export function getMyProfile(userId: string) {
  return callServer<Profile | null>(() =>
    supabase.from('profiles').select('user_id, username, display_name').eq('user_id', userId).maybeSingle()
  );
}

export function saveProfile(username: string, displayName: string) {
  return callServer<Profile>(() =>
    supabase.rpc('set_profile', { p_username: username, p_display_name: displayName.trim() || null })
  );
}

export function searchUsers(query: string) {
  return callServer<Profile[]>(() => supabase.rpc('search_users', { p_query: query }));
}

// Starts (or reopens) a one-to-one chat. Returns the chat id.
export function startDirectChat(otherUserId: string) {
  return callServer<string>(() => supabase.rpc('start_direct_chat', { p_other: otherUserId }));
}

export function loadMyChats() {
  return callServer<ChatSummary[]>(() => supabase.rpc('my_chats'));
}

// "Ada Obi" if they set a display name, otherwise "@ada".
export function personName(displayName: string | null, username: string | null): string {
  if (displayName) return displayName;
  if (username) return `@${username}`;
  return 'Deleted user';
}

export function chatTitle(chat: ChatSummary): string {
  if (chat.kind === 'group') return chat.title || 'Group';
  return personName(chat.other_display_name, chat.other_username);
}

// Your own username, saved on this device so Friends can open without the internet.
export async function rememberProfile(userId: string, profile: Profile): Promise<void> {
  await db.friendProfiles.put({ userId, username: profile.username, displayName: profile.display_name });
}

// undefined = still reading, null = nothing saved yet.
export function useStoredProfile(userId: string | null): Profile | null | undefined {
  return useLiveQuery(async () => {
    if (!userId) return null;
    const row = await db.friendProfiles.get(userId);
    return row ? { user_id: row.userId, username: row.username, display_name: row.displayName } : null;
  }, [userId]);
}

// Keeps the chat list up to date: shows the saved list straight away (even offline), then reloads it
// from the server, and again whenever a message arrives, you're added to / removed from a chat, or
// you come back to the tab. `loaded` turns true once the server has confirmed the list this session.
export function useMyChats(userId: string | null, enabled: boolean, isOnline: boolean) {
  const rows = useLiveQuery(
    async () => (userId ? db.friendChats.where('userId').equals(userId).toArray() : []),
    [userId]
  );
  const chats = rows ? [...rows].sort((a, b) => Date.parse(b.last_at) - Date.parse(a.last_at)) : undefined;

  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const result = await loadMyChats();
    if (result.ok) {
      await db.transaction('rw', db.friendChats, async () => {
        await db.friendChats.where('userId').equals(userId).delete();
        await db.friendChats.bulkPut(result.data.map((c) => ({ ...c, userId })));
      });
      setError('');
      setLoaded(true);
    } else {
      setError(result.message);
    }
  }, [userId]);

  useEffect(() => {
    if (!enabled || !isOnline) return;
    void refresh();
  }, [enabled, isOnline, refresh]);

  useEffect(() => {
    if (!enabled || !isOnline) return;

    // Several events can arrive at once (a burst of messages): reload once, shortly after the last.
    const schedule = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void refresh(), 300);
    };

    const channel = supabase
      .channel(`friends-list-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, schedule)
      .subscribe();

    window.addEventListener('focus', schedule);
    return () => {
      window.removeEventListener('focus', schedule);
      window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [enabled, isOnline, refresh]);

  return { chats, error, refresh, loaded };
}
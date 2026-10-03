import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

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

// Turns a failure into words a person can act on. The server's own messages (taken username,
// blocked, too fast...) are already written in plain language, so they pass straight through.
function friendlyError(err: { message?: string } | null | undefined): string {
  const message = err?.message ?? '';
  if (!navigator.onLine || /failed to fetch|networkerror|load failed/i.test(message)) {
    return "You're offline. Connect to the internet to use Friends.";
  }
  return message || 'Something went wrong. Please try again.';
}

async function run<T>(call: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>): Promise<Outcome<T>> {
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
  return run<Profile | null>(() =>
    supabase.from('profiles').select('user_id, username, display_name').eq('user_id', userId).maybeSingle()
  );
}

export function saveProfile(username: string, displayName: string) {
  return run<Profile>(() =>
    supabase.rpc('set_profile', { p_username: username, p_display_name: displayName.trim() || null })
  );
}

export function searchUsers(query: string) {
  return run<Profile[]>(() => supabase.rpc('search_users', { p_query: query }));
}

// Starts (or reopens) a one-to-one chat. Returns the chat id.
export function startDirectChat(otherUserId: string) {
  return run<string>(() => supabase.rpc('start_direct_chat', { p_other: otherUserId }));
}

export function loadMyChats() {
  return run<ChatSummary[]>(() => supabase.rpc('my_chats'));
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

// Keeps the chat list up to date: loads it, then reloads whenever a message arrives or you're
// added to / removed from a chat, and again when you come back to the tab.
export function useMyChats(enabled: boolean, isOnline: boolean) {
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [error, setError] = useState('');
  const timer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    const result = await loadMyChats();
    if (result.ok) {
      setChats(result.data);
      setError('');
    } else {
      setError(result.message);
    }
  }, []);

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

  return { chats, error, refresh };
}
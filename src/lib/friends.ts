import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

// ---------- Which chat is open (remembered across reloads and tab switches) ----------

const OPEN_CHAT_KEY_PREFIX = 'smrt-friends-open-chat:';

export function readOpenChat(uid: string | null): string | null {
  if (!uid) return null;
  try {
    return localStorage.getItem(OPEN_CHAT_KEY_PREFIX + uid);
  } catch {
    return null;
  }
}

export function writeOpenChat(uid: string, id: string | null) {
  try {
    if (id) localStorage.setItem(OPEN_CHAT_KEY_PREFIX + uid, id);
    else localStorage.removeItem(OPEN_CHAT_KEY_PREFIX + uid);
  } catch {
    // storage unavailable: skip
  }
}

// ---------- The chat list ----------

// Loads the chat list from the server and saves it on this device.
export async function refreshChatList(userId: string): Promise<Outcome<null>> {
  const result = await loadMyChats();
  if (!result.ok) return result;
  await db.transaction('rw', db.friendChats, async () => {
    await db.friendChats.where('userId').equals(userId).delete();
    await db.friendChats.bulkPut(result.data.map((c) => ({ ...c, userId })));
  });
  return { ok: true, data: null };
}

// Runs for the whole app (not only while Friends is open): keeps the saved chat list and unread
// counts fresh, reloading when a message arrives, you're added to or removed from a chat, or you
// come back to the tab. `onNewMessage` is told about each message someone else sends.
export function useChatListSync(
  userId: string | null,
  isOnline: boolean,
  onNewMessage?: (message: { chat_id: string; sender_id: string | null; body: string }) => void
) {
  const timer = useRef<number | undefined>(undefined);
  const handler = useRef(onNewMessage);
  useEffect(() => {
    handler.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    if (!userId || !isOnline) return;

    const reload = () => void refreshChatList(userId);
    // Several events can arrive at once (a burst of messages): reload once, shortly after the last.
    const schedule = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(reload, 300);
    };

    reload();
    const channel = supabase
      .channel(`friends-list-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const row = payload.new as { chat_id: string; sender_id: string | null; body: string };
        if (row.sender_id !== userId) handler.current?.(row);
        schedule();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, schedule)
      .subscribe();

    window.addEventListener('focus', schedule);
    return () => {
      window.removeEventListener('focus', schedule);
      window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [userId, isOnline]);
}

// The saved chat list for the screen. `loaded` turns true once the server has confirmed the list
// since this screen opened (so a slow load can't be mistaken for "that chat is gone").
export function useMyChats(userId: string | null, enabled: boolean, isOnline: boolean) {
  const rows = useLiveQuery(
    async () => (userId ? db.friendChats.where('userId').equals(userId).toArray() : []),
    [userId]
  );
  const chats = rows ? [...rows].sort((a, b) => Date.parse(b.last_at) - Date.parse(a.last_at)) : undefined;

  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const result = await refreshChatList(userId);
    if (result.ok) {
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

  return { chats, error, refresh, loaded };
}

// Total unread messages across all chats (for the badge on the Friends tab).
export function useFriendsUnread(userId: string | null): number {
  const total = useLiveQuery(async () => {
    if (!userId) return 0;
    const rows = await db.friendChats.where('userId').equals(userId).toArray();
    return rows.reduce((sum, c) => sum + (c.unread || 0), 0);
  }, [userId]);
  return total ?? 0;
}

// ---------- Groups ----------

export type Member = { userId: string; role: 'member' | 'admin'; name: string; username: string | null };

export function createGroup(title: string, memberIds: string[]) {
  return callServer<string>(() => supabase.rpc('create_group', { p_title: title, p_members: memberIds }));
}

export function addGroupMember(chatId: string, userId: string) {
  return callServer<null>(() => supabase.rpc('add_group_member', { p_chat: chatId, p_user: userId }));
}

// Leaves a chat. A group with nobody left is deleted; a group you were the only admin of passes to its longest-standing member.
export function leaveChat(chatId: string) {
  return callServer<null>(() => supabase.rpc('leave_chat', { p_chat: chatId }));
}

export async function loadChatMembers(chatId: string): Promise<Outcome<Member[]>> {
  const members = await callServer<{ user_id: string; role: 'member' | 'admin' }[]>(() =>
    supabase.from('chat_members').select('user_id, role').eq('chat_id', chatId).order('joined_at')
  );
  if (!members.ok) return members;
  const ids = members.data.map((m) => m.user_id);
  if (ids.length === 0) return { ok: true, data: [] };

  const profiles = await callServer<Profile[]>(() =>
    supabase.from('profiles').select('user_id, username, display_name').in('user_id', ids)
  );
  if (!profiles.ok) return profiles;
  const byId = new Map(profiles.data.map((p) => [p.user_id, p]));

  return {
    ok: true,
    data: members.data.map((m) => {
      const p = byId.get(m.user_id);
      return {
        userId: m.user_id,
        role: m.role,
        name: personName(p?.display_name ?? null, p?.username ?? null),
        username: p?.username ?? null,
      };
    }),
  };
}

// ---------- Invite links ----------

// kind 'user': opens a chat with you. kind 'group': joins that group (admins only).
export function createInvite(kind: 'user' | 'group', chatId: string | null) {
  return callServer<string>(() =>
    supabase.rpc('create_invite', { p_kind: kind, p_chat: chatId, p_max_uses: null, p_days: kind === 'user' ? 30 : 7 })
  );
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/?invite=${code}`;
}

export function redeemInvite(code: string) {
  return callServer<{ kind: 'user' | 'group'; chat_id: string }>(() =>
    supabase.rpc('redeem_invite', { p_code: code })
  );
}

// An invite link opened before signing in (or before choosing a username) waits here until it can be used.
const PENDING_INVITE_KEY = 'smrt-pending-invite';

// Call once at startup: if the page was opened from an invite link, remember the code and tidy the address bar.
export function capturePendingInvite(): boolean {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('invite');
    if (!code) return false;
    localStorage.setItem(PENDING_INVITE_KEY, code.trim().toLowerCase().slice(0, 40));
    url.searchParams.delete('invite');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    return true;
  } catch {
    return false;
  }
}

export function readPendingInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // storage unavailable: skip
  }
}

// ---------- Blocking ----------

export function blockPerson(me: string, otherId: string) {
  return callServer<null>(() => supabase.from('blocks').insert({ blocker_id: me, blocked_id: otherId }));
}

export function unblockPerson(me: string, otherId: string) {
  return callServer<null>(() => supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', otherId));
}

// The people you've blocked, saved on this device too so their messages stay hidden offline.
export function useBlocks(userId: string | null, isOnline: boolean) {
  const rows = useLiveQuery(
    async () => (userId ? db.friendBlocks.where('userId').equals(userId).toArray() : []),
    [userId]
  );
  const blocked = useMemo(() => rows ?? [], [rows]);
  const blockedIds = useMemo(() => new Set(blocked.map((b) => b.blockedId)), [blocked]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const result = await callServer<{ blocked_id: string; created_at: string }[]>(() =>
      supabase.from('blocks').select('blocked_id, created_at').eq('blocker_id', userId)
    );
    if (!result.ok) return;

    const ids = result.data.map((b) => b.blocked_id);
    const names = new Map<string, string>();
    if (ids.length > 0) {
      const profiles = await callServer<Profile[]>(() =>
        supabase.from('profiles').select('user_id, username, display_name').in('user_id', ids)
      );
      if (profiles.ok) for (const p of profiles.data) names.set(p.user_id, personName(p.display_name, p.username));
    }
    // A name we can no longer look up (you've left every chat you shared) keeps the one saved before.
    const before = await db.friendBlocks.where('userId').equals(userId).toArray();
    const oldNames = new Map(before.map((r) => [r.blockedId, r.name]));

    await db.transaction('rw', db.friendBlocks, async () => {
      await db.friendBlocks.where('userId').equals(userId).delete();
      await db.friendBlocks.bulkPut(
        result.data.map((b) => ({
          userId,
          blockedId: b.blocked_id,
          name: names.get(b.blocked_id) ?? oldNames.get(b.blocked_id) ?? 'Unknown user',
          createdAt: Date.parse(b.created_at),
        }))
      );
    });
  }, [userId]);

  useEffect(() => {
    if (isOnline) void refresh();
  }, [isOnline, refresh]);

  return { blocked, blockedIds, refresh };
}

// Removes a chat's saved copy from this device (after you leave it).
export async function forgetChatLocally(chatId: string): Promise<void> {
  await db.transaction('rw', [db.friendMessages, db.friendOutbox, db.friendDrafts, db.friendChats], async () => {
    await db.friendMessages.where('chatId').equals(chatId).delete();
    await db.friendOutbox.where('chatId').equals(chatId).delete();
    await db.friendDrafts.delete(chatId);
    await db.friendChats.delete(chatId);
  });
}
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Loader2, MessageCircle, Pencil, Search, Users, WifiOff, X } from 'lucide-react';
import { timeAgo } from '../lib/timeAgo';
import FriendChat from './FriendChat';
import {
  chatTitle,
  getMyProfile,
  personName,
  saveProfile,
  searchUsers,
  startDirectChat,
  useMyChats,
} from '../lib/friends';
import type { ChatSummary, Profile } from '../lib/friends';

type Props = {
  user: User | null;
  isOnline: boolean;
  onOpenAccount: () => void;
};

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm backdrop-blur-sm transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:opacity-50';
const PRIMARY =
  'flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-900/20 transition-all hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

function Avatar({ name, group = false }: { name: string; group?: boolean }) {
  const letter = name.replace(/^@/, '').charAt(0).toUpperCase() || '?';
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
      {group ? <Users size={16} /> : letter}
    </span>
  );
}

function ChatRow({
  chat,
  myId,
  active,
  onSelect,
}: {
  chat: ChatSummary;
  myId: string | null;
  active: boolean;
  onSelect: () => void;
}) {
  const title = chatTitle(chat);
  const preview = chat.last_body ? `${chat.last_sender_id === myId ? 'You: ' : ''}${chat.last_body}` : 'No messages yet';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl py-2 pr-2 pl-3 text-left transition-colors duration-150 ${
        active ? 'bg-white shadow-xs' : 'hover:bg-slate-100/80'
      }`}
    >
      <Avatar name={title} group={chat.kind === 'group'} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-slate-800">{title}</span>
          {chat.last_body && (
            <span className="shrink-0 text-xs text-slate-400">{timeAgo(new Date(chat.last_at).getTime())}</span>
          )}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-slate-400">{preview}</span>
          {chat.unread > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
              {chat.unread > 99 ? '99+' : chat.unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

// ---------- Choose / change your username ----------
function ProfileForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Profile | null;
  onSaved: (profile: Profile) => void;
  onCancel?: () => void;
}) {
  const [username, setUsername] = useState(initial?.username ?? '');
  const [displayName, setDisplayName] = useState(initial?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const result = await saveProfile(username, displayName);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="friends-username" className="mb-1 block text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Username
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">@</span>
          <input
            id="friends-username"
            value={username}
            // Lowercase letters, numbers and underscores only — the same rule the server enforces.
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={busy}
            className={`${INPUT} pl-7`}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">3-20 characters: letters, numbers and underscores. People find you by this.</p>
      </div>

      <div>
        <label htmlFor="friends-display" className="mb-1 block text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Display name <span className="font-normal normal-case">(optional)</span>
        </label>
        <input
          id="friends-display"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          disabled={busy}
          placeholder="How your name shows in chats"
          className={INPUT}
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button type="submit" disabled={busy || username.length < 3} className={`${PRIMARY} flex-1`}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          {initial ? 'Save' : 'Continue'}
        </button>
      </div>
    </form>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto py-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white/60 p-5 backdrop-blur-xl [box-shadow:inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-10px_rgba(30,64,175,0.2)] dark:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.07),0_10px_30px_-10px_rgba(0,0,0,0.6)]">
        {children}
      </div>
    </div>
  );
}

export default function FriendsView({ user, isOnline, onOpenAccount }: Props) {
  // Only a real account (not a guest) can use Friends.
  const userId = user && user.is_anonymous === false ? user.id : null;
  const isReal = userId !== null;

  // undefined = still loading, null = this account has no username yet.
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [profileError, setProfileError] = useState('');
  const [editing, setEditing] = useState(false);

  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ q: string; list: Profile[] } | null>(null);
  const [searchError, setSearchError] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const { chats, error: chatsError, refresh } = useMyChats(!!profile, isOnline);

  // What was typed, cleaned up the way usernames are stored.
  const trimmed = query.trim().replace(/^@/, '').toLowerCase();
  const showResults = trimmed.length >= 3;

  useEffect(() => {
    if (!userId || !isOnline) return;
    let cancelled = false;
    getMyProfile(userId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setProfile(result.data);
        setProfileError('');
      } else {
        setProfileError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, isOnline]);

  // Search as you type, after a short pause so it isn't a request per keystroke.
  useEffect(() => {
    if (!profile || !isOnline || trimmed.length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await searchUsers(trimmed);
      if (cancelled) return;
      if (result.ok) {
        setFound({ q: trimmed, list: result.data });
        setSearchError('');
      } else {
        setSearchError(result.message);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed, profile, isOnline]);

  async function openPerson(person: Profile) {
    setStartingId(person.user_id);
    setSearchError('');
    const result = await startDirectChat(person.user_id);
    setStartingId(null);
    if (!result.ok) {
      setSearchError(result.message);
      return;
    }
    setQuery('');
    setSelectedChatId(result.data);
    void refresh();
  }

  // ---------- Guests ----------
  if (!isReal) {
    return (
      <CenterCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Users size={22} />
          </span>
          <h3 className="text-base font-semibold text-slate-900">Friends needs an account</h3>
          <p className="text-sm text-slate-500">
            Create a free account to find schoolmates by username and chat with them one-to-one or in groups.
          </p>
          <button type="button" onClick={onOpenAccount} className={`${PRIMARY} w-full`}>
            Sign in or create account
          </button>
        </div>
      </CenterCard>
    );
  }

  // ---------- Can't reach the server ----------
  if (profile === undefined) {
    return (
      <CenterCard>
        <div className="flex flex-col items-center gap-3 text-center text-slate-500">
          {!isOnline ? (
            <>
              <WifiOff size={22} />
              <p className="text-sm">Friends needs an internet connection. Reconnect and it will load.</p>
            </>
          ) : profileError ? (
            <>
              <p className="text-sm text-red-700">{profileError}</p>
              <button
                type="button"
                onClick={() => {
                  setProfileError('');
                  if (!userId) return;
                  getMyProfile(userId).then((result) => {
                    if (result.ok) setProfile(result.data);
                    else setProfileError(result.message);
                  });
                }}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Try again
              </button>
            </>
          ) : (
            <Loader2 size={22} className="animate-spin" />
          )}
        </div>
      </CenterCard>
    );
  }

  // ---------- First time: choose a username ----------
  if (profile === null) {
    return (
      <CenterCard>
        <h3 className="mb-1 text-base font-semibold text-slate-900">Choose your username</h3>
        <p className="mb-4 text-sm text-slate-500">
          This is how schoolmates and tutors will find you. You can change it later.
        </p>
        <ProfileForm initial={null} onSaved={setProfile} />
      </CenterCard>
    );
  }

  // ---------- Friends ----------
  const myName = personName(profile.display_name, profile.username);
  const selectedChat = chats?.find((c) => c.chat_id === selectedChatId) ?? null;
  const results = found?.q === trimmed ? found.list : null;

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      {/* ---------- Left: you, search, chat list (hidden on phones while a chat is open) ---------- */}
      <div className={`min-h-0 w-full flex-col md:flex md:w-80 md:shrink-0 ${selectedChatId ? 'hidden' : 'flex'}`}>
        {editing ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-4 backdrop-blur-xl">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Edit your profile</h3>
            <ProfileForm
              initial={profile}
              onSaved={(p) => {
                setProfile(p);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <>
            <div className="mb-3 flex shrink-0 items-center gap-3">
              <Avatar name={myName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{myName}</p>
                <p className="truncate text-xs text-slate-400">@{profile.username}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                title="Edit your profile"
                aria-label="Edit your profile"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600"
              >
                <Pencil size={15} />
              </button>
            </div>

            <div className="relative mb-3 shrink-0">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find people by username"
                aria-label="Find people by username"
                disabled={!isOnline}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className={`${INPUT} pl-9`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {!isOnline && (
              <p className="mb-3 flex shrink-0 items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <WifiOff size={14} className="shrink-0" />
                You&apos;re offline. Friends needs a connection to search and send.
              </p>
            )}

            <div
              className="min-h-0 flex-1 overflow-y-auto pr-1"
              style={{
                maskImage: 'linear-gradient(to bottom, transparent, black 10px, black calc(100% - 10px), transparent)',
                WebkitMaskImage:
                  'linear-gradient(to bottom, transparent, black 10px, black calc(100% - 10px), transparent)',
              }}
            >
              {showResults ? (
                <>
                  <h3 className="mb-1 px-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">People</h3>
                  {searchError && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchError}</p>}
                  {results === null ? (
                    !searchError && (
                      <p className="flex items-center gap-2 px-1 text-sm text-slate-400">
                        <Loader2 size={14} className="animate-spin" /> Searching...
                      </p>
                    )
                  ) : results.length === 0 ? (
                    <p className="px-1 text-sm text-slate-400">No one found with that username.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {results.map((person) => {
                        const name = personName(person.display_name, person.username);
                        return (
                          <button
                            key={person.user_id}
                            type="button"
                            onClick={() => openPerson(person)}
                            disabled={startingId !== null}
                            className="flex w-full items-center gap-3 rounded-xl py-2 pr-2 pl-3 text-left transition-colors duration-150 hover:bg-slate-100/80 disabled:opacity-60"
                          >
                            <Avatar name={name} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-800">{name}</span>
                              <span className="block truncate text-xs text-slate-400">@{person.username}</span>
                            </span>
                            {startingId === person.user_id ? (
                              <Loader2 size={16} className="shrink-0 animate-spin text-blue-600" />
                            ) : (
                              <MessageCircle size={16} className="shrink-0 text-blue-600" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="mb-1 px-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">Chats</h3>
                  {chatsError && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{chatsError}</p>}
                  {chats === null ? (
                    !chatsError && isOnline && (
                      <p className="flex items-center gap-2 px-1 text-sm text-slate-400">
                        <Loader2 size={14} className="animate-spin" /> Loading...
                      </p>
                    )
                  ) : chats.length === 0 ? (
                    <p className="px-1 text-sm text-slate-400">No chats yet. Search for a username above to start one.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {chats.map((chat) => (
                        <ChatRow
                          key={chat.chat_id}
                          chat={chat}
                          myId={userId}
                          active={chat.chat_id === selectedChatId}
                          onSelect={() => setSelectedChatId(chat.chat_id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---------- Right: the open chat (full screen on phones) ---------- */}
      <div
        className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-xl md:flex ${
          selectedChatId ? 'flex' : 'hidden'
        }`}
      >
        {selectedChatId ? (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-200/80 px-3 py-2.5">
              <button
                type="button"
                onClick={() => setSelectedChatId(null)}
                aria-label="Back to chats"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 md:hidden"
              >
                <ArrowLeft size={18} />
              </button>
              <Avatar name={selectedChat ? chatTitle(selectedChat) : 'Chat'} group={selectedChat?.kind === 'group'} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {selectedChat ? chatTitle(selectedChat) : 'Chat'}
                </p>
                {selectedChat && (
                  <p className="truncate text-xs text-slate-400">
                    {selectedChat.kind === 'group'
                      ? `${selectedChat.member_count} ${selectedChat.member_count === 1 ? 'member' : 'members'}`
                      : selectedChat.other_username
                        ? `@${selectedChat.other_username}`
                        : ''}
                  </p>
                )}
              </div>
            </div>
            <FriendChat
              key={selectedChatId}
              chatId={selectedChatId}
              userId={profile.user_id}
              isOnline={isOnline}
              isGroup={selectedChat?.kind === 'group'}
              readOnly={!!selectedChat && selectedChat.kind === 'direct' && !selectedChat.other_user_id}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-slate-400">
            <Users size={32} />
            <p className="text-sm">Pick a chat, or search for someone to start one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
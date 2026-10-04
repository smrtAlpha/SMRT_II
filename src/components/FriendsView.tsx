import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  ArrowLeft,
  Ban,
  Info,
  Link2,
  Loader2,
  MessageCircle,
  Pencil,
  Search,
  UserPlus,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { timeAgo } from '../lib/timeAgo';
import FriendChat from './FriendChat';
import type { ChatLock } from './FriendChat';
import Modal from './Modal';
import NewGroupModal from './NewGroupModal';
import ChatInfoModal from './ChatInfoModal';
import BlockedModal from './BlockedModal';
import InviteLinkBox from './InviteLinkBox';
import NotificationToggle from './NotificationToggle';
import { Avatar, INPUT, PRIMARY } from './friendsUi';
import {
  chatTitle,
  clearPendingInvite,
  createInvite,
  getMyProfile,
  personName,
  readOpenChat,
  readPendingInvite,
  redeemInvite,
  rememberProfile,
  saveProfile,
  searchUsers,
  startDirectChat,
  unblockPerson,
  useBlocks,
  useMyChats,
  useStoredProfile,
  writeOpenChat,
} from '../lib/friends';
import type { ChatSummary, Profile } from '../lib/friends';

type Props = {
  user: User | null;
  isOnline: boolean;
  onOpenAccount: () => void;
};

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

  // The username saved on this device (so Friends opens offline), else what the server says.
  // undefined = still loading, null = this account has no username yet.
  const stored = useStoredProfile(userId);
  const [serverProfile, setServerProfile] = useState<Profile | null | undefined>(undefined);
  const profile = stored ?? serverProfile;
  const [profileError, setProfileError] = useState('');
  const [editing, setEditing] = useState(false);

  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ q: string; list: Profile[] } | null>(null);
  const [searchError, setSearchError] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatIdState] = useState<string | null>(() => readOpenChat(userId));

  function setSelectedChatId(id: string | null) {
    setSelectedChatIdState(id);
    if (userId) writeOpenChat(userId, id);
  }

  const { chats, error: chatsError, refresh, loaded } = useMyChats(userId, !!profile, isOnline);
  const { blocked, blockedIds, refresh: refreshBlocks } = useBlocks(userId, isOnline);

  const [modal, setModal] = useState<'group' | 'myLink' | 'info' | 'blocked' | null>(null);
  const [inviteNote, setInviteNote] = useState('');

  // Tapping a notification (or a link) can ask for a particular chat to be opened.
  useEffect(() => {
    function handleOpen(e: Event) {
      const chatId = (e as CustomEvent<string>).detail;
      if (chatId) setSelectedChatIdState(chatId);
    }
    window.addEventListener('smrt-open-chat', handleOpen);
    return () => window.removeEventListener('smrt-open-chat', handleOpen);
  }, []);

  // An invite link that was opened before you could use it (signed out, or no username yet) is used now.
  useEffect(() => {
    if (!profile || !isOnline) return;
    const code = readPendingInvite();
    if (!code) return;
    clearPendingInvite();
    redeemInvite(code).then(async (result) => {
      if (!result.ok) {
        setInviteNote(result.message);
        return;
      }
      setInviteNote('');
      await refresh();
      setSelectedChatId(result.data.chat_id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isOnline]);

  // If the open chat is gone (you left it, or it was deleted), don't keep trying to show it.
  // Only once the server has confirmed the list, so a slow load can't close a chat by mistake.
  useEffect(() => {
    if (loaded && chats && selectedChatId && !chats.some((c) => c.chat_id === selectedChatId)) {
      setSelectedChatIdState(null);
      if (userId) writeOpenChat(userId, null);
    }
  }, [loaded, chats, selectedChatId, userId]);

  function handleProfileSaved(saved: Profile) {
    setServerProfile(saved);
    if (userId) void rememberProfile(userId, saved);
  }

  // What was typed, cleaned up the way usernames are stored.
  const trimmed = query.trim().replace(/^@/, '').toLowerCase();
  const showResults = trimmed.length >= 3;

  useEffect(() => {
    if (!userId || !isOnline) return;
    let cancelled = false;
    getMyProfile(userId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setServerProfile(result.data);
        if (result.data) void rememberProfile(userId, result.data);
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
    // Reload the list first, so the new chat is in it before it's opened.
    await refresh();
    setSelectedChatId(result.data);
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
            {readPendingInvite()
              ? "You've been invited to a chat on SMRT. Create a free account (or sign in) to join it."
              : 'Create a free account to find schoolmates by username and chat with them one-to-one or in groups.'}
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
          {stored === undefined ? (
            // Still reading what was saved on this device.
            <Loader2 size={22} className="animate-spin" />
          ) : !isOnline ? (
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
                    if (result.ok) {
                      setServerProfile(result.data);
                      if (result.data) void rememberProfile(userId, result.data);
                    } else {
                      setProfileError(result.message);
                    }
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
        <ProfileForm initial={null} onSaved={handleProfileSaved} />
      </CenterCard>
    );
  }

  // ---------- Friends ----------
  const myName = personName(profile.display_name, profile.username);
  const selectedChat = chats?.find((c) => c.chat_id === selectedChatId) ?? null;
  const results = found?.q === trimmed ? found.list : null;

  // Why the message box might be replaced by a note.
  let chatLock: ChatLock | null = null;
  if (selectedChat && selectedChat.kind === 'direct') {
    if (!selectedChat.other_user_id) {
      chatLock = {
        text: "This person has left or deleted their account, so you can't send messages here.",
      };
    } else if (blockedIds.has(selectedChat.other_user_id)) {
      const otherId = selectedChat.other_user_id;
      chatLock = {
        text: 'You blocked this person. Unblock them to send messages.',
        actionLabel: 'Unblock',
        onAction: () => {
          void unblockPerson(profile.user_id, otherId).then(() => refreshBlocks());
        },
      };
    }
  }

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
                handleProfileSaved(p);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
            <button
              type="button"
              onClick={() => setModal('blocked')}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <Ban size={14} />
              Blocked people{blocked.length > 0 ? ` (${blocked.length})` : ''}
            </button>
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

            <div className="mb-3 flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setModal('group')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/60 px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-white"
              >
                <UserPlus size={14} />
                New group
              </button>
              <button
                type="button"
                onClick={() => setModal('myLink')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/60 px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-white"
              >
                <Link2 size={14} />
                My invite link
              </button>
            </div>

            {inviteNote && (
              <p className="mb-3 flex shrink-0 items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                <span className="min-w-0 flex-1">{inviteNote}</span>
                <button type="button" onClick={() => setInviteNote('')} aria-label="Dismiss" className="shrink-0">
                  <X size={12} />
                </button>
              </p>
            )}

            <NotificationToggle
              enableText="Notify me about new messages"
              enabledText="Notifications are on. You'll be told about new messages."
            />

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
                  {chats === undefined ? (
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
              <button
                type="button"
                onClick={() => setModal('info')}
                title="Chat info"
                aria-label="Chat info"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:scale-95"
              >
                <Info size={16} />
              </button>
              {/* On a computer there's no back arrow, so this closes the chat and returns to the list. */}
              <button
                type="button"
                onClick={() => setSelectedChatId(null)}
                title="Close chat"
                aria-label="Close chat"
                className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:scale-95 md:flex"
              >
                <X size={16} />
              </button>
            </div>
            <FriendChat
              key={selectedChatId}
              chatId={selectedChatId}
              userId={profile.user_id}
              isOnline={isOnline}
              isGroup={selectedChat?.kind === 'group'}
              partnerName={selectedChat ? chatTitle(selectedChat) : 'Them'}
              blockedIds={blockedIds}
              lock={chatLock}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-slate-400">
            <Users size={32} />
            <p className="text-sm">Pick a chat, or search for someone to start one.</p>
          </div>
        )}
      </div>

      {modal === 'group' && (
        <NewGroupModal
          isOnline={isOnline}
          onClose={() => setModal(null)}
          onCreated={async (chatId) => {
            setModal(null);
            // Reload the list first, so the new group is in it before it's opened.
            await refresh();
            setSelectedChatId(chatId);
          }}
        />
      )}

      {modal === 'myLink' && (
        <Modal title="My invite link" onClose={() => setModal(null)}>
          <InviteLinkBox
            create={() => createInvite('user', null)}
            buttonLabel="Make my invite link"
            hint="Whoever opens this link (after signing in) starts a chat with you. It works for 30 days."
            disabled={!isOnline}
          />
        </Modal>
      )}

      {modal === 'blocked' && (
        <BlockedModal
          userId={profile.user_id}
          blocked={blocked}
          isOnline={isOnline}
          onClose={() => setModal(null)}
          onChanged={refreshBlocks}
        />
      )}

      {modal === 'info' && selectedChatId && (
        <ChatInfoModal
          chat={selectedChat}
          chatId={selectedChatId}
          userId={profile.user_id}
          isOnline={isOnline}
          blockedIds={blockedIds}
          onClose={() => setModal(null)}
          onLeft={() => {
            setModal(null);
            setSelectedChatId(null);
            void refresh();
          }}
          onBlocksChanged={refreshBlocks}
          onMembersChanged={refresh}
        />
      )}
    </div>
  );
}
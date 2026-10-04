import { useCallback, useEffect, useState } from 'react';
import { Ban, Loader2, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import Modal from './Modal';
import PersonSearch from './PersonSearch';
import InviteLinkBox from './InviteLinkBox';
import { Avatar, SECONDARY } from './friendsUi';
import {
  addGroupMember,
  blockPerson,
  chatTitle,
  createInvite,
  forgetChatLocally,
  leaveChat,
  loadChatMembers,
  unblockPerson,
} from '../lib/friends';
import type { ChatSummary, Member, Profile } from '../lib/friends';

type Props = {
  chat: ChatSummary | null;
  chatId: string;
  userId: string;
  isOnline: boolean;
  blockedIds: Set<string>;
  onClose: () => void;
  // The chat was left: the screen should go back to the list.
  onLeft: () => void;
  onBlocksChanged: () => void;
  onMembersChanged: () => void;
};

export default function ChatInfoModal({
  chat,
  chatId,
  userId,
  isOnline,
  blockedIds,
  onClose,
  onLeft,
  onBlocksChanged,
  onMembersChanged,
}: Props) {
  const isGroup = chat?.kind === 'group';
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const loadMembers = useCallback(async () => {
    const result = await loadChatMembers(chatId);
    if (result.ok) {
      setMembers(result.data);
      setError('');
    } else {
      setError(result.message);
    }
  }, [chatId]);

  useEffect(() => {
    if (!isGroup || !isOnline) return;
    void loadMembers();
  }, [isGroup, isOnline, loadMembers]);

  if (!chat) {
    return (
      <Modal title="Chat info" onClose={onClose}>
        <p className="text-sm text-slate-500">Chat details aren&apos;t available right now.</p>
      </Modal>
    );
  }

  const title = chatTitle(chat);
  const isAdmin = members?.some((m) => m.userId === userId && m.role === 'admin') ?? false;

  async function handleBlockToggle(otherId: string, name: string) {
    const blocked = blockedIds.has(otherId);
    if (
      !blocked &&
      !window.confirm(
        `Block ${name}? They won't be able to message you or find you in search. You can unblock them later.`
      )
    ) {
      return;
    }
    setBusyId(otherId);
    setError('');
    const result = blocked ? await unblockPerson(userId, otherId) : await blockPerson(userId, otherId);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onBlocksChanged();
  }

  async function handleAdd(person: Profile) {
    setBusyId(person.user_id);
    setError('');
    const result = await addGroupMember(chatId, person.user_id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await loadMembers();
    onMembersChanged();
  }

  async function handleLeave() {
    const message = isGroup
      ? `Leave "${title}"? You'll stop getting its messages, and its history is removed from this device.`
      : `Delete this chat with ${title}? It's removed from your list and from this device. They keep their copy.`;
    if (!window.confirm(message)) return;
    setLeaving(true);
    setError('');
    const result = await leaveChat(chatId);
    if (!result.ok) {
      setLeaving(false);
      setError(result.message);
      return;
    }
    await forgetChatLocally(chatId);
    onLeft();
  }

  return (
    <Modal title={isGroup ? 'Group info' : 'Chat info'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={title} group={isGroup} size={44} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">{title}</p>
            <p className="truncate text-xs text-slate-400">
              {isGroup
                ? `${chat.member_count} ${chat.member_count === 1 ? 'member' : 'members'}`
                : chat.other_username
                  ? `@${chat.other_username}`
                  : 'No longer on SMRT'}
            </p>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!isOnline && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            You&apos;re offline. Connect to change anything here.
          </p>
        )}

        {/* ---------- One-to-one ---------- */}
        {!isGroup && chat.other_user_id && (
          <button
            type="button"
            onClick={() => handleBlockToggle(chat.other_user_id as string, title)}
            disabled={!isOnline || busyId !== null}
            className={`${SECONDARY} w-full`}
          >
            {busyId ? (
              <Loader2 size={16} className="animate-spin" />
            ) : blockedIds.has(chat.other_user_id) ? (
              <ShieldCheck size={16} />
            ) : (
              <Ban size={16} />
            )}
            {blockedIds.has(chat.other_user_id) ? `Unblock ${title}` : `Block ${title}`}
          </button>
        )}

        {/* ---------- Group ---------- */}
        {isGroup && (
          <>
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">Members</p>
              {members === null ? (
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  {isOnline ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Loading...
                    </>
                  ) : (
                    'Members load when you are online.'
                  )}
                </p>
              ) : (
                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                  {members.map((m) => {
                    const mine = m.userId === userId;
                    const blocked = blockedIds.has(m.userId);
                    return (
                      <div key={m.userId} className="flex items-center gap-3 rounded-xl py-1.5 pr-1 pl-2">
                        <Avatar name={m.name} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-slate-800">{m.name}</span>
                            {mine && <span className="shrink-0 text-[11px] text-slate-400">(you)</span>}
                            {m.role === 'admin' && (
                              <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                Admin
                              </span>
                            )}
                          </span>
                          {m.username && <span className="block truncate text-xs text-slate-400">@{m.username}</span>}
                        </span>
                        {!mine && (
                          <button
                            type="button"
                            onClick={() => handleBlockToggle(m.userId, m.name)}
                            disabled={!isOnline || busyId !== null}
                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                          >
                            {busyId === m.userId ? '...' : blocked ? 'Unblock' : 'Block'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {isAdmin && (
              <>
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">Add people</p>
                  <PersonSearch
                    exclude={new Set((members ?? []).map((m) => m.userId))}
                    actionLabel="Add"
                    busyId={busyId}
                    disabled={!isOnline}
                    onPick={handleAdd}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">Invite link</p>
                  <InviteLinkBox
                    create={() => createInvite('group', chatId)}
                    buttonLabel="Make an invite link"
                    hint="Anyone with the link can join this group for the next 7 days. Share it only with people you want in."
                    disabled={!isOnline}
                  />
                </div>
              </>
            )}
          </>
        )}

        <button
          type="button"
          onClick={handleLeave}
          disabled={!isOnline || leaving}
          className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          {leaving ? <Loader2 size={16} className="animate-spin" /> : isGroup ? <LogOut size={16} /> : <Trash2 size={16} />}
          {isGroup ? 'Leave group' : 'Delete chat'}
        </button>
      </div>
    </Modal>
  );
}
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './Modal';
import { Avatar } from './friendsUi';
import { unblockPerson } from '../lib/friends';
import type { FriendBlockRow } from '../lib/db';

type Props = {
  userId: string;
  blocked: FriendBlockRow[];
  isOnline: boolean;
  onClose: () => void;
  onChanged: () => void;
};

export default function BlockedModal({ userId, blocked, isOnline, onClose, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleUnblock(blockedId: string) {
    setBusyId(blockedId);
    setError('');
    const result = await unblockPerson(userId, blockedId);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onChanged();
  }

  return (
    <Modal title="Blocked people" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-slate-400">
          Blocked people can&apos;t message you, find you in search, or add you to groups. They are never told.
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {blocked.length === 0 ? (
          <p className="text-sm text-slate-400">You haven&apos;t blocked anyone.</p>
        ) : (
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {blocked.map((b) => (
              <div key={b.blockedId} className="flex items-center gap-3 rounded-xl py-1.5 pr-1 pl-2">
                <Avatar name={b.name} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{b.name}</span>
                <button
                  type="button"
                  onClick={() => handleUnblock(b.blockedId)}
                  disabled={!isOnline || busyId !== null}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                >
                  {busyId === b.blockedId && <Loader2 size={12} className="animate-spin" />}
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
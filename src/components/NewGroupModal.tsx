import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import Modal from './Modal';
import PersonSearch from './PersonSearch';
import { Avatar, INPUT, PRIMARY } from './friendsUi';
import { createGroup, personName } from '../lib/friends';
import type { Profile } from '../lib/friends';

type Props = {
  isOnline: boolean;
  onClose: () => void;
  // Called with the new group's chat id.
  onCreated: (chatId: string) => void;
};

export default function NewGroupModal({ isOnline, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setBusy(true);
    setError('');
    const result = await createGroup(
      name,
      members.map((m) => m.user_id)
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onCreated(result.data);
  }

  return (
    <Modal title="New group" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="group-name" className="mb-1 block text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Group name
          </label>
          <input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Chemistry study group"
            disabled={busy}
            className={INPUT}
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">Add people</p>
          <PersonSearch
            exclude={new Set(members.map((m) => m.user_id))}
            actionLabel="Add"
            disabled={busy || !isOnline}
            onPick={(person) => setMembers((current) => [...current, person])}
          />
          {members.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {members.map((m) => (
                <span
                  key={m.user_id}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 py-1 pr-1.5 pl-1 text-xs text-slate-700"
                >
                  <Avatar name={personName(m.display_name, m.username)} size={20} />
                  {personName(m.display_name, m.username)}
                  <button
                    type="button"
                    onClick={() => setMembers((current) => current.filter((x) => x.user_id !== m.user_id))}
                    aria-label={`Remove ${m.username}`}
                    className="rounded-full p-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">
            You can also add people later, or share an invite link from the group&apos;s info.
          </p>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!isOnline && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">You&apos;re offline. Connect to create a group.</p>}

        <button
          type="button"
          onClick={handleCreate}
          disabled={busy || !isOnline || name.trim().length === 0}
          className={PRIMARY}
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          Create group
        </button>
      </div>
    </Modal>
  );
}
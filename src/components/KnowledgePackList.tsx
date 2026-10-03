import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, GraduationCap, Trash2 } from 'lucide-react';
import { db } from '../lib/db';
import { deletePackFromCloud } from '../lib/cloudSync';

type Props = {
  userId: string;
  onAdd: () => void;
};

export default function KnowledgePackList({ userId, onAdd }: Props) {
  const packs = useLiveQuery(
    () => db.knowledgePacks.where('userId').equals(userId).reverse().sortBy('timestamp'),
    [userId]
  );

  async function handleDelete(id: string, subject: string) {
    if (!window.confirm(`Delete the "${subject}" knowledge pack? This can't be undone.`)) return;
    await db.knowledgePacks.delete(id);
    // Also remove it from the cloud, or the next sync would pull it straight back down.
    deletePackFromCloud(id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Knowledge Packs</h3>
        <button
          type="button"
          onClick={onAdd}
          title="Add a knowledge pack"
          aria-label="Add a knowledge pack"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-200/70 hover:text-blue-600 active:scale-95"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Scrolls on its own when there are many packs */}
      <div
        className="min-h-0 flex-1 overflow-y-auto pr-1"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent, black 10px, black calc(100% - 10px), transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10px, black calc(100% - 10px), transparent)',
        }}
      >
        {packs?.length === 0 && (
          <p className="text-sm text-slate-400">No packs yet. Tap + to add your notes.</p>
        )}

        <div className="flex flex-col gap-1">
          {packs?.map((pack) => (
            <div
              key={pack.id}
              className="group flex items-center gap-3 rounded-xl py-2 pr-1 pl-3.5 transition-colors duration-150 hover:bg-slate-100/80"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors group-hover:bg-white group-hover:shadow-xs">
                <GraduationCap size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{pack.subject}</span>
                <span className="block truncate text-xs text-slate-400">{pack.sourceFileName}</span>
              </span>
              <button
                type="button"
                onClick={() => handleDelete(pack.id, pack.subject)}
                title="Delete this pack"
                aria-label={`Delete ${pack.subject}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 group-hover:text-slate-400"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
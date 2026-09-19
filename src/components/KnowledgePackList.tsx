import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, GraduationCap, Trash2 } from 'lucide-react';
import { db } from '../lib/db';

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
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-500">Knowledge Packs</h3>
        <button
          type="button"
          onClick={onAdd}
          title="Add a knowledge pack"
          aria-label="Add a knowledge pack"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"
        >
          <Plus size={18} />
        </button>
      </div>

      {packs?.length === 0 && (
        <p className="text-sm text-slate-400">No packs yet. Tap + to add your notes.</p>
      )}

      <div className="flex flex-col gap-1">
        {packs?.map((pack) => (
          <div key={pack.id} className="flex items-center gap-3 rounded-xl py-2 pr-1 pl-2.5 hover:bg-slate-100">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
import { useState } from 'react';
import { Search } from 'lucide-react';
import { queueResearchTask } from '../lib/researchQueue';

type Props = { userId: string };

export default function ResearchQueueForm({ userId }: Props) {
  const [query, setQuery] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    await queueResearchTask(userId, query.trim());
    setQuery('');
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 4000);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-2 flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Research this when I'm back online..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Search size={14} />
          Queue
        </button>
      </div>
      {confirmed && <p className="text-sm text-green-700">✅ Queued — I'll research this once you're back online.</p>}
    </form>
  );
}
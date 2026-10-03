import { useState } from 'react';
import { Search, CheckCircle2 } from 'lucide-react';
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
    <form onSubmit={handleSubmit} className="mb-3 flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Research this when I'm back online..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm backdrop-blur-sm transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
        />
        <button
          type="submit"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-blue-900/20 transition-all hover:from-blue-500 hover:to-blue-600 active:scale-[0.97]"
        >
          <Search size={14} />
          Queue
        </button>
      </div>
      {confirmed && (
        <p className="flex animate-[fadeIn_0.25s_ease-out] items-center gap-1.5 text-sm text-green-700">
          <CheckCircle2 size={14} className="shrink-0" />
          Queued — I'll research this once you're back online.
        </p>
      )}
    </form>
  );
}
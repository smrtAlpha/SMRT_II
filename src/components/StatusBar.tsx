import { Database, Clock } from 'lucide-react';

type Props = {
  isOnline: boolean;
  pendingCount: number;
  onOpenQueue: () => void;
};

// Placeholder — Phase 7 will replace this with a real "data saved" number.
const MB_SAVED = 0;

export default function StatusBar({ isOnline, pendingCount, onOpenQueue }: Props) {
  const tasksLabel = pendingCount === 1 ? 'task' : 'tasks';

  return (
    <footer className="mx-3 mb-3 flex shrink-0 items-center gap-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700 md:mx-6">
      <span className="flex items-center gap-1.5" title="Data saved by working offline — coming in Phase 7">
        <Database size={14} />
        <span className="hidden sm:inline">Megabytes saved:</span>
        <span className="sm:hidden">Saved:</span>
        {MB_SAVED} MB
      </span>

      <button
        type="button"
        onClick={onOpenQueue}
        title="Open the research queue"
        className="flex items-center gap-1.5 border-l border-blue-200 pl-3 hover:text-blue-900"
      >
        <Clock size={14} />
        <span className="hidden sm:inline">
          Background queue: {pendingCount} {tasksLabel}
        </span>
        <span className="sm:hidden">Queue: {pendingCount}</span>
      </button>

      <span className="ml-auto flex items-center gap-1.5 text-slate-500">
        <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-amber-500'}`} />
        <span className="hidden sm:inline">{isOnline ? 'All systems operational' : 'Offline mode'}</span>
      </span>
    </footer>
  );
}
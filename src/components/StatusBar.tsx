import { Database, Clock } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { bytesSavedBy, formatBytes } from '../lib/offlineSavings';

type Props = {
  userId: string;
  isOnline: boolean;
  pendingCount: number;
  onOpenQueue: () => void;
};

export default function StatusBar({ userId, isOnline, pendingCount, onOpenQueue }: Props) {
  const tasksLabel = pendingCount === 1 ? 'task' : 'tasks';

  // Estimated data saved by answers that were served without the internet (written by the on-device
  // AI, or reused from saved history). Worked out from the saved messages, so it stays correct across
  // reloads and devices, and updates by itself whenever a new answer is saved.
  const savings = useLiveQuery(async () => {
    let answers = 0;
    let bytes = 0;
    // Messages have no userId index, so this scans and filters (same approach as DataView / cloudSync).
    await db.messages.toCollection().each((m) => {
      if (m.userId !== userId) return;
      const saved = bytesSavedBy(m);
      if (saved > 0) {
        answers += 1;
        bytes += saved;
      }
    });
    return { answers, bytes };
  }, [userId]);

  const answers = savings?.answers ?? 0;
  const savedLabel = formatBytes(savings?.bytes ?? 0);
  const savedTitle =
    answers === 0
      ? 'Estimated data saved by answers served offline. Nothing yet — answers from your offline AI or saved history count here.'
      : `Estimated data saved: ${answers} ${answers === 1 ? 'answer' : 'answers'} served offline (by your on-device AI or from saved history), so they didn't need the internet.`;

  return (
    <footer className="mx-3 mb-3 flex shrink-0 items-center gap-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700 md:mx-6">
      <span className="flex items-center gap-1.5" title={savedTitle}>
        <Database size={14} />
        <span className="hidden sm:inline">Data saved:</span>
        <span className="sm:hidden">Saved:</span>
        {savedLabel}
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
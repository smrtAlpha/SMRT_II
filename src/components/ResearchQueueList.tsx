import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MoreHorizontal, Pause, Play, Trash2 } from 'lucide-react';
import { db } from '../lib/db';
import type { ResearchTask } from '../lib/db';
import { refreshPendingResearchTasks } from '../lib/refreshPendingTasks';

type Props = { userId: string };

const STATUS_ICON: Record<ResearchTask['status'], string> = {
  pending: '⏳',
  paused: '⏸️',
  completed: '✅',
  failed: '❌',
};

const MENU_ITEM = 'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-100';

export default function ResearchQueueList({ userId }: Props) {
  const tasks = useLiveQuery(
    () => db.researchQueue.where('userId').equals(userId).reverse().sortBy('createdAt'),
    [userId]
  );
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);

  // While a menu is open: close it when you tap somewhere else, or press Escape.
  useEffect(() => {
    if (!menuTaskId) return;
    function handlePointerDown(e: PointerEvent) {
      if (!(e.target as HTMLElement).closest('[data-task-menu]')) setMenuTaskId(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuTaskId(null);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuTaskId]);

  async function handlePause(id: string) {
    setMenuTaskId(null);
    // Only a task that is still waiting can be paused (it may have just finished).
    await db.researchQueue.where('id').equals(id).and((t) => t.status === 'pending').modify({ status: 'paused' });
  }

  async function handleResume(id: string) {
    setMenuTaskId(null);
    await db.researchQueue.where('id').equals(id).and((t) => t.status === 'paused').modify({ status: 'pending' });
    // Give it a fresh login token and ask the browser to run it.
    refreshPendingResearchTasks(userId).catch((err) => console.error('Resuming failed:', err));
  }

  async function handleDelete(task: ResearchTask) {
    setMenuTaskId(null);
    if (task.status === 'completed' && !window.confirm('Delete this research result? This cannot be undone.')) return;
    await db.researchQueue.delete(task.id);
  }

  if (!tasks) return null;

  if (tasks.length === 0) {
    return <p className="text-sm text-slate-400">No research tasks yet.</p>;
  }

  return (
    <div className="text-sm">
      {tasks.map((task, index) => (
        <div key={task.id} className="flex items-start gap-1 border-b border-slate-100 py-1.5">
          <details className="min-w-0 flex-1">
            <summary className="cursor-pointer">
              {STATUS_ICON[task.status]} {task.query}
              {task.status === 'paused' && <span className="ml-1 text-xs text-slate-400">(paused)</span>}
            </summary>
            {task.status === 'completed' && (
              <>
                <p className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  No live web search. Answered from Gemini's own knowledge, so it may be out of date.
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-600">{task.result}</p>
              </>
            )}
            {task.status === 'failed' && <p className="mt-1 text-red-600">{task.errorMessage}</p>}
            {task.status === 'paused' && (
              <p className="mt-1 text-slate-500">Paused. It won't run until you resume it.</p>
            )}
          </details>

          <div className="relative shrink-0" data-task-menu>
            <button
              type="button"
              onClick={() => setMenuTaskId(menuTaskId === task.id ? null : task.id)}
              aria-label="Task options"
              aria-expanded={menuTaskId === task.id}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <MoreHorizontal size={16} />
            </button>

            {menuTaskId === task.id && (
              <div
                className={`absolute right-0 z-10 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg ${
                  index === tasks.length - 1 ? 'bottom-full mb-1' : 'top-full mt-1'
                }`}
              >
                {task.status === 'pending' && (
                  <button type="button" onClick={() => handlePause(task.id)} className={`${MENU_ITEM} text-slate-700`}>
                    <Pause size={14} /> Pause
                  </button>
                )}
                {task.status === 'paused' && (
                  <button type="button" onClick={() => handleResume(task.id)} className={`${MENU_ITEM} text-slate-700`}>
                    <Play size={14} /> Resume
                  </button>
                )}
                <button type="button" onClick={() => handleDelete(task)} className={`${MENU_ITEM} text-red-600`}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
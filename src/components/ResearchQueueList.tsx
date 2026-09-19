import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';

type Props = { userId: string };

export default function ResearchQueueList({ userId }: Props) {
  const tasks = useLiveQuery(
    () => db.researchQueue.where('userId').equals(userId).reverse().sortBy('createdAt'),
    [userId]
  );

  if (!tasks) return null;

  if (tasks.length === 0) {
    return <p className="text-sm text-slate-400">No research tasks yet.</p>;
  }

  return (
    <div className="text-sm">
      {tasks.map((task) => (
        <details key={task.id} className="border-b border-slate-100 py-1.5">
          <summary className="cursor-pointer">
            {task.status === 'pending' ? '⏳' : task.status === 'completed' ? '✅' : '❌'} {task.query}
          </summary>
          {task.status === 'completed' && <p className="mt-1 text-slate-600">{task.result}</p>}
          {task.status === 'failed' && <p className="mt-1 text-red-600">{task.errorMessage}</p>}
        </details>
      ))}
    </div>
  );
}
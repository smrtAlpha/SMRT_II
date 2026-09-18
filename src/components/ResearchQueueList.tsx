import { useEffect, useState } from 'react';
import { db, type ResearchTask } from '../lib/db';

type Props = { userId: string };

export default function ResearchQueueList({ userId }: Props) {
  const [tasks, setTasks] = useState<ResearchTask[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const all = await db.researchQueue.where('userId').equals(userId).reverse().sortBy('createdAt');
      setTasks(all);
    }, 2000);
    return () => clearInterval(interval);
  }, [userId]);

  if (tasks.length === 0) return null;

  return (
    <div className="mb-2 text-sm">
      <h3 className="mb-1 font-medium text-slate-600">Research Queue</h3>
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
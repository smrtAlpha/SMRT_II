import { db } from './db';
import { supabase } from './supabase';

const TASK_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // give up on a task after a week

// Waiting research tasks carry the login token from the moment they were queued, and tokens expire
// after about an hour. This gives waiting tasks a fresh token, then asks the browser to run them.
export async function refreshPendingResearchTasks(userId: string) {
  const pending = await db.researchQueue
    .where('userId')
    .equals(userId)
    .and((task) => task.status === 'pending')
    .toArray();
  if (pending.length === 0) return;

  // Tasks that have waited far too long are marked failed instead of waiting forever.
  const now = Date.now();
  const expiredIds = pending.filter((t) => now - t.createdAt > TASK_EXPIRY_MS).map((t) => t.id);
  for (const id of expiredIds) {
    await db.researchQueue.update(id, {
      status: 'failed',
      errorMessage: 'This task waited over 7 days without running, so it was cancelled. Queue it again.',
      completedAt: now,
    });
  }
  if (expiredIds.length === pending.length) return;

  // getSession() refreshes the login by itself when it has expired.
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  await db.researchQueue
    .where('userId')
    .equals(userId)
    .and((task) => task.status === 'pending')
    .modify({ accessToken: token });

  // Ask the browser to run the waiting tasks now.
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(
      'research-queue-sync'
    );
  }
}
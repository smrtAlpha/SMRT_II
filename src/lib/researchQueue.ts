import { db } from './db';
import { supabase } from './supabase';

export async function queueResearchTask(userId: string, query: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? '';

  await db.researchQueue.add({
    id: crypto.randomUUID(),
    userId,
    query,
    status: 'pending',
    accessToken,
    createdAt: Date.now(),
  });

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    // @ts-expect-error
    await reg.sync.register('research-queue-sync');
    console.log('[App] Background sync registered successfully');
  } else {
    console.warn('[App] Background Sync is not supported in this browser/context');
 }
}
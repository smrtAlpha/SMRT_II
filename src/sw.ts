/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { db } from './lib/db';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as Event & { tag: string; waitUntil: (p: Promise<unknown>) => void };
  console.log('[SW] Sync event received, tag:', syncEvent.tag);
  if (syncEvent.tag === 'research-queue-sync') {
    syncEvent.waitUntil(processResearchQueue());
  }
});

async function processResearchQueue() {
  const pending = await db.researchQueue.where('status').equals('pending').toArray();

  for (const task of pending) {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${task.accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ query: task.query }),
      });

      if (!res.ok) {
  const errBody = await res.text().catch(() => '');
  throw new Error(`Request failed (${res.status}): ${errBody}`);
}
      const { result } = await res.json();

      await db.researchQueue.update(task.id, {
        status: 'completed',
        result,
        completedAt: Date.now(),
      });
      
    } catch (err) {
  // If it's a TypeError (usually a network failure during fetch), throw it so Background Sync retries
  if (err instanceof TypeError) {
    throw err; 
  }

  // Otherwise, it's a permanent error (like 401 Unauthorized), so mark it as failed
  console.error('Research task failed:', task.id, err);
  await db.researchQueue.update(task.id, {
    status: 'failed',
    errorMessage: err instanceof Error ? err.message : 'Unknown error',
    completedAt: Date.now(),
  });
}

  }
}
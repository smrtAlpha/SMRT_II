/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { db } from './lib/db';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// Without this, precacheAndRoute alone won't serve the app shell for an actual page load/reload
// (opening the installed PWA, or refreshing the tab) while offline — it only matches requests for
// exact precached URLs, not the navigation request itself. This is what was causing the white screen.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as Event & { tag: string; waitUntil: (p: Promise<unknown>) => void };
  console.log('[SW] Sync event received, tag:', syncEvent.tag);
  if (syncEvent.tag === 'research-queue-sync') {
    syncEvent.waitUntil(processResearchQueue());
  }
});

// Tapping a notification brings the app to the front and opens the research queue.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(openResearchQueue());
});

async function openResearchQueue() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = windows[0];
  if (existing) {
    await existing.focus();
    existing.postMessage({ type: 'open-queue' });
  } else {
    await self.clients.openWindow('/?queue=1');
  }
}

// Tells you a task finished (or failed) when you're not looking at the app.
async function notifyTaskDone(taskId: string, query: string, status: 'completed' | 'failed') {
  try {
    if (Notification.permission !== 'granted') return;

    // If the app is open and visible, the queue already shows the result.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.some((w) => w.visibilityState === 'visible')) return;

    const short = query.length > 80 ? `${query.slice(0, 80)}…` : query;
    await self.registration.showNotification(
      status === 'completed' ? 'Research finished' : 'Research task failed',
      {
        body: status === 'completed' ? `${short} — tap to read the answer` : `${short} — tap to see what went wrong`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `research-${taskId}`,
      }
    );
  } catch (err) {
    console.error('[SW] Could not show notification:', err);
  }
}

async function processResearchQueue() {
  const pending = await db.researchQueue.where('status').equals('pending').toArray();

  for (const task of pending) {
    // The task may have been paused or deleted since the list was loaded.
    const current = await db.researchQueue.get(task.id);
    if (!current || current.status !== 'pending') continue;

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

      if (res.status === 401) {
        // The login token expired while the task was waiting. Leave the task pending: the app gives it
        // a fresh token the next time it opens, then runs it again.
        console.warn('[SW] Login token expired for task', task.id, '- keeping it pending');
        continue;
      }

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
      await notifyTaskDone(task.id, task.query, 'completed');
    } catch (err) {
      console.error('Research task failed:', task.id, err);
      await db.researchQueue.update(task.id, {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        completedAt: Date.now(),
      });
      await notifyTaskDone(task.id, task.query, 'failed');
    }
  }
}
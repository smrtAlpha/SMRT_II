import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { syncNow } from './cloudSync';

const AUTO_SYNC_INTERVAL_MS = 30_000;

// Drives cross-device sync for real accounts (guests have no other device to sync with).
// Syncs when a real account becomes available, when the connection returns, every 30s in the
// background, whenever the tab regains focus, and on demand via the returned sync().
export function useCloudSync(user: User | null, isOnline: boolean) {
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const inFlight = useRef(false);

  const userId = user?.id ?? null;
  const isRealAccount = user?.is_anonymous === false;

  const sync = useCallback(async () => {
    if (!userId || !isRealAccount || inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);
    const result = await syncNow(userId);
    inFlight.current = false;
    setSyncing(false);
    if (result.ok) {
      setLastError(null);
      setLastSyncedAt(Date.now());
    } else {
      setLastError(result.message);
    }
  }, [userId, isRealAccount]);

  // Sync once when a real account becomes available (sign-in, or already signed in on load).
  useEffect(() => {
    if (userId && isRealAccount) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isRealAccount]);

  // Sync again whenever connectivity comes back.
  const wasOnline = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !wasOnline.current) sync();
    wasOnline.current = isOnline;
  }, [isOnline, sync]);

  // Quietly re-sync every 30s in the background, and whenever the tab regains focus —
  // so changes made on other devices show up here without anyone tapping Sync.
  useEffect(() => {
    if (!userId || !isRealAccount) return;
    const interval = setInterval(() => {
      if (isOnline) sync();
    }, AUTO_SYNC_INTERVAL_MS);
    function handleVisibility() {
      if (document.visibilityState === 'visible' && isOnline) sync();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId, isRealAccount, isOnline, sync]);

  return { syncing, lastError, lastSyncedAt, sync };
}
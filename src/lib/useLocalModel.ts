import { useState, useCallback, useEffect } from 'react';
import { loadLocalModel, isLocalModelReady } from './localModel';

// Set once a download succeeds, so a later page load knows to quietly restore the engine
// from the browser's own cache instead of making you tap "Get Offline AI" all over again.
const READY_FLAG_KEY = 'smrt-offline-ai-downloaded';

function hasDownloadedBefore(): boolean {
  try {
    return localStorage.getItem(READY_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

// Browsers are allowed to quietly delete a site's saved data when the device runs low on space.
// Asking for "persistent" storage tells the browser to keep this site's data (including the
// downloaded offline AI) unless the person clears it themselves. The browser may say no — that's fine.
async function askBrowserToKeepStorage() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // not supported: skip
  }
}

export function useLocalModel() {
  const [isReady, setIsReady] = useState(isLocalModelReady());
  const [isDownloading, setIsDownloading] = useState(false);
  // True from the very first render when this device already has the offline AI, so the
  // "Get Offline AI" button never flashes up while it is being switched back on after a reload.
  const [isRestoring, setIsRestoring] = useState(() => !isLocalModelReady() && hasDownloadedBefore());
  // True when switching it back on from this device's saved copy failed.
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [progressText, setProgressText] = useState('');

  const download = useCallback(async () => {
    if (isReady || isDownloading) return;
    setIsDownloading(true);
    setRestoreFailed(false);
    try {
      await loadLocalModel((report) => {
        setProgressText(report.text);
      });
      setIsReady(true);
      try {
        localStorage.setItem(READY_FLAG_KEY, '1');
      } catch {
        // storage unavailable: skip
      }
      void askBrowserToKeepStorage();
    } catch (err) {
      console.error('Failed to load local model:', err);
      setProgressText('Download failed. Try again when you have a stronger connection.');
    } finally {
      setIsDownloading(false);
    }
  }, [isReady, isDownloading]);

  // If this device has downloaded the offline AI before, silently reload it in the background —
  // the model weights are already cached locally, this just re-creates the in-memory engine,
  // so it's normally fast even though it looks identical to a first-time download from the code.
  useEffect(() => {
    if (isReady || !hasDownloadedBefore()) return;

    let cancelled = false;
    loadLocalModel(() => {})
      .then(() => {
        if (!cancelled) {
          setIsReady(true);
          void askBrowserToKeepStorage();
        }
      })
      .catch((err) => {
        console.error('Restoring the offline AI from cache failed:', err);
        if (!cancelled) setRestoreFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isReady, isDownloading, isRestoring, restoreFailed, progressText, download };
}
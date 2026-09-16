import { useState, useCallback } from 'react';
import { loadLocalModel, isLocalModelReady } from './localModel';

export function useLocalModel() {
  const [isReady, setIsReady] = useState(isLocalModelReady());
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressText, setProgressText] = useState('');

  const download = useCallback(async () => {
    if (isReady || isDownloading) return;
    setIsDownloading(true);
    try {
      await loadLocalModel((report) => {
        setProgressText(report.text);
      });
      setIsReady(true);
    } catch (err) {
      console.error('Failed to load local model:', err);
      setProgressText('Download failed. Try again when you have a stronger connection.');
    } finally {
      setIsDownloading(false);
    }
  }, [isReady, isDownloading]);

  return { isReady, isDownloading, progressText, download };
}

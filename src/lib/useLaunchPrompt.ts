import { useEffect, useRef } from 'react';

// When the app opens and you are not signed in, calls onShow once so the app can offer to sign in.
// - Not while offline (signing in needs the internet).
// - Not again if this tab or app window already showed it (so refreshing doesn't nag you).
export function useLaunchPrompt(options: {
  loading: boolean;
  isGuest: boolean;
  isOnline: boolean;
  onShow: () => void;
}) {
  const { loading, isGuest, isOnline, onShow } = options;
  const checked = useRef(false);

  useEffect(() => {
    if (loading || checked.current) return;
    checked.current = true;
    if (!isGuest || !isOnline) return;
    try {
      if (sessionStorage.getItem('smrt-launch-prompt') === '1') return;
      sessionStorage.setItem('smrt-launch-prompt', '1');
    } catch {
      // storage unavailable: still show it
    }
    onShow();
  }, [loading, isGuest, isOnline, onShow]);
}
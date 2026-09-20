import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';

// Asks permission to show notifications. It has to be triggered by a tap, so it lives in a button.
export default function NotificationToggle() {
  const supported = typeof Notification !== 'undefined';
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied'
  );

  if (!supported) {
    return <p className="mb-3 text-xs text-slate-400">This browser can't show notifications.</p>;
  }

  async function turnOn() {
    setPermission(await Notification.requestPermission());
  }

  if (permission === 'granted') {
    return (
      <p className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
        <BellRing size={14} className="shrink-0" />
        Notifications are on. You'll be told when a research task finishes.
      </p>
    );
  }

  if (permission === 'denied') {
    return (
      <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Notifications are blocked for this site. To get them, allow notifications in your browser's site settings
        (the icon next to the address).
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={turnOn}
      className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
    >
      <Bell size={16} />
      Notify me when a task finishes
    </button>
  );
}
import { Download } from 'lucide-react';
import { usePwaInstall } from '../lib/usePwaInstall';

export default function InstallButton() {
  const { canInstall, promptInstall } = usePwaInstall();

  // Only shows when the browser says SMRT can be installed (hidden once installed).
  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={promptInstall}
      aria-label="Install app"
      className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 sm:px-4"
    >
      <Download size={16} />
      <span className="hidden sm:inline">Install App</span>
    </button>
  );
}
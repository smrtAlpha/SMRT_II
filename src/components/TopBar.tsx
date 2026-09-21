import { Menu, Download, Loader2, RefreshCw, LogIn } from 'lucide-react';
import InstallButton from './InstallButton';
import type { useLocalModel } from '../lib/useLocalModel';

type LocalModel = ReturnType<typeof useLocalModel>;

type Props = {
  localModel: LocalModel;
  isOnline: boolean;
  pendingCount: number;
  onOpenMenu: () => void;
  // The account button on the right: "Sign in" for guests, your initial once signed in.
  email: string | null;
  isGuest: boolean;
  onOpenAccount: () => void;
};

function OfflineAiBadge({ localModel }: { localModel: LocalModel }) {
  if (localModel.isReady) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Offline AI
      </span>
    );
  }

  if (localModel.isDownloading) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
        <Loader2 size={12} className="animate-spin" />
        Downloading…
      </span>
    );
  }

  function handleGet() {
    if (window.confirm('Download the offline AI (about 880 MB)? Best done on Wi-Fi.')) {
      localModel.download();
    }
  }

  return (
    <button
      type="button"
      onClick={handleGet}
      className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50"
    >
      <Download size={12} />
      Get Offline AI
    </button>
  );
}

export default function TopBar({
  localModel,
  isOnline,
  pendingCount,
  onOpenMenu,
  email,
  isGuest,
  onOpenAccount,
}: Props) {
  // The dot on the Sync button reflects real state.
  const syncDot = !isOnline ? 'bg-slate-400' : pendingCount > 0 ? 'bg-amber-500' : 'bg-green-500';
  const syncLabel = !isOnline ? 'Offline' : pendingCount > 0 ? `${pendingCount} queued` : 'All synced';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 md:h-16 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
        >
          <Menu size={20} />
        </button>
        <h2 className="hidden text-xl font-bold text-blue-950 sm:block">SMRT</h2>
        <OfflineAiBadge localModel={localModel} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <InstallButton />

        <button
          type="button"
          title={`${syncLabel} — sync button coming soon`}
          aria-label="Sync"
          className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 sm:px-4"
        >
          <RefreshCw size={16} className="text-blue-600" />
          <span className="hidden sm:inline">Sync</span>
          <span className={`h-2 w-2 rounded-full ${syncDot}`} />
        </button>

        {isGuest ? (
          <button
            type="button"
            onClick={onOpenAccount}
            aria-label="Sign in"
            className="flex h-9 items-center gap-2 rounded-full bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 sm:px-4"
          >
            <LogIn size={16} />
            <span className="hidden sm:inline">Sign in</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAccount}
            aria-label="Account"
            title={email ?? 'Your account'}
            className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white pr-3 pl-1 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 sm:pr-4"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {(email ?? '?').charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-[9rem] truncate sm:inline">{email}</span>
          </button>
        )}
      </div>
    </header>
  );
}
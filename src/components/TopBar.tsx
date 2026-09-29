import { Menu, Download, Loader2, RefreshCw, LogIn, FolderOpen, TriangleAlert, Sun, Moon } from 'lucide-react';
import InstallButton from './InstallButton';
import { useTheme } from '../lib/theme';
import type { useLocalModel } from '../lib/useLocalModel';
import type { useCloudSync } from '../lib/useCloudSync';

type LocalModel = ReturnType<typeof useLocalModel>;
type CloudSync = ReturnType<typeof useCloudSync>;

type Props = {
  localModel: LocalModel;
  isOnline: boolean;
  cloudSync: CloudSync;
  onOpenMenu: () => void;
  // The button on the right: "Sign in" for guests, "Projects" once signed in.
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

export default function TopBar({ localModel, isOnline, cloudSync, onOpenMenu, isGuest, onOpenAccount }: Props) {
  const { isDark, toggle } = useTheme();
  const syncDisabled = isGuest || !isOnline || cloudSync.syncing;

  const syncDot = isGuest
    ? 'bg-slate-300'
    : !isOnline
      ? 'bg-slate-400'
      : cloudSync.syncing
        ? 'bg-blue-500'
        : cloudSync.lastError
          ? 'bg-red-500'
          : 'bg-green-500';

  const syncLabel = isGuest
    ? 'Sign in to sync across devices'
    : !isOnline
      ? 'Offline'
      : cloudSync.syncing
        ? 'Syncing…'
        : cloudSync.lastError
          ? `Sync failed: ${cloudSync.lastError} — tap to retry`
          : cloudSync.lastSyncedAt
            ? 'All synced'
            : 'Not synced yet — tap to sync';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white/75 px-3 backdrop-blur-md md:h-16 md:px-6">
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

        {/* Quick light/dark flip. The two icons cross-fade and turn into each other. Choosing
            "System" (follow the device automatically) is done in Settings. */}
        <button
          type="button"
          onClick={toggle}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
        >
          <Sun
            size={17}
            className={`absolute transition-all duration-300 ${isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'}`}
          />
          <Moon
            size={17}
            className={`absolute transition-all duration-300 ${isDark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
          />
        </button>

        <button
          type="button"
          onClick={cloudSync.sync}
          disabled={syncDisabled}
          title={syncLabel}
          aria-label="Sync"
          className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-60 sm:px-4"
        >
          {cloudSync.syncing ? (
            <RefreshCw size={16} className="animate-spin text-blue-600" />
          ) : cloudSync.lastError ? (
            <TriangleAlert size={16} className="text-red-500" />
          ) : (
            <RefreshCw size={16} className="text-blue-600" />
          )}
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
            title="Projects — coming soon"
            aria-label="Projects"
            className="flex h-9 items-center gap-2 rounded-full bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 sm:px-4"
          >
            <FolderOpen size={16} />
            <span className="hidden sm:inline">Projects</span>
          </button>
        )}
      </div>
    </header>
  );
}
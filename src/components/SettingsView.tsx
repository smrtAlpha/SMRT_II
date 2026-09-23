import type { User } from '@supabase/supabase-js';
import AccountPanel from './AccountPanel';
import type { useLocalModel } from '../lib/useLocalModel';

type Props = {
  user: User | null;
  localModel: ReturnType<typeof useLocalModel>;
  onSignedOut: () => void;
};

export default function SettingsView({ user, localModel, onSignedOut }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 overflow-y-auto py-2">
      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-500">Account</h3>
        <AccountPanel user={user} onClose={() => {}} onSignedOut={onSignedOut} />
      </section>

      <section className="border-t border-slate-200 pt-5">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Offline AI</h3>
        {localModel.isReady ? (
          <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            Downloaded and ready — answers questions with no internet connection.
          </p>
        ) : localModel.isDownloading ? (
          <p className="text-sm text-slate-500">{localModel.progressText || 'Downloading…'}</p>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Download the offline AI (about 880 MB)? Best done on Wi-Fi.')) {
                localModel.download();
              }
            }}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Download offline AI
          </button>
        )}
      </section>
    </div>
  );
}
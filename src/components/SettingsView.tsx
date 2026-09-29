import { Sun, Moon, Monitor } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import AccountPanel from './AccountPanel';
import { useTheme } from '../lib/theme';
import type { ThemePreference } from '../lib/theme';
import type { useLocalModel } from '../lib/useLocalModel';

type Props = {
  user: User | null;
  localModel: ReturnType<typeof useLocalModel>;
  onSignedOut: () => void;
};

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function SettingsView({ user, localModel, onSignedOut }: Props) {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 overflow-y-auto py-2">
      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-500">Account</h3>
        <AccountPanel user={user} onClose={() => {}} onSignedOut={onSignedOut} />
      </section>

      <section className="border-t border-slate-200 pt-5">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Appearance</h3>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={preference === value}
              onClick={() => setPreference(value)}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${
                preference === value
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {preference === 'system'
            ? `Following your device — currently ${resolved}. It switches on its own when your device does.`
            : 'Stays this way regardless of your device. Choose System to follow it automatically.'}
        </p>
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
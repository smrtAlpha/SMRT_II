import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { personName, searchUsers } from '../lib/friends';
import type { Profile } from '../lib/friends';
import { Avatar, INPUT } from './friendsUi';

type Props = {
  // People already chosen / already in the chat, who shouldn't be offered again.
  exclude: Set<string>;
  actionLabel: string;
  onPick: (person: Profile) => void | Promise<void>;
  // Shows a spinner on this person's button while their action is running.
  busyId?: string | null;
  disabled?: boolean;
};

// A search box plus its results, used when adding people to a group.
export default function PersonSearch({ exclude, actionLabel, onPick, busyId = null, disabled = false }: Props) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ q: string; list: Profile[] } | null>(null);
  const [error, setError] = useState('');

  const trimmed = query.trim().replace(/^@/, '').toLowerCase();

  useEffect(() => {
    if (disabled || trimmed.length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await searchUsers(trimmed);
      if (cancelled) return;
      if (result.ok) {
        setFound({ q: trimmed, list: result.data });
        setError('');
      } else {
        setError(result.message);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed, disabled]);

  const results = trimmed.length >= 3 && found?.q === trimmed ? found.list.filter((p) => !exclude.has(p.user_id)) : null;

  return (
    <div>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find people by username"
          aria-label="Find people by username"
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className={`${INPUT} pl-9`}
        />
      </div>

      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {trimmed.length >= 3 && (
        <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
          {results === null ? (
            !error && (
              <p className="flex items-center gap-2 px-1 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Searching...
              </p>
            )
          ) : results.length === 0 ? (
            <p className="px-1 text-sm text-slate-400">No one new found with that username.</p>
          ) : (
            results.map((person) => {
              const name = personName(person.display_name, person.username);
              return (
                <div key={person.user_id} className="flex items-center gap-3 rounded-xl py-1.5 pr-1 pl-2">
                  <Avatar name={name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{name}</span>
                    <span className="block truncate text-xs text-slate-400">@{person.username}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void onPick(person)}
                    disabled={busyId !== null}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                  >
                    {busyId === person.user_id && <Loader2 size={12} className="animate-spin" />}
                    {actionLabel}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
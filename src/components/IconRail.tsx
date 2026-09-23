import { MessageSquare, Users, PenLine, Database, Folder, Settings, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Logo from './Logo';

export type View = 'chat' | 'notes' | 'write' | 'data' | 'files' | 'settings';

type Props = {
  view: View;
  onSelectView: (view: View) => void;
  // null email = guest
  email: string | null;
  isGuest: boolean;
  onOpenAccount: () => void;
};

type RailItem = { view: View; label: string; icon: LucideIcon };

// "notes" is labeled "Friends" — it's slated to become a chat with schoolmates/tutors/lecturers,
// not a notes feature (see the coming-soon copy in App.tsx).
const ITEMS: RailItem[] = [
  { view: 'chat', label: 'Chat', icon: MessageSquare },
  { view: 'notes', label: 'Friends', icon: Users },
  { view: 'write', label: 'Write', icon: PenLine },
  { view: 'data', label: 'Data', icon: Database },
  { view: 'files', label: 'Files', icon: Folder },
  { view: 'settings', label: 'Settings', icon: Settings },
];

export default function IconRail({ view, onSelectView, email, isGuest, onOpenAccount }: Props) {
  return (
    <>
      {/* Tablet and up: vertical rail on the left */}
      <nav className="hidden w-14 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-white py-3 md:flex">
        <Logo size={36} className="mb-3" />

        {ITEMS.map(({ view: itemView, label, icon: Icon }) => (
          <button
            key={itemView}
            type="button"
            onClick={() => onSelectView(itemView)}
            title={label}
            aria-label={label}
            aria-current={view === itemView ? 'page' : undefined}
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              view === itemView ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Icon size={18} />
          </button>
        ))}

        <button
          type="button"
          onClick={onOpenAccount}
          title={isGuest ? 'Guest: tap to create an account or sign in' : (email ?? 'Your account')}
          aria-label="Account"
          className={`mt-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
            isGuest ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isGuest ? <User size={18} /> : (email ?? '?').charAt(0).toUpperCase()}
        </button>
      </nav>

      {/* Phones and narrow tablets: a bottom tab bar instead. Sits last in normal document flow
          (order-last), so it never overlaps the status bar or chat input above it. */}
      <nav
        className="order-last flex shrink-0 items-center justify-around border-t border-slate-200 bg-white py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden"
        aria-label="Sections"
      >
        {ITEMS.map(({ view: itemView, label, icon: Icon }) => (
          <button
            key={itemView}
            type="button"
            onClick={() => onSelectView(itemView)}
            aria-label={label}
            aria-current={view === itemView ? 'page' : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium ${
              view === itemView ? 'text-blue-600' : 'text-slate-500'
            }`}
          >
            <Icon size={19} />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
import { MessageSquare, FileText, PenLine, Database, Folder, Settings, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Logo from './Logo';

type Props = {
  // null email = guest
  email: string | null;
  isGuest: boolean;
  onOpenAccount: () => void;
};

type RailItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

// Only "Chat" is real right now. The rest are visual placeholders.
const ITEMS: RailItem[] = [
  { label: 'Chat', icon: MessageSquare, active: true },
  { label: 'Notes', icon: FileText },
  { label: 'Write', icon: PenLine },
  { label: 'Data', icon: Database },
  { label: 'Files', icon: Folder },
  { label: 'Settings', icon: Settings },
];

export default function IconRail({ email, isGuest, onOpenAccount }: Props) {
  return (
    <nav className="hidden w-14 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-white py-3 md:flex">
      <Logo size={36} className="mb-3" />

      {ITEMS.map(({ label, icon: Icon, active }) => (
        <button
          key={label}
          type="button"
          title={active ? label : `${label} — coming soon`}
          aria-label={label}
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            active ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
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
  );
}
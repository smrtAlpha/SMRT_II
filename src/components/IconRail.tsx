import { MessageSquare, FileText, PenLine, Database, Folder, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Logo from './Logo';

type Props = {
  userId: string;
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

export default function IconRail({ userId }: Props) {
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

      <span
        title={`Session ${userId.slice(0, 8) || 'none'}`}
        className="mt-auto flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700"
      >
        S
      </span>
    </nav>
  );
}
import { Users } from 'lucide-react';

// Shared look for the Friends screens.
export const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm backdrop-blur-sm transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:opacity-50';

export const PRIMARY =
  'flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-900/20 transition-all hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

export const SECONDARY =
  'flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';

export function Avatar({ name, group = false, size = 36 }: { name: string; group?: boolean; size?: number }) {
  const letter = name.replace(/^@/, '').charAt(0).toUpperCase() || '?';
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600"
    >
      {group ? <Users size={Math.round(size * 0.45)} /> : letter}
    </span>
  );
}
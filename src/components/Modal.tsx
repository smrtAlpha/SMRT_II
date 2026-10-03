import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ title, onClose, children }: Props) {
  // Pressing Escape closes the pop-up.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    // Clicking the dimmed backdrop closes it; clicks inside the panel don't.
    <div
      className="fixed inset-0 z-50 flex animate-[fadeIn_0.2s_ease-out] items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Glass panel: a frosted fill, plus a real border and shadow so it stands out on any background. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md animate-[modalIn_0.22s_ease-out] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/90 p-5 backdrop-blur-2xl [box-shadow:inset_0_1px_0_rgba(255,255,255,0.8),0_24px_60px_-16px_rgba(30,64,175,0.35)] dark:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.07),0_24px_60px_-16px_rgba(0,0,0,0.7)]"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
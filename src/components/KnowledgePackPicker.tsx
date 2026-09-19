import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FolderOpen, ChevronDown, Check, GraduationCap, Sparkles, Ban } from 'lucide-react';
import { db } from '../lib/db';
import { NO_PACK, AUTO_PACK } from '../lib/packChoice';

type Props = {
  userId: string;
  selectedPackId: string; // NO_PACK, AUTO_PACK, or a pack id
  onSelect: (id: string) => void;
};

export default function KnowledgePackPicker({ userId, selectedPackId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const packs = useLiveQuery(
    () => db.knowledgePacks.where('userId').equals(userId).reverse().sortBy('timestamp'),
    [userId]
  );

  const usingAuto = selectedPackId === AUTO_PACK;
  // A specific pack, if one is chosen and still exists. If it was deleted, this is null
  // and the picker falls back to showing "no pack".
  const selected = packs?.find((p) => p.id === selectedPackId) ?? null;
  const usingNone = !usingAuto && !selected;

  // While the menu is open: close it on outside tap/click or Escape.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
  }

  const label = usingAuto ? 'Auto (best match)' : selected ? selected.subject : 'Select Knowledge Pack';

  return (
    <div ref={wrapperRef} className="relative col-start-1 min-w-0 justify-self-start">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={label}
        className={`flex h-10 max-w-full min-w-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
          usingNone
            ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            : 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
        }`}
      >
        {usingAuto ? (
          <Sparkles size={16} className="shrink-0 text-amber-500" />
        ) : (
          <FolderOpen size={16} className="shrink-0 text-blue-600" />
        )}
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="max-h-64 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => choose(NO_PACK)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-slate-100"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Ban size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800">No knowledge pack</span>
                <span className="block text-xs text-slate-400">Answer from SMRT's own knowledge only</span>
              </span>
              {usingNone && <Check size={16} className="shrink-0 text-blue-600" />}
            </button>

            <button
              type="button"
              onClick={() => choose(AUTO_PACK)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-slate-100"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Sparkles size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800">Auto (best match)</span>
                <span className="block text-xs text-slate-400">SMRT picks the pack that fits your question</span>
              </span>
              {usingAuto && <Check size={16} className="shrink-0 text-blue-600" />}
            </button>

            {packs?.length === 0 && (
              <p className="px-2.5 py-2 text-xs text-slate-400">
                No packs yet. Add one with the + in the Knowledge Packs list.
              </p>
            )}

            {packs?.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => choose(pack.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-slate-100"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <GraduationCap size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{pack.subject}</span>
                  <span className="block truncate text-xs text-slate-400">{pack.sourceFileName}</span>
                </span>
                {pack.id === selected?.id && <Check size={16} className="shrink-0 text-blue-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { db, type Document } from '../lib/db';
import { deleteDocumentFromCloud } from '../lib/cloudSync';
import { timeAgo } from '../lib/timeAgo';

type Props = { userId: string };

const SAVE_DELAY_MS = 600;

export default function WriteView({ userId }: Props) {
  const documents = useLiveQuery(() => db.documents.where('userId').equals(userId).reverse().sortBy('updatedAt'), [userId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the selected document's current text into the editor whenever the selection changes.
  // (Deliberately not re-run when `documents` changes, so our own debounced saves below don't
  // fight with what's still being typed.)
  useEffect(() => {
    const doc = documents?.find((d) => d.id === selectedId);
    setTitle(doc?.title ?? '');
    setContent(doc?.content ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function scheduleSave(nextTitle: string, nextContent: string) {
    if (!selectedId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      db.documents.update(selectedId, { title: nextTitle, content: nextContent, updatedAt: Date.now() });
    }, SAVE_DELAY_MS);
  }

  async function createDocument() {
    const id = crypto.randomUUID();
    const now = Date.now();
    const doc: Document = { id, userId, title: 'Untitled', content: '', createdAt: now, updatedAt: now };
    await db.documents.add(doc);
    setSelectedId(id);
  }

  async function deleteDocument(id: string) {
    if (!window.confirm('Delete this document?')) return;
    await db.documents.delete(id);
    await deleteDocumentFromCloud(id);
    if (id === selectedId) setSelectedId(null);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Document list: always visible from md up; on narrow screens, hidden once one is open */}
      <div className={`w-full shrink-0 overflow-y-auto border-r border-slate-200 pr-3 md:w-60 ${selectedId ? 'hidden md:block' : 'block'}`}>
        <button
          type="button"
          onClick={createDocument}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          New document
        </button>

        {documents?.length === 0 && <p className="text-sm text-slate-400">No documents yet.</p>}

        <div className="flex flex-col gap-1">
          {documents?.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedId(d.id)}
              className={`flex flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left ${
                d.id === selectedId ? 'bg-blue-100' : 'hover:bg-slate-100'
              }`}
            >
              <span className="w-full truncate text-sm font-medium text-slate-800">{d.title || 'Untitled'}</span>
              <span className="text-xs text-slate-400">{timeAgo(d.updatedAt)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className={`min-w-0 flex-1 flex-col ${selectedId ? 'flex' : 'hidden md:flex'}`}>
        {selectedId ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Back to documents"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 md:hidden"
              >
                <ArrowLeft size={18} />
              </button>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  scheduleSave(e.target.value, content);
                }}
                placeholder="Untitled"
                className="min-w-0 flex-1 border-none text-lg font-semibold text-slate-800 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => deleteDocument(selectedId)}
                aria-label="Delete document"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                scheduleSave(title, e.target.value);
              }}
              placeholder="Start writing…"
              className="min-h-0 flex-1 resize-none border-none text-sm leading-relaxed text-slate-700 focus:outline-none"
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Select a document, or start a new one.
          </div>
        )}
      </div>
    </div>
  );
}
 
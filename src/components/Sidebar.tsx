import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, SquarePen, MessageSquare, MoreHorizontal, X } from 'lucide-react';
import { db } from '../lib/db';
import { timeAgo } from '../lib/timeAgo';
import KnowledgePackList from './KnowledgePackList';

type Props = {
  userId: string;
  activeConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  // Mobile drawer state. On desktop (md and up) the sidebar is always visible.
  open: boolean;
  onClose: () => void;
  // Opens the "Add a knowledge pack" pop-up (handled by App).
  onAddPack: () => void;
};

export default function Sidebar({
  userId,
  activeConversationId,
  onSelectConversation,
  open,
  onClose,
  onAddPack,
}: Props) {
  const conversations = useLiveQuery(
    () => db.conversations.where('userId').equals(userId).reverse().sortBy('updatedAt'),
    [userId]
  );

  // Pick a chat (or start a new one), then close the drawer on mobile.
  function choose(id: string | null) {
    onSelectConversation(id);
    onClose();
  }

  return (
    <>
      {/* Dark backdrop behind the drawer — mobile only */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 transition-transform duration-200 md:static md:z-auto md:w-64 md:max-w-none md:shrink-0 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-950">SMRT</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Search chats — coming soon"
              aria-label="Search chats"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"
            >
              <Search size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 md:hidden"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => choose(null)}
          className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          New Chat
          <SquarePen size={14} className="opacity-80" />
        </button>

        <h3 className="mb-2 text-sm font-medium text-slate-500">Recent Chats</h3>
        {conversations?.length === 0 && <p className="text-sm text-slate-400">No chats yet</p>}

        <div className="flex flex-col gap-1">
          {conversations?.map((c) => (
            <div key={c.id} className="group relative">
              <button
                type="button"
                onClick={() => choose(c.id)}
                className={`flex w-full items-center gap-3 rounded-xl py-2 pr-9 pl-2.5 text-left ${
                  c.id === activeConversationId ? 'bg-blue-100' : 'hover:bg-slate-100'
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <MessageSquare size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {c.title || 'Untitled chat'}
                  </span>
                  <span className="block text-xs text-slate-400">{timeAgo(c.updatedAt)}</span>
                </span>
              </button>
              <button
                type="button"
                title="Chat options — coming soon"
                aria-label="Chat options"
                className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200"
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <KnowledgePackList
            userId={userId}
            onAdd={() => {
              onClose();
              onAddPack();
            }}
          />
        </div>
      </aside>
    </>
  );
}
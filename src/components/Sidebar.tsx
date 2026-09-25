import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, SquarePen, MessageSquare, MoreHorizontal, Pencil, Trash2, User, X, Download, Loader2 } from 'lucide-react';
import { db } from '../lib/db';
import { timeAgo } from '../lib/timeAgo';
import { renameConversation, deleteConversation, MAX_TITLE_LENGTH } from '../lib/chatActions';
import { syncChatOffline } from '../lib/chatSync';
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
  // The account button shown at the bottom on phones (on bigger screens it is on the icon strip).
  email: string | null;
  isGuest: boolean;
  onOpenAccount: () => void;
};

// Where the open "..." menu sits on the screen.
type MenuPosition = { id: string; top: number; left: number };

const MENU_WIDTH = 144;
const MENU_HEIGHT = 124;

export default function Sidebar({
  userId,
  activeConversationId,
  onSelectConversation,
  open,
  onClose,
  onAddPack,
  email,
  isGuest,
  onOpenAccount,
}: Props) {
  const conversations = useLiveQuery(
    () => db.conversations.where('userId').equals(userId).reverse().sortBy('updatedAt'),
    [userId]
  );

  // Which chat's "..." menu is open, and which chat is being renamed.
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const skipBlurSave = useRef(false);
  // Which chat is currently being turned into an offline Knowledge Pack.
  const [syncingId, setSyncingId] = useState<string | null>(null);
  // Search: filters the chat list below by title while open.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // While a menu is open: close it when you tap somewhere else, press Escape, scroll, or resize.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    function handlePointerDown(e: PointerEvent) {
      if (!(e.target as HTMLElement).closest('[data-chat-menu]')) close();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('scroll', close, true); // true: also catches scrolling inside the chat list
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  // Pick a chat (or start a new one), then close the drawer on mobile.
  function choose(id: string | null) {
    setMenu(null);
    onSelectConversation(id);
    onClose();
  }

  // The menu is drawn on top of everything (not inside the scrolling list), so it never gets cut off.
  function toggleMenu(id: string, button: HTMLElement) {
    if (menu?.id === id) {
      setMenu(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const roomBelow = window.innerHeight - rect.bottom;
    const top = roomBelow < MENU_HEIGHT + 8 ? rect.top - MENU_HEIGHT - 4 : rect.bottom + 4;
    setMenu({ id, top, left });
  }

  function startRename(id: string, title: string) {
    setMenu(null);
    setDraft(title);
    setEditingId(id);
  }

  async function saveRename(id: string) {
    setEditingId(null);
    await renameConversation(id, draft); // an empty name is ignored, so the old one stays
  }

  async function handleDelete(id: string, title: string) {
    setMenu(null);
    const name = title || 'Untitled chat';
    if (!window.confirm(`Delete "${name}"? This removes its messages and attached files.`)) return;
    await deleteConversation(userId, id);
    if (id === activeConversationId) onSelectConversation(null);
  }

  async function handleSync(id: string) {
    setMenu(null);
    setSyncingId(id);
    const result = await syncChatOffline(userId, id);
    setSyncingId(null);
    if (!result.ok) {
      window.alert(result.message);
    }
  }

  const menuChat = menu ? conversations?.find((c) => c.id === menu.id) : undefined;

  const visibleConversations = searchQuery.trim()
    ? conversations?.filter((c) => (c.title || 'Untitled chat').toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : conversations;

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
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
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col overflow-hidden border-r border-slate-200 bg-slate-50 p-4 transition-transform duration-200 md:static md:z-auto md:w-64 md:max-w-none md:shrink-0 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h1 className="text-xl font-bold text-blue-950">SMRT</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              title="Search chats"
              aria-label="Search chats"
              aria-pressed={searchOpen}
              className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-200 ${
                searchOpen ? 'bg-slate-200 text-slate-700' : 'text-slate-500'
              }`}
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

        {searchOpen && (
          <div className="relative mb-3 shrink-0">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeSearch();
              }}
              placeholder="Search chats by title"
              aria-label="Search chats"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-2 pl-8 text-sm focus:border-blue-300 focus:outline-none"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => choose(null)}
          className="mb-4 flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          New Chat
          <SquarePen size={14} className="opacity-80" />
        </button>

        {/* The two lists share the space that is left: chats take about 68%, knowledge packs about 32%.
            Each one scrolls on its own. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <section className="flex min-h-0 flex-[68] flex-col">
            <h3 className="mb-2 shrink-0 text-sm font-medium text-slate-500">Recent Chats</h3>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {visibleConversations?.length === 0 && (
                <p className="text-sm text-slate-400">
                  {searchQuery.trim() ? `No chats match "${searchQuery.trim()}"` : 'No chats yet'}
                </p>
              )}

              <div className="flex flex-col gap-1">
                {visibleConversations?.map((c) => (
                  <div key={c.id} className="group relative" data-chat-menu>
                    {editingId === c.id ? (
                      <div className="flex items-center gap-3 rounded-xl bg-blue-50 py-2 pr-2 pl-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-blue-600">
                          <MessageSquare size={16} />
                        </span>
                        <input
                          autoFocus
                          value={draft}
                          maxLength={MAX_TITLE_LENGTH}
                          aria-label="Chat name"
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(c.id);
                            if (e.key === 'Escape') {
                              skipBlurSave.current = true;
                              setEditingId(null);
                            }
                          }}
                          onBlur={() => {
                            if (skipBlurSave.current) {
                              skipBlurSave.current = false;
                              return;
                            }
                            saveRename(c.id);
                          }}
                          className="min-w-0 flex-1 rounded-md border border-blue-300 bg-white px-2 py-1 text-sm text-slate-800 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <>
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
                            <span className="block text-xs text-slate-400">
                              {syncingId === c.id ? 'Syncing for offline…' : timeAgo(c.updatedAt)}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => toggleMenu(c.id, e.currentTarget)}
                          disabled={syncingId === c.id}
                          aria-label="Chat options"
                          aria-expanded={menu?.id === c.id}
                          className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 disabled:opacity-60"
                        >
                          {syncingId === c.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <MoreHorizontal size={16} />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-3 flex min-h-0 flex-[32] flex-col border-t border-slate-200 pt-3">
            <KnowledgePackList
              userId={userId}
              onAdd={() => {
                onClose();
                onAddPack();
              }}
            />
          </section>
        </div>

        {/* Account: phones only. On bigger screens it lives on the icon strip. */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenAccount();
          }}
          className="mt-3 flex shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:bg-slate-100 md:hidden"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              isGuest ? 'bg-slate-200 text-slate-600' : 'bg-blue-600 text-white'
            }`}
          >
            {isGuest ? <User size={16} /> : (email ?? '?').charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-slate-800">
              {isGuest ? 'Guest' : email}
            </span>
            <span className="block text-xs text-slate-500">
              {isGuest ? 'Create an account or sign in' : 'Your account'}
            </span>
          </span>
        </button>
      </aside>

      {menu &&
        menuChat &&
        createPortal(
          <div
            data-chat-menu
            style={{ position: 'fixed', top: menu.top, left: menu.left, width: MENU_WIDTH }}
            className="z-50 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          >
            <button
              type="button"
              onClick={() => startRename(menuChat.id, menuChat.title)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              <Pencil size={14} /> Rename
            </button>
            <button
              type="button"
              onClick={() => handleSync(menuChat.id)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              <Download size={14} /> Sync for offline
            </button>
            <button
              type="button"
              onClick={() => handleDelete(menuChat.id, menuChat.title)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-600 hover:bg-slate-100"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
import { useLiveQuery } from 'dexie-react-hooks';
import { Zap, Plus, MessageSquare } from 'lucide-react';
import { db } from '../lib/db';

type Props = {
  userId: string;
  activeConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
};

export default function Sidebar({ userId, activeConversationId, onSelectConversation }: Props) {
  const conversations = useLiveQuery(
    () => db.conversations.where('userId').equals(userId).reverse().sortBy('updatedAt'),
    [userId]
  );

  return (
    <div className="flex w-64 flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
          <Zap size={16} />
        </span>
        <h1 className="text-lg font-bold text-slate-900">SMRT</h1>
      </div>

      <button
        onClick={() => onSelectConversation(null)}
        className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700"
      >
        <Plus size={16} />
        New Chat
      </button>

      <div>
        <h3 className="mb-2 text-xs font-medium text-slate-400">Recent Chats</h3>
        {conversations?.length === 0 && <p className="text-sm text-slate-400">No chats yet</p>}
        <div className="flex flex-col gap-1">
          {conversations?.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectConversation(c.id)}
              className={`flex items-center gap-2 truncate rounded-lg px-2 py-2 text-left text-sm ${
                c.id === activeConversationId
                  ? 'bg-blue-100 font-medium text-blue-900'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <MessageSquare size={14} className="flex-shrink-0 text-slate-400" />
              <span className="truncate">{c.title || 'Untitled chat'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
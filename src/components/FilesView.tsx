import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Trash2, MessageSquare } from 'lucide-react';
import { db } from '../lib/db';
import { timeAgo } from '../lib/timeAgo';

type Props = {
  userId: string;
  // Jumps to the chat an attachment belongs to (switches to the Chat view and opens it).
  onOpenConversation: (id: string) => void;
};

export default function FilesView({ userId, onOpenConversation }: Props) {
  const packs = useLiveQuery(() => db.knowledgePacks.where('userId').equals(userId).reverse().sortBy('timestamp'), [userId]);
  const attachments = useLiveQuery(() => db.attachments.where('userId').equals(userId).reverse().sortBy('timestamp'), [userId]);
  const conversations = useLiveQuery(() => db.conversations.where('userId').equals(userId).toArray(), [userId]);
  const titleById = new Map((conversations ?? []).map((c) => [c.id, c.title || 'Untitled chat']));

  async function deletePack(id: string) {
    if (!window.confirm('Delete this knowledge pack? This does not delete the chat it came from, if any.')) return;
    await db.knowledgePacks.delete(id);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto py-2">
      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-500">Knowledge Packs</h3>
        {packs?.length === 0 && <p className="text-sm text-slate-400">None yet — upload a file or sync a chat to add one.</p>}
        <div className="flex flex-col gap-2">
          {packs?.map((p) => (
            <div key={p.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <FileText size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{p.subject}</p>
                <p className="line-clamp-2 text-xs text-slate-500">{p.summary}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {p.sourceConversationId ? 'From a chat' : p.sourceFileName} · {timeAgo(p.timestamp)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deletePack(p.id)}
                aria-label="Delete pack"
                className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Attachments</h3>
        {attachments?.length === 0 && <p className="text-sm text-slate-400">None yet — attach a file to a chat to see it here.</p>}
        <div className="flex flex-col gap-2">
          {attachments?.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpenConversation(a.conversationId)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <MessageSquare size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{a.fileName}</p>
                <p className="truncate text-xs text-slate-400">
                  In "{titleById.get(a.conversationId) ?? 'a chat'}" · {timeAgo(a.timestamp)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
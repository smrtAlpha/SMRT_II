import { useLiveQuery } from 'dexie-react-hooks';
import { MessageSquare, FileText, Paperclip, Sparkles, Brain, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { db } from '../lib/db';
import { timeAgo } from '../lib/timeAgo';

type Props = { userId: string };

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Icon size={18} />
      </span>
      <div>
        <p className="text-xl font-semibold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function DataView({ userId }: Props) {
  const conversations = useLiveQuery(() => db.conversations.where('userId').equals(userId).toArray(), [userId]);
  // Messages have no userId index, so this scans and filters (same approach used in cloudSync.ts).
  const messages = useLiveQuery(() => db.messages.toCollection().filter((m) => m.userId === userId).toArray(), [userId]);
  const packs = useLiveQuery(() => db.knowledgePacks.where('userId').equals(userId).toArray(), [userId]);
  const attachmentCount = useLiveQuery(() => db.attachments.where('userId').equals(userId).count(), [userId]) ?? 0;
  const memories = useLiveQuery(() => db.userMemory.where('userId').equals(userId).reverse().sortBy('timestamp'), [userId]);

  const chatCount = conversations?.length ?? 0;
  const userMessages = messages?.filter((m) => m.role === 'user').length ?? 0;
  const assistantMessages = messages?.filter((m) => m.role === 'assistant').length ?? 0;
  const packCount = packs?.length ?? 0;
  const packsFromChat = packs?.filter((p) => p.sourceConversationId).length ?? 0;
  const packsFromFile = packCount - packsFromChat;

  const oldestConversation = conversations?.reduce<number | null>(
    (min, c) => (min === null || c.createdAt < min ? c.createdAt : min),
    null
  );
  const latestActivity = conversations?.reduce<number | null>(
    (max, c) => (max === null || c.updatedAt > max ? c.updatedAt : max),
    null
  );

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto py-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={MessageSquare} label="Chats" value={chatCount} />
        <StatCard icon={Sparkles} label="Messages" value={userMessages + assistantMessages} />
        <StatCard icon={FileText} label="Knowledge Packs" value={packCount} />
        <StatCard icon={Paperclip} label="Attachments" value={attachmentCount} />
      </div>

      <section className="rounded-xl border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Messages</h3>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span>{userMessages} sent</span>
          <span>{assistantMessages} answered</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Knowledge Packs</h3>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span>{packsFromFile} from files</span>
          <span>{packsFromChat} from synced chats</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Activity</h3>
        <p className="text-sm text-slate-600">
          {chatCount === 0
            ? 'No chats yet.'
            : `First chat ${oldestConversation ? timeAgo(oldestConversation) : '—'}, most recent activity ${
                latestActivity ? timeAgo(latestActivity) : '—'
              }.`}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <Brain size={14} />
          What SMRT remembers about you
        </h3>
        {memories?.length === 0 && (
          <p className="text-sm text-slate-400">Nothing yet — say something like "my name is..." in a chat.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {memories?.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-700">{m.fact}</span>
              <button
                type="button"
                onClick={() => db.userMemory.delete(m.id)}
                aria-label="Forget this"
                className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
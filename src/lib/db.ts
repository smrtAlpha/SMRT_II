import Dexie, { type Table } from 'dexie';

export interface QARecord {
  id: string;
  userId: string;
  question: string;
  answer: string;
  timestamp: number;
}

export interface KnowledgePack {
  id: string;
  userId: string;
  subject: string;
  sourceFileName: string;
  summary: string;
  timestamp: number;
  // Set when this pack was made by syncing a chat, rather than uploading a file.
  sourceConversationId?: string;
}

export interface ResearchTask {
  id: string;
  userId: string;
  query: string;
  status: 'pending' | 'paused' | 'completed' | 'failed';
  result?: string;
  errorMessage?: string;
  accessToken: string;
  createdAt: number;
  completedAt?: number;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachmentNames?: string[];
  failed?: boolean;
}

export interface Attachment {
  id: string;
  conversationId: string;
  userId: string;
  fileName: string;
  text: string;
  timestamp: number;
}

export interface Document {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserMemory {
  id: string;
  userId: string;
  kind: 'name' | 'location' | 'age' | 'occupation' | 'note';
  fact: string;
  timestamp: number;
}

class SmrtDatabase extends Dexie {
  qaHistory!: Table<QARecord, string>;
  knowledgePacks!: Table<KnowledgePack, string>;
  researchQueue!: Table<ResearchTask, string>;
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, string>;
  attachments!: Table<Attachment, string>;
  documents!: Table<Document, string>;
  userMemory!: Table<UserMemory, string>;

  constructor() {
    super('smrt-db');
    this.version(1).stores({
      qaHistory: 'id, userId, timestamp',
    });
    this.version(2).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
    });
    this.version(3).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
      researchQueue: 'id, userId, status, createdAt',
    });
    this.version(4).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
      researchQueue: 'id, userId, status, createdAt',
      conversations: 'id, userId, updatedAt',
      messages: 'id, conversationId, timestamp',
    });
    this.version(5).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
      researchQueue: 'id, userId, status, createdAt',
      conversations: 'id, userId, updatedAt',
      messages: 'id, conversationId, timestamp',
      attachments: 'id, conversationId, userId, timestamp',
    });
    // v6: no new index needed — sourceConversationId is just an optional field read/written as-is.
    this.version(6).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
      researchQueue: 'id, userId, status, createdAt',
      conversations: 'id, userId, updatedAt',
      messages: 'id, conversationId, timestamp',
      attachments: 'id, conversationId, userId, timestamp',
    });
    // v7: adds documents, for the Write feature (separate from chats).
    this.version(7).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
      researchQueue: 'id, userId, status, createdAt',
      conversations: 'id, userId, updatedAt',
      messages: 'id, conversationId, timestamp',
      attachments: 'id, conversationId, userId, timestamp',
      documents: 'id, userId, updatedAt',
    });
    // v8: adds userMemory — facts (name, location, etc.) that apply across every chat, not just one.
    this.version(8).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
      researchQueue: 'id, userId, status, createdAt',
      conversations: 'id, userId, updatedAt',
      messages: 'id, conversationId, timestamp',
      attachments: 'id, conversationId, userId, timestamp',
      documents: 'id, userId, updatedAt',
      userMemory: 'id, userId, kind, timestamp',
    });
  }
}

export const db = new SmrtDatabase();

// Wipes every local table. Used on sign-out so nothing from the session that just ended
// (chats, knowledge packs, attachments, etc.) is still sitting in IndexedDB afterwards —
// important on a shared device, since the next guest session should start from nothing.
export async function wipeLocalData(): Promise<void> {
  await db.transaction('rw', db.tables, () => Promise.all(db.tables.map((t) => t.clear())));
}

// Deletes just one user's rows, leaving everyone else's local data alone. Used when someone
// declines to add their guest chats to the account they just signed into — those guest rows
// get burned instead of sitting around unreachable.
export async function wipeUserData(userId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.qaHistory, db.knowledgePacks, db.researchQueue, db.conversations, db.messages, db.attachments, db.documents, db.userMemory],
    async () => {
      await db.conversations.where('userId').equals(userId).delete();
      await db.qaHistory.where('userId').equals(userId).delete();
      await db.knowledgePacks.where('userId').equals(userId).delete();
      await db.researchQueue.where('userId').equals(userId).delete();
      await db.attachments.where('userId').equals(userId).delete();
      await db.documents.where('userId').equals(userId).delete();
      await db.userMemory.where('userId').equals(userId).delete();
      // Messages don't have an index on userId, so look through them all.
      await db.messages
        .toCollection()
        .filter((m) => m.userId === userId)
        .delete();
    }
  );
}
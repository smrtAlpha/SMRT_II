import Dexie, { type Table } from 'dexie';
import type { ChatSummary } from './friends';

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

// A message in a Friends chat, saved on this device so the chat opens instantly and can be read offline.
export interface FriendMessage {
  id: string;
  chatId: string;
  // Whose device copy this is (the signed-in person), so a sign-out can wipe exactly their copy.
  userId: string;
  // Who wrote it. null = that person has since deleted their account.
  senderId: string | null;
  // The writer's name as last seen, so a group chat can still show who said what while offline.
  senderName?: string;
  body: string;
  // The earlier message this one answers (empty if it isn't a reply).
  replyToId?: string | null;
  createdAt: number;
}

// A Friends message that has been written but not yet accepted by the server (usually because
// there's no connection). Its id is also the message's id on the server, so sending it twice
// can never create a duplicate.
export interface FriendOutboxItem {
  id: string;
  chatId: string;
  userId: string;
  body: string;
  replyToId?: string | null;
  createdAt: number;
  // Set if the server refused it (blocked, sending too fast...). It then waits for Retry or Delete.
  error?: string;
}

// Someone you've blocked (saved so their messages stay hidden in groups even offline).
export interface FriendBlockRow {
  userId: string;
  blockedId: string;
  name: string;
  createdAt: number;
}

// Text typed into a Friends chat but not sent yet, so a reload doesn't lose it.
export interface FriendDraft {
  chatId: string;
  userId: string;
  text: string;
  updatedAt: number;
}

// The Friends chat list as last loaded, so Friends still opens (and shows your chats) offline.
export interface FriendChatRow extends ChatSummary {
  userId: string;
}

// Your own Friends username, saved so Friends doesn't need the internet just to know who you are.
export interface FriendProfileRow {
  userId: string;
  username: string;
  displayName: string | null;
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
  friendMessages!: Table<FriendMessage, string>;
  friendOutbox!: Table<FriendOutboxItem, string>;
  friendChats!: Table<FriendChatRow, string>;
  friendProfiles!: Table<FriendProfileRow, string>;
  friendDrafts!: Table<FriendDraft, string>;
  friendBlocks!: Table<FriendBlockRow, [string, string]>;

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
    // v9: Friends — a saved copy of chat messages, and messages waiting to be sent.
    this.version(9).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
      researchQueue: 'id, userId, status, createdAt',
      conversations: 'id, userId, updatedAt',
      messages: 'id, conversationId, timestamp',
      attachments: 'id, conversationId, userId, timestamp',
      documents: 'id, userId, updatedAt',
      userMemory: 'id, userId, kind, timestamp',
      friendMessages: 'id, userId, chatId, createdAt',
      friendOutbox: 'id, userId, chatId, createdAt',
    });
    // v10: Friends — the saved chat list and your own username, for opening Friends offline.
    this.version(10).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
      researchQueue: 'id, userId, status, createdAt',
      conversations: 'id, userId, updatedAt',
      messages: 'id, conversationId, timestamp',
      attachments: 'id, conversationId, userId, timestamp',
      documents: 'id, userId, updatedAt',
      userMemory: 'id, userId, kind, timestamp',
      friendMessages: 'id, userId, chatId, createdAt',
      friendOutbox: 'id, userId, chatId, createdAt',
      friendChats: 'chat_id, userId',
      friendProfiles: 'userId',
    });
    // v11: Friends — unsent message drafts.
    this.version(11).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
      researchQueue: 'id, userId, status, createdAt',
      conversations: 'id, userId, updatedAt',
      messages: 'id, conversationId, timestamp',
      attachments: 'id, conversationId, userId, timestamp',
      documents: 'id, userId, updatedAt',
      userMemory: 'id, userId, kind, timestamp',
      friendMessages: 'id, userId, chatId, createdAt',
      friendOutbox: 'id, userId, chatId, createdAt',
      friendChats: 'chat_id, userId',
      friendProfiles: 'userId',
      friendDrafts: 'chatId, userId',
    });
    // v12: Friends — people you've blocked.
    this.version(12).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
      researchQueue: 'id, userId, status, createdAt',
      conversations: 'id, userId, updatedAt',
      messages: 'id, conversationId, timestamp',
      attachments: 'id, conversationId, userId, timestamp',
      documents: 'id, userId, updatedAt',
      userMemory: 'id, userId, kind, timestamp',
      friendMessages: 'id, userId, chatId, createdAt',
      friendOutbox: 'id, userId, chatId, createdAt',
      friendChats: 'chat_id, userId',
      friendProfiles: 'userId',
      friendDrafts: 'chatId, userId',
      friendBlocks: '[userId+blockedId], userId',
    });
  }
}

export const db = new SmrtDatabase();

// If another tab opens with a newer version of this database (e.g. after a redeploy), IndexedDB
// blocks that tab's upgrade until every other open connection is closed. Without this, an older
// tab left open would silently block a newer tab forever — the newer tab just stays blank, with
// no error, since it's not stuck failing, just stuck waiting. Closing here lets the other tab
// proceed immediately, and reloading brings this tab's own code up to date too.
db.on('versionchange', () => {
  db.close();
  window.location.reload();
});

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
    [
      db.qaHistory,
      db.knowledgePacks,
      db.researchQueue,
      db.conversations,
      db.messages,
      db.attachments,
      db.documents,
      db.userMemory,
      db.friendMessages,
      db.friendOutbox,
      db.friendChats,
      db.friendProfiles,
      db.friendDrafts,
      db.friendBlocks,
    ],
    async () => {
      await db.conversations.where('userId').equals(userId).delete();
      await db.qaHistory.where('userId').equals(userId).delete();
      await db.knowledgePacks.where('userId').equals(userId).delete();
      await db.researchQueue.where('userId').equals(userId).delete();
      await db.attachments.where('userId').equals(userId).delete();
      await db.documents.where('userId').equals(userId).delete();
      await db.userMemory.where('userId').equals(userId).delete();
      await db.friendMessages.where('userId').equals(userId).delete();
      await db.friendOutbox.where('userId').equals(userId).delete();
      await db.friendChats.where('userId').equals(userId).delete();
      await db.friendProfiles.where('userId').equals(userId).delete();
      await db.friendDrafts.where('userId').equals(userId).delete();
      await db.friendBlocks.where('userId').equals(userId).delete();
      // Messages don't have an index on userId, so look through them all.
      await db.messages
        .toCollection()
        .filter((m) => m.userId === userId)
        .delete();
    }
  );
}
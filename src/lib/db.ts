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
}

export interface ResearchTask {
  id: string;
  userId: string;
  query: string;
  status: 'pending' | 'completed' | 'failed';
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
  // Names of files attached to this message (user messages only)
  attachmentNames?: string[];
}

// A file the user attached to one specific chat. `text` is the extracted text of the file.
export interface Attachment {
  id: string;
  conversationId: string;
  userId: string;
  fileName: string;
  text: string;
  timestamp: number;
}

class SmrtDatabase extends Dexie {
  qaHistory!: Table<QARecord, string>;
  knowledgePacks!: Table<KnowledgePack, string>;
  researchQueue!: Table<ResearchTask, string>;
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, string>;
  attachments!: Table<Attachment, string>;

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
  }
}

export const db = new SmrtDatabase();
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

class SmrtDatabase extends Dexie {
  qaHistory!: Table<QARecord, string>;
  knowledgePacks!: Table<KnowledgePack, string>;

  constructor() {
    super('smrt-db');
    this.version(1).stores({
      qaHistory: 'id, userId, timestamp',
    });
    this.version(2).stores({
      qaHistory: 'id, userId, timestamp',
      knowledgePacks: 'id, userId, subject, timestamp',
    });
  }
}

export const db = new SmrtDatabase();
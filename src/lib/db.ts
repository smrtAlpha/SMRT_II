import Dexie, { type Table } from 'dexie';

export interface QARecord {
  id: string;
  userId: string;
  question: string;
  answer: string;
  timestamp: number;
}

class SmrtDatabase extends Dexie {
  qaHistory!: Table<QARecord, string>;

  constructor() {
    super('smrt-db');
    this.version(1).stores({
      qaHistory: 'id, userId, timestamp',
    });
  }
}

export const db = new SmrtDatabase();
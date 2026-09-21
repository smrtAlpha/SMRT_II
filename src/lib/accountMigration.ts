import { db } from './db';

// When you sign in to an account you already had, the chats made on this device as a guest belong to
// your old guest ID. This moves them over to the account, so they don't seem to vanish.
// Returns how many chats were moved.
export async function migrateLocalData(fromUserId: string, toUserId: string): Promise<number> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return 0;

  return db.transaction(
    'rw',
    [db.qaHistory, db.knowledgePacks, db.researchQueue, db.conversations, db.messages, db.attachments],
    async () => {
      const chats = await db.conversations.where('userId').equals(fromUserId).modify({ userId: toUserId });
      await db.qaHistory.where('userId').equals(fromUserId).modify({ userId: toUserId });
      await db.knowledgePacks.where('userId').equals(fromUserId).modify({ userId: toUserId });
      await db.researchQueue.where('userId').equals(fromUserId).modify({ userId: toUserId });
      await db.attachments.where('userId').equals(fromUserId).modify({ userId: toUserId });
      // Messages don't have an index on userId, so look through them all.
      await db.messages
        .toCollection()
        .filter((m) => m.userId === fromUserId)
        .modify({ userId: toUserId });
      return chats;
    }
  );
}
import { db } from './db';

function generateTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  return trimmed.length > 40 ? trimmed.slice(0, 40) + '…' : trimmed;
}

export async function createConversation(userId: string, firstMessage: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.conversations.add({
    id,
    userId,
    title: generateTitle(firstMessage),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
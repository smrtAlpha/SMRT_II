import { db } from './db';
import { deleteConversationFromCloud } from './cloudSync';

export const MAX_TITLE_LENGTH = 80;

// Gives a chat a new name. Returns false (and changes nothing) if the new name is empty.
// The chat keeps its place in the list: renaming doesn't count as new activity.
export async function renameConversation(id: string, title: string): Promise<boolean> {
  const clean = title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!clean) return false;
  await db.conversations.update(id, { title: clean });
  return true;
}

// Deletes a chat completely: its messages, its attached files, and the saved offline answers
// to the questions asked in it. Everything happens together, or not at all.
export async function deleteConversation(userId: string, id: string) {
  await db.transaction('rw', [db.conversations, db.messages, db.attachments, db.qaHistory], async () => {
    const messages = await db.messages.where('conversationId').equals(id).toArray();
    const questions = new Set(messages.filter((m) => m.role === 'user').map((m) => m.content));

    await db.messages.where('conversationId').equals(id).delete();
    await db.attachments.where('conversationId').equals(id).delete();
    if (questions.size > 0) {
      await db.qaHistory
        .where('userId')
        .equals(userId)
        .filter((record) => questions.has(record.question))
        .delete();
    }
    await db.conversations.delete(id);
  });

  // Best-effort — if this device is offline, the cloud copy just won't be cleaned up until
  // it's deleted from wherever it's reachable next. It won't undo the local delete either way.
  deleteConversationFromCloud(id);
}
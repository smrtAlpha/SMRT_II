import { db } from './db';
import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-pack`;

export type SyncResult = { ok: true } | { ok: false; message: string };

// Turns a chat into a Knowledge Pack (same summarize pipeline as file uploads)
// so the offline model can reference it later, and it shows up in the
// Knowledge Packs list where it can be deleted like any other pack.
export async function syncChatOffline(userId: string, conversationId: string): Promise<SyncResult> {
  const conversation = await db.conversations.get(conversationId);
  if (!conversation) {
    return { ok: false, message: 'Chat not found.' };
  }

  const messages = await db.messages.where('conversationId').equals(conversationId).sortBy('timestamp');
  if (messages.length === 0) {
    return { ok: false, message: 'This chat has no messages yet.' };
  }

  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const title = conversation.title || 'Untitled chat';

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ text: transcript }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const message = typeof data?.error === 'string' ? data.error : `Sync failed (${res.status})`;
      return { ok: false, message };
    }

    const { summary } = await res.json();

    // Re-syncing the same chat replaces its earlier pack instead of piling up duplicates.
    const existing = await db.knowledgePacks
      .where('userId')
      .equals(userId)
      .filter((p) => p.sourceConversationId === conversationId)
      .first();
    if (existing) {
      await db.knowledgePacks.delete(existing.id);
    }

    await db.knowledgePacks.add({
      id: crypto.randomUUID(),
      userId,
      subject: title,
      sourceFileName: `Chat: ${title}`,
      summary,
      timestamp: Date.now(),
      sourceConversationId: conversationId,
    });

    return { ok: true };
  } catch (err) {
    console.error('Chat sync failed:', err);
    return { ok: false, message: err instanceof Error ? err.message : 'Something went wrong.' };
  }
}
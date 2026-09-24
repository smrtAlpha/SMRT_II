import { db } from './db';
import { supabase } from './supabase';

export type SyncResult = { ok: true; pulled: number; pushed: number } | { ok: false; message: string };

type CloudConversation = { id: string; user_id: string; title: string; created_at: number; updated_at: number };
type CloudMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachment_names: string[] | null;
  failed: boolean;
};
type CloudAttachment = {
  id: string;
  conversation_id: string;
  user_id: string;
  file_name: string;
  text: string;
  timestamp: number;
};
type CloudKnowledgePack = {
  id: string;
  user_id: string;
  subject: string;
  source_file_name: string;
  summary: string;
  timestamp: number;
  source_conversation_id: string | null;
};
type CloudDocument = { id: string; user_id: string; title: string; content: string; created_at: number; updated_at: number };

// Pulls whatever is newer from the cloud into Dexie, then pushes whatever is newer locally
// up to the cloud (last write wins, compared by updatedAt/timestamp). Messages and attachments
// never change once created, so those are just "add whatever the other side doesn't have yet".
export async function syncNow(userId: string): Promise<SyncResult> {
  try {
    let pulled = 0;
    let pushed = 0;

    // ---- Conversations ----
    const [localConvos, { data: cloudConvosRaw, error: convoErr }] = await Promise.all([
      db.conversations.where('userId').equals(userId).toArray(),
      supabase.from('conversations').select('*').eq('user_id', userId),
    ]);
    if (convoErr) throw convoErr;
    const cloudConvos = (cloudConvosRaw ?? []) as CloudConversation[];

    const localConvoById = new Map(localConvos.map((c) => [c.id, c]));
    const cloudConvoById = new Map(cloudConvos.map((c) => [c.id, c]));

    const convosToPull = cloudConvos.filter((c) => {
      const local = localConvoById.get(c.id);
      return !local || c.updated_at > local.updatedAt;
    });
    if (convosToPull.length > 0) {
      await db.conversations.bulkPut(
        convosToPull.map((c) => ({ id: c.id, userId: c.user_id, title: c.title, createdAt: c.created_at, updatedAt: c.updated_at }))
      );
      pulled += convosToPull.length;
    }

    const convosToPush = localConvos.filter((c) => {
      const cloud = cloudConvoById.get(c.id);
      return !cloud || c.updatedAt > cloud.updated_at;
    });
    if (convosToPush.length > 0) {
      const { error } = await supabase
        .from('conversations')
        .upsert(convosToPush.map((c) => ({ id: c.id, user_id: c.userId, title: c.title, created_at: c.createdAt, updated_at: c.updatedAt })));
      if (error) throw error;
      pushed += convosToPush.length;
    }

    // ---- Knowledge packs ----
    const [localPacks, { data: cloudPacksRaw, error: packErr }] = await Promise.all([
      db.knowledgePacks.where('userId').equals(userId).toArray(),
      supabase.from('knowledge_packs').select('*').eq('user_id', userId),
    ]);
    if (packErr) throw packErr;
    const cloudPacks = (cloudPacksRaw ?? []) as CloudKnowledgePack[];

    const localPackById = new Map(localPacks.map((p) => [p.id, p]));
    const cloudPackById = new Map(cloudPacks.map((p) => [p.id, p]));

    const packsToPull = cloudPacks.filter((p) => {
      const local = localPackById.get(p.id);
      return !local || p.timestamp > local.timestamp;
    });
    if (packsToPull.length > 0) {
      await db.knowledgePacks.bulkPut(
        packsToPull.map((p) => ({
          id: p.id,
          userId: p.user_id,
          subject: p.subject,
          sourceFileName: p.source_file_name,
          summary: p.summary,
          timestamp: p.timestamp,
          sourceConversationId: p.source_conversation_id ?? undefined,
        }))
      );
      pulled += packsToPull.length;
    }

    const packsToPush = localPacks.filter((p) => {
      const cloud = cloudPackById.get(p.id);
      return !cloud || p.timestamp > cloud.timestamp;
    });
    if (packsToPush.length > 0) {
      const { error } = await supabase.from('knowledge_packs').upsert(
        packsToPush.map((p) => ({
          id: p.id,
          user_id: p.userId,
          subject: p.subject,
          source_file_name: p.sourceFileName,
          summary: p.summary,
          timestamp: p.timestamp,
          source_conversation_id: p.sourceConversationId ?? null,
        }))
      );
      if (error) throw error;
      pushed += packsToPush.length;
    }

    // ---- Messages (append-only) ----
    const [localMessages, { data: cloudMsgIdRows, error: msgIdErr }] = await Promise.all([
      db.messages.toCollection().filter((m) => m.userId === userId).toArray(),
      supabase.from('messages').select('id').eq('user_id', userId),
    ]);
    if (msgIdErr) throw msgIdErr;

    const localMsgIds = new Set(localMessages.map((m) => m.id));
    const cloudMsgIds = new Set((cloudMsgIdRows ?? []).map((r: { id: string }) => r.id));

    const msgsToPush = localMessages.filter((m) => !cloudMsgIds.has(m.id));
    if (msgsToPush.length > 0) {
      const { error } = await supabase.from('messages').upsert(
        msgsToPush.map((m) => ({
          id: m.id,
          conversation_id: m.conversationId,
          user_id: m.userId,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          attachment_names: m.attachmentNames ?? null,
          failed: m.failed ?? false,
        }))
      );
      if (error) throw error;
      pushed += msgsToPush.length;
    }

    const missingLocalMsgIds = [...cloudMsgIds].filter((id) => !localMsgIds.has(id));
    if (missingLocalMsgIds.length > 0) {
      const { data: fullRows, error } = await supabase.from('messages').select('*').in('id', missingLocalMsgIds);
      if (error) throw error;
      await db.messages.bulkPut(
        ((fullRows ?? []) as CloudMessage[]).map((m) => ({
          id: m.id,
          conversationId: m.conversation_id,
          userId: m.user_id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          attachmentNames: m.attachment_names ?? undefined,
          failed: m.failed,
        }))
      );
      pulled += fullRows?.length ?? 0;
    }

    // ---- Attachments (append-only) ----
    const [localAttachments, { data: cloudAttIdRows, error: attIdErr }] = await Promise.all([
      db.attachments.where('userId').equals(userId).toArray(),
      supabase.from('attachments').select('id').eq('user_id', userId),
    ]);
    if (attIdErr) throw attIdErr;

    const localAttIds = new Set(localAttachments.map((a) => a.id));
    const cloudAttIds = new Set((cloudAttIdRows ?? []).map((r: { id: string }) => r.id));

    const attsToPush = localAttachments.filter((a) => !cloudAttIds.has(a.id));
    if (attsToPush.length > 0) {
      const { error } = await supabase.from('attachments').upsert(
        attsToPush.map((a) => ({
          id: a.id,
          conversation_id: a.conversationId,
          user_id: a.userId,
          file_name: a.fileName,
          text: a.text,
          timestamp: a.timestamp,
        }))
      );
      if (error) throw error;
      pushed += attsToPush.length;
    }

    const missingLocalAttIds = [...cloudAttIds].filter((id) => !localAttIds.has(id));
    if (missingLocalAttIds.length > 0) {
      const { data: fullRows, error } = await supabase.from('attachments').select('*').in('id', missingLocalAttIds);
      if (error) throw error;
      await db.attachments.bulkPut(
        ((fullRows ?? []) as CloudAttachment[]).map((a) => ({
          id: a.id,
          conversationId: a.conversation_id,
          userId: a.user_id,
          fileName: a.file_name,
          text: a.text,
          timestamp: a.timestamp,
        }))
      );
      pulled += fullRows?.length ?? 0;
    }

    // ---- Documents (Write) ----
    const [localDocs, { data: cloudDocsRaw, error: docErr }] = await Promise.all([
      db.documents.where('userId').equals(userId).toArray(),
      supabase.from('documents').select('*').eq('user_id', userId),
    ]);
    if (docErr) throw docErr;
    const cloudDocs = (cloudDocsRaw ?? []) as CloudDocument[];

    const localDocById = new Map(localDocs.map((d) => [d.id, d]));
    const cloudDocById = new Map(cloudDocs.map((d) => [d.id, d]));

    const docsToPull = cloudDocs.filter((d) => {
      const local = localDocById.get(d.id);
      return !local || d.updated_at > local.updatedAt;
    });
    if (docsToPull.length > 0) {
      await db.documents.bulkPut(
        docsToPull.map((d) => ({
          id: d.id,
          userId: d.user_id,
          title: d.title,
          content: d.content,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }))
      );
      pulled += docsToPull.length;
    }

    const docsToPush = localDocs.filter((d) => {
      const cloud = cloudDocById.get(d.id);
      return !cloud || d.updatedAt > cloud.updated_at;
    });
    if (docsToPush.length > 0) {
      const { error } = await supabase.from('documents').upsert(
        docsToPush.map((d) => ({
          id: d.id,
          user_id: d.userId,
          title: d.title,
          content: d.content,
          created_at: d.createdAt,
          updated_at: d.updatedAt,
        }))
      );
      if (error) throw error;
      pushed += docsToPush.length;
    }

    return { ok: true, pulled, pushed };
  } catch (err) {
    console.error('Cloud sync failed:', err);
    return { ok: false, message: err instanceof Error ? err.message : 'Sync failed.' };
  }
}

// Best-effort: deletes one message from the cloud. Used right when a message is deleted locally
// (e.g. Retry replacing an old answer), so the old row doesn't get pulled back down on the next
// sync — messages are otherwise synced append-only and don't know about local deletes.
// Safe to call for guests too: there's nothing to delete in the cloud for them, so it's a no-op.
export async function deleteMessageFromCloud(id: string): Promise<void> {
  try {
    await supabase.from('messages').delete().eq('id', id);
  } catch (err) {
    console.error('Deleting message from the cloud failed (will not block the retry):', err);
  }
}

// Best-effort: deletes a conversation from the cloud. Messages and attachments for it are removed
// automatically (the schema cascades), so this alone cleans up its whole cloud footprint.
export async function deleteConversationFromCloud(id: string): Promise<void> {
  try {
    await supabase.from('conversations').delete().eq('id', id);
  } catch (err) {
    console.error('Deleting conversation from the cloud failed (will not block the local delete):', err);
  }
}

// Best-effort: deletes a Write document from the cloud, same reasoning as the two helpers above —
// documents sync last-write-wins by updatedAt, which has no idea a local delete happened.
export async function deleteDocumentFromCloud(id: string): Promise<void> {
  try {
    await supabase.from('documents').delete().eq('id', id);
  } catch (err) {
    console.error('Deleting document from the cloud failed (will not block the local delete):', err);
  }
}
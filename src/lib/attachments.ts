import { db, type Attachment } from './db';
import { tokenize } from './textSimilarity';

// A file that has been read but not sent yet (it lives in memory until the message is sent).
export type PendingFile = { id: string; name: string; text: string };

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

// How much attached text we put into one prompt.
// The cloud model can take a lot. The small on-device model can only handle a little.
export const ONLINE_ATTACHMENT_BUDGET = 200_000;
export const OFFLINE_ATTACHMENT_BUDGET = 4_000;

export async function saveAttachments(userId: string, conversationId: string, files: PendingFile[]) {
  const now = Date.now();
  await db.attachments.bulkAdd(
    files.map((f, i) => ({
      id: crypto.randomUUID(),
      conversationId,
      userId,
      fileName: f.name,
      text: f.text,
      timestamp: now + i,
    }))
  );
}

export function getConversationAttachments(conversationId: string): Promise<Attachment[]> {
  return db.attachments.where('conversationId').equals(conversationId).sortBy('timestamp');
}

// Cut text into ~800-character pieces, keeping paragraphs together where possible.
function splitIntoChunks(text: string, size: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const para of text.split(/\n\s*\n/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length > size) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < p.length; i += size) chunks.push(p.slice(i, i + size));
      continue;
    }
    if (current && current.length + p.length + 2 > size) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// If the text is too long for the budget, keep the pieces that share the most words with the question.
function selectRelevantText(text: string, query: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const queryTokens = tokenize(query);
  const scored = splitIntoChunks(text, 800).map((chunk, index) => {
    const tokens = tokenize(chunk);
    let hits = 0;
    for (const word of queryTokens) if (tokens.has(word)) hits++;
    return { chunk, index, hits };
  });

  scored.sort((a, b) => b.hits - a.hits || a.index - b.index);

  const picked: typeof scored = [];
  let used = 0;
  for (const item of scored) {
    if (used + item.chunk.length > maxChars) continue;
    picked.push(item);
    used += item.chunk.length;
  }

  if (picked.length === 0) return text.slice(0, maxChars);

  picked.sort((a, b) => a.index - b.index); // back into reading order
  return picked.map((item) => item.chunk).join('\n…\n');
}

// The block of text that goes into the prompt. Empty string if nothing is attached.
export function buildAttachmentContext(attachments: Attachment[], query: string, budget: number): string {
  if (attachments.length === 0) return '';
  const perFile = Math.floor(budget / attachments.length);
  const sections = attachments.map(
    (a) => `--- ${a.fileName} ---\n${selectRelevantText(a.text, query, perFile)}`
  );
  return `ATTACHED FILES (the user attached these to this chat):\n\n${sections.join('\n\n')}`;
}
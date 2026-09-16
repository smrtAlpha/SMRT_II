import { db, type QARecord } from './db';

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2) // drop noise words like "a", "is", "to"
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.3;

export async function searchLocalHistory(
  userId: string,
  query: string
): Promise<{ record: QARecord; score: number } | null> {
  const records = await db.qaHistory.where('userId').equals(userId).toArray();
  if (records.length === 0) return null;

  const queryTokens = tokenize(query);
  let best: { record: QARecord; score: number } | null = null;

  for (const record of records) {
    const score = jaccardSimilarity(queryTokens, tokenize(record.question));
    if (!best || score > best.score) {
      best = { record, score };
    }
  }

  return best && best.score >= SIMILARITY_THRESHOLD ? best : null;
}
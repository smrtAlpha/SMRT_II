import { db, type QARecord } from './db';
import { tokenize, jaccardSimilarity } from './textSimilarity';

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
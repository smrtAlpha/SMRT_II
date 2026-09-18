import { db, type KnowledgePack } from './db';
import { tokenize, overlapCoefficient } from './textSimilarity';

// Overlap coefficient, not Jaccard — a query's tiny word set shouldn't get diluted
// just because the pack's summary is long. This means "what fraction of the
// query's meaningful words actually show up in the pack," which is the right question here.
const PACK_MATCH_THRESHOLD = 0.3;

export async function findRelevantKnowledgePack(
  userId: string,
  query: string
): Promise<KnowledgePack | null> {
  const packs = await db.knowledgePacks.where('userId').equals(userId).toArray();
  if (packs.length === 0) return null;

  const queryTokens = tokenize(query);
  let best: { pack: KnowledgePack; score: number } | null = null;

  for (const pack of packs) {
    const packTokens = tokenize(`${pack.subject} ${pack.summary}`);
    const score = overlapCoefficient(queryTokens, packTokens);
    if (!best || score > best.score) {
      best = { pack, score };
    }
  }

  return best && best.score >= PACK_MATCH_THRESHOLD ? best.pack : null;
}
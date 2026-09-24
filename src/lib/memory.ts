import { db } from './db';

export type MemoryKind = 'name' | 'location' | 'age' | 'occupation' | 'note';

// Keep at most this many freeform "I like X" notes per user, so it can't grow forever.
const NOTE_LIMIT = 20;

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Looks for a handful of common, explicit self-statements ("my name is X", "I live in X"...).
// This is a plain pattern match, not an AI call — it will miss plenty of ways people actually
// phrase things, and can occasionally mismatch, but it's instant, free, and works offline,
// which matters since it runs on every message you send.
export function extractMemoryFact(text: string): { kind: MemoryKind; fact: string } | null {
  const t = text.trim();
  if (!t) return null;

  let m =
    t.match(/\bmy name is ([a-z][a-z' -]{1,40})/i) ||
    t.match(/\bcall me ([a-z][a-z' -]{1,40})/i) ||
    t.match(/\bi'?m called ([a-z][a-z' -]{1,40})/i);
  if (m) return { kind: 'name', fact: `The user's name is ${titleCase(m[1].trim())}.` };

  m = t.match(/\bi live in ([a-z][a-z' ,-]{1,60})/i) || t.match(/\bi'?m from ([a-z][a-z' ,-]{1,60})/i);
  if (m) return { kind: 'location', fact: `The user is from/lives in ${m[1].trim()}.` };

  m = t.match(/\bi'?m (\d{1,3}) years old/i) || t.match(/\bi am (\d{1,3}) years old/i);
  if (m) return { kind: 'age', fact: `The user is ${m[1]} years old.` };

  m = t.match(/\bi work as an? ([a-z][a-z' -]{1,60})/i);
  if (m) return { kind: 'occupation', fact: `The user works as ${m[1].trim()}.` };

  m = t.match(/\bi (?:like|love|enjoy) ([a-z][a-z0-9' -]{1,60})/i);
  if (m) return { kind: 'note', fact: `The user likes ${m[1].trim()}.` };

  return null;
}

// Checks a message for a fact worth remembering and, if found, saves it. A new name, location,
// age, or job replaces the old one of that kind; freeform notes just accumulate up to a small cap.
// Returns the fact that was saved, or null if nothing new was found/stored.
export async function saveMemoryFact(userId: string, text: string): Promise<string | null> {
  const found = extractMemoryFact(text);
  if (!found) return null;

  if (found.kind !== 'note') {
    await db.userMemory
      .where('userId')
      .equals(userId)
      .filter((r) => r.kind === found.kind)
      .delete();
  } else {
    const existing = await db.userMemory
      .where('userId')
      .equals(userId)
      .filter((r) => r.kind === 'note')
      .toArray();
    if (existing.some((r) => r.fact === found.fact)) return null; // already have this one
    if (existing.length >= NOTE_LIMIT) {
      const oldest = existing.reduce((a, b) => (a.timestamp < b.timestamp ? a : b));
      await db.userMemory.delete(oldest.id);
    }
  }

  await db.userMemory.add({ id: crypto.randomUUID(), userId, kind: found.kind, fact: found.fact, timestamp: Date.now() });
  return found.fact;
}

// Formats everything remembered about the user as a short bullet list, for the AI prompt.
// Empty string when nothing is known yet, so callers can skip adding it entirely.
export async function buildMemoryContext(userId: string): Promise<string> {
  const facts = await db.userMemory.where('userId').equals(userId).toArray();
  if (facts.length === 0) return '';
  return facts.map((f) => `- ${f.fact}`).join('\n');
}
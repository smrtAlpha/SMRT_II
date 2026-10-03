import { splitLabels } from './messageLabels';
import type { Message } from './db';

// Roughly what one online question costs in data on top of the words themselves: HTTPS headers, the
// login token that rides along with every request, and the connection set-up. Answered offline,
// none of that is sent. This is an estimate, not a meter — the app can't see the real network bill.
export const REQUEST_OVERHEAD_BYTES = 4 * 1024;

type AnswerLike = Pick<Message, 'role' | 'content' | 'failed'>;

// True for answers produced without the internet: written by the on-device AI, or reused from
// the person's saved history. These are the two labels the offline path puts on its answers.
export function isServedOffline(m: AnswerLike): boolean {
  if (m.role !== 'assistant' || m.failed) return false;
  const { labels, body } = splitLabels(m.content);
  if (body === '') return false;
  return labels.some((label) => /generated offline|offline history/i.test(label));
}

// Estimated bytes of data this one answer saved (0 if it wasn't served offline).
export function bytesSavedBy(m: AnswerLike): number {
  if (!isServedOffline(m)) return 0;
  const { body } = splitLabels(m.content);
  return REQUEST_OVERHEAD_BYTES + new TextEncoder().encode(body).length;
}

export function estimateSavings(messages: Iterable<AnswerLike>): { answers: number; bytes: number } {
  let answers = 0;
  let bytes = 0;
  for (const m of messages) {
    const saved = bytesSavedBy(m);
    if (saved > 0) {
      answers += 1;
      bytes += saved;
    }
  }
  return { answers, bytes };
}

// "0 MB", "42 KB", "1.3 MB" — small numbers stay readable instead of rounding down to 0.
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
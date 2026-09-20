import type { Message } from './db';
import { splitLabels } from './messageLabels';

// One earlier message, in the shape the AI expects.
export type HistoryTurn = { role: 'user' | 'assistant'; content: string };

export type HistoryLimits = {
  maxPairs: number; // how many earlier question-and-answer pairs at most
  maxCharsPerMessage: number; // long messages are cut to this length
  totalBudget: number; // total characters of history allowed
};

// The cloud AI can remember a lot. The small on-device AI can only take a little.
export const ONLINE_HISTORY: HistoryLimits = { maxPairs: 20, maxCharsPerMessage: 4_000, totalBudget: 24_000 };
export const OFFLINE_HISTORY: HistoryLimits = { maxPairs: 2, maxCharsPerMessage: 1_200, totalBudget: 2_400 };

// Answers that are really error messages. They are never sent back to the AI as "memory".
const FAILURE_TEXTS = [
  'Stopped before SMRT answered.',
  'Something went wrong reaching SMRT. Please try again.',
  'Your offline AI hit an error. Try again.',
];
const FAILURE_STARTS = [
  'No cached answer for this',
  "You're sending messages too fast",
  "You've reached today's",
  "Couldn't verify your request limit",
  'That message is too large',
];

function looksLikeFailure(content: string) {
  const text = content.trim();
  return FAILURE_TEXTS.includes(text) || FAILURE_STARTS.some((start) => text.startsWith(start));
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Turns the saved messages of a chat into "memory" for the AI: the most recent question-and-answer
// pairs that fit the limits, oldest first. A question with no answer yet (such as the one being
// retried) is left out, and so are pairs whose answer failed.
export function buildHistory(messages: Message[], limits: HistoryLimits): HistoryTurn[] {
  const pairs: { question: string; answer: string }[] = [];

  for (let i = 0; i < messages.length - 1; i++) {
    const question = messages[i];
    const answer = messages[i + 1];
    if (question.role !== 'user' || answer.role !== 'assistant') continue;
    if (answer.failed || looksLikeFailure(answer.content)) continue;

    // Drop the little source badges (like [[FROM_FILE]]), keep only the real answer.
    const answerText = splitLabels(answer.content).body.trim();
    const questionText = question.content.trim();
    if (!questionText || !answerText) continue;

    pairs.push({ question: questionText, answer: answerText });
    i++; // the answer has been used
  }

  // Take the newest pairs first, until a limit is reached.
  const chosen: { question: string; answer: string }[] = [];
  let used = 0;
  for (let i = pairs.length - 1; i >= 0 && chosen.length < limits.maxPairs; i--) {
    const question = clip(pairs[i].question, limits.maxCharsPerMessage);
    const answer = clip(pairs[i].answer, limits.maxCharsPerMessage);
    if (used + question.length + answer.length > limits.totalBudget) break;
    chosen.unshift({ question, answer });
    used += question.length + answer.length;
  }

  return chosen.flatMap((pair) => [
    { role: 'user' as const, content: pair.question },
    { role: 'assistant' as const, content: pair.answer },
  ]);
}

// The most recent thing the user asked before now (used to pick the right parts of an attached file).
export function lastQuestionIn(history: HistoryTurn[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user') return history[i].content;
  }
  return '';
}
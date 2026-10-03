import { describe, it, expect } from 'vitest';
import { bytesSavedBy, estimateSavings, formatBytes, isServedOffline, REQUEST_OVERHEAD_BYTES } from './offlineSavings';

const offlineAi = { role: 'assistant' as const, content: '*(generated offline by your on-device AI)*\n\nHello there' };
const offlineHistory = { role: 'assistant' as const, content: '*(from your offline history — asked 1/2/2026)*\n\nOld answer' };
const online = { role: 'assistant' as const, content: 'A normal online answer.' };

describe('isServedOffline', () => {
  it('is true for on-device AI answers', () => {
    expect(isServedOffline(offlineAi)).toBe(true);
  });

  it('is true for answers reused from offline history', () => {
    expect(isServedOffline(offlineHistory)).toBe(true);
  });

  it('is false for normal online answers', () => {
    expect(isServedOffline(online)).toBe(false);
  });

  it('is false for failed answers and for user messages', () => {
    expect(isServedOffline({ ...offlineAi, failed: true })).toBe(false);
    expect(isServedOffline({ role: 'user', content: offlineAi.content })).toBe(false);
  });
});

describe('bytesSavedBy', () => {
  it('counts the request overhead plus the size of the answer text', () => {
    expect(bytesSavedBy(offlineAi)).toBe(REQUEST_OVERHEAD_BYTES + 'Hello there'.length);
  });

  it('counts non-ASCII text by its real byte size', () => {
    const m = { role: 'assistant' as const, content: '*(generated offline by your on-device AI)*\n\né' };
    expect(bytesSavedBy(m)).toBe(REQUEST_OVERHEAD_BYTES + 2);
  });

  it('is 0 for answers that were not served offline', () => {
    expect(bytesSavedBy(online)).toBe(0);
  });
});

describe('estimateSavings', () => {
  it('adds up only the offline answers', () => {
    const result = estimateSavings([offlineAi, online, offlineHistory]);
    expect(result.answers).toBe(2);
    expect(result.bytes).toBe(bytesSavedBy(offlineAi) + bytesSavedBy(offlineHistory));
  });

  it('is empty for no messages', () => {
    expect(estimateSavings([])).toEqual({ answers: 0, bytes: 0 });
  });
});

describe('formatBytes', () => {
  it('shows 0 MB when nothing has been saved', () => {
    expect(formatBytes(0)).toBe('0 MB');
  });

  it('shows kilobytes below one megabyte', () => {
    expect(formatBytes(42 * 1024)).toBe('42 KB');
    expect(formatBytes(10)).toBe('1 KB');
  });

  it('shows megabytes with one decimal from one megabyte up', () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});
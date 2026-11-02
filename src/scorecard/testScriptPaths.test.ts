// Pins the expected rows in Tom's manual test script, through the same function the server uses.
import { describe, expect, it } from 'vitest';
import { buildSubmissionRows } from './submission.ts';
import { PATH_A, PATH_B, PATH_C } from './testScriptPaths.ts';

const rowFor = (answers: unknown) =>
  buildSubmissionRows({
    answers,
    surveyVersion: 'general',
    contact: { email: 'test@example.com' },
    sessionId: 's_1700000000000_abc123',
    isTest: true,
  }).lead;

describe('manual test script', () => {
  it('path A: dollar leak', () => {
    const lead = rowFor(PATH_A);
    expect(lead).toMatchObject({
      est_leak_low_cents: 260000,
      est_leak_high_cents: 520000,
      est_hours_low: null,
      est_hours_high: null,
      top_leak: 'slow_response',
      score: 30,
      band: 'leaking_revenue',
    });
    expect(lead.leaks.estimateKind).toBe('dollars');
  });

  it('path B: hours fallback', () => {
    const lead = rowFor(PATH_B);
    expect(lead).toMatchObject({
      est_leak_low_cents: null,
      est_leak_high_cents: null,
      est_hours_low: 6,
      est_hours_high: 10,
      top_leak: 'none',
      score: 91,
      band: 'ready_to_scale',
    });
    expect(lead.leaks.estimateKind).toBe('hours');
  });

  it('path C: hidden', () => {
    const lead = rowFor(PATH_C);
    expect(lead).toMatchObject({
      est_leak_low_cents: 20000,
      est_leak_high_cents: 50000,
      est_hours_low: null,
      est_hours_high: null,
      top_leak: 'short_follow_up',
      score: 47,
      band: 'solid_base',
    });
    expect(lead.leaks.estimateKind).toBe('hidden');
  });
});

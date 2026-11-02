// The 20 simulated businesses: the engine must match run2() exactly.
// Fixtures come from tests/fixtures/generate-cost-model-cases.py; never edit the JSON by hand.
import { describe, expect, it } from 'vitest';
import cases from '../../../tests/fixtures/cost-model-cases.json';
import { computeScorecard } from './engine.ts';
import type { SurveyVersion } from './engine.ts';

const STATUS_TO_KIND: Record<string, string> = { shown: 'dollars', too_small_hidden: 'hidden', hours: 'hours' };

const resultFor = (name: string) => {
  const c = cases.find((x) => x.name === name)!;
  return computeScorecard(c.answers, c.surveyVersion as SurveyVersion);
};

describe('run2() fixtures', () => {
  it('has all 20 businesses', () => {
    expect(cases).toHaveLength(20);
    expect(new Set(cases.map((c) => c.name)).size).toBe(20);
  });

  it.each(cases)('$name', ({ answers, surveyVersion, expected }) => {
    const r = computeScorecard(answers, surveyVersion as SurveyVersion);
    expect(r.estimate.kind).toBe(STATUS_TO_KIND[expected.status]);
    expect([r.liftLowPct, r.liftHighPct]).toEqual([expected.plo, expected.phi]);

    if (expected.status === 'hours') {
      // run2 reports top "hours"; the engine reports that through estimate.kind (Step 3 decision)
      expect(expected.top).toBe('hours');
      expect([r.estimate.hoursLow, r.estimate.hoursHigh]).toEqual([expected.lo, expected.hi]);
      expect(r.estimate.monthlyLow).toBeNull();
      return;
    }
    expect(r.topLeak).toBe(expected.top);
    expect([r.estimate.monthlyLow, r.estimate.monthlyHigh]).toEqual([expected.lo, expected.hi]);
    expect(r.estimate.hoursLow).toBeNull();
  });
});

// Hardcoded from the M1 brief, so a bad fixture regeneration cannot pass unnoticed
describe('M1 brief spot checks', () => {
  it('Great Install LLC: $2,600-$5,200, slow response', () => {
    const r = resultFor('Great Install LLC');
    expect(r.topLeak).toBe('slow_response');
    expect([r.estimate.monthlyLow, r.estimate.monthlyHigh]).toEqual([2600, 5200]);
  });

  it('Summit Farmers Agency (insurance): $2,800-$5,400', () => {
    const r = resultFor('Summit Farmers Agency');
    expect(r.surveyVersion).toBe('insurance');
    expect([r.estimate.monthlyLow, r.estimate.monthlyHigh]).toEqual([2800, 5400]);
  });

  it('NetGuard IT: 6-10 hours', () => {
    const r = resultFor('NetGuard IT');
    expect(r.estimate.kind).toBe('hours');
    expect([r.estimate.hoursLow, r.estimate.hoursHigh]).toEqual([6, 10]);
  });

  it('Shield Pest Control: 4-9 hours', () => {
    const r = resultFor('Shield Pest Control');
    expect(r.estimate.kind).toBe('hours');
    expect([r.estimate.hoursLow, r.estimate.hoursHigh]).toEqual([4, 9]);
  });
});

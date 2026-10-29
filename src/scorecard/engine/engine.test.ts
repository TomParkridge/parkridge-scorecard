// Smoke checks for the engine. The full 20-business fixtures from run2() arrive in Step 4.
import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../questions.ts';
import { bandFor, computeScorecard, ScorecardInputError, validateAnswers } from './engine.ts';
import type { ScorecardAnswers } from './engine.ts';
import {
  AI_LEVEL,
  CLOSE_RATE,
  CUSTOMER_VALUE,
  DOLLAR_LEAKS,
  FOLLOW_UP_LIFT,
  FOLLOW_UP_POINTS,
  HOURS,
  LEADS_MID,
  NON_DOLLAR_LEAKS,
  OLD_LEADS_POINTS,
  REACTIVATION_LIFT,
  RESPONSE_LIFT,
  RESPONSE_POINTS,
  TRACKING_POINTS,
} from './tables.ts';

const optionIds = (questionId: string) => QUESTIONS.find((q) => q.id === questionId)!.options.map((o) => o.id).sort();

// Great Install LLC from the simulation: HVAC, 25-50 leads, same-day response, 2-3 follow-ups
const greatInstall: ScorecardAnswers = {
  challenges: ['not_enough_leads'],
  lead_channels: ['referrals', 'paid_ads'],
  monthly_leads: '25_50',
  response_speed: 'same_day',
  follow_up_attempts: '2_3',
  close_rate: '2_3',
  customer_value: '2k_10k',
  old_leads: 'rarely_never',
  lead_tracking: 'spreadsheet_inbox',
  ai_level: 'level_2',
  time_sinks: ['followup', 'quotes', 'crm'],
};

describe('tables match the question config', () => {
  const cases: [string, Record<string, unknown>][] = [
    ['monthly_leads', LEADS_MID],
    ['close_rate', CLOSE_RATE],
    ['customer_value', CUSTOMER_VALUE],
    ['response_speed', RESPONSE_LIFT],
    ['response_speed', RESPONSE_POINTS],
    ['follow_up_attempts', FOLLOW_UP_LIFT],
    ['follow_up_attempts', FOLLOW_UP_POINTS],
    ['old_leads', REACTIVATION_LIFT],
    ['old_leads', OLD_LEADS_POINTS],
    ['lead_tracking', TRACKING_POINTS],
    ['ai_level', AI_LEVEL],
    ['time_sinks', HOURS],
  ];
  for (const [questionId, table] of cases) {
    it(`${questionId} keys`, () => expect(Object.keys(table).sort()).toEqual(optionIds(questionId)));
  }

  it('dollar leaks point at real questions', () => {
    for (const leak of DOLLAR_LEAKS) expect(Object.keys(leak.lifts).sort()).toEqual(optionIds(leak.question));
  });

  it('non-dollar leak challenge picks are real Q1 options', () => {
    const ids = optionIds('challenges');
    for (const leak of NON_DOLLAR_LEAKS) for (const c of leak.challenges) expect(ids).toContain(c);
  });
});

describe('computeScorecard spot checks', () => {
  it('Great Install LLC: $2,600-$5,200, slow response', () => {
    const r = computeScorecard(greatInstall, 'general');
    expect(r.monthlyRevenue).toBe(14800);
    expect(r.topLeak).toBe('slow_response');
    expect(r.dollarLeaks.map((l) => l.id)).toEqual(['slow_response', 'short_follow_up']);
    expect(r.estimate).toEqual({
      kind: 'dollars',
      monthlyLow: 2600,
      monthlyHigh: 5200,
      yearlyLow: 31200,
      yearlyHigh: 62400,
      hoursLow: null,
      hoursHigh: null,
    });
    expect([r.liftLowPct, r.liftHighPct]).toEqual([18, 35]);
    // Q2 2 + Q4 1 + Q5 1 + Q8 0 = 4/16 -> 25; AI 1*10 + 2*12 = 34; overall 29.5 -> 30
    expect([r.pipelineScore, r.aiScore, r.overallScore, r.aiLevel, r.band]).toEqual([25, 34, 30, 2, 'leaking_revenue']);
  });

  it('Summit Farmers Agency (insurance): $2,800-$5,400, short follow-up', () => {
    const r = computeScorecard(
      {
        ...greatInstall,
        lead_channels: ['referrals', 'paid_ads', 'partners'],
        monthly_leads: '50_100',
        response_speed: '1_hour',
        customer_value: '500_2k',
        lead_tracking: 'crm_fuzzy',
        ai_level: 'level_1',
      },
      'insurance',
    );
    expect(r.topLeak).toBe('short_follow_up');
    expect([r.estimate.monthlyLow, r.estimate.monthlyHigh]).toEqual([2800, 5400]);
  });

  it('NetGuard IT: no dollar leak, 6-10 hours, top leak none', () => {
    const r = computeScorecard(
      {
        challenges: ['manual_work'],
        lead_channels: ['referrals', 'outbound', 'partners'],
        monthly_leads: 'under_10',
        response_speed: '5_min',
        follow_up_attempts: '7_plus',
        close_rate: '4_5',
        customer_value: '10k_50k',
        old_leads: 'regular',
        lead_tracking: 'crm_connected',
        ai_level: 'level_4',
        time_sinks: ['quotes', 'reporting', 'onboarding'],
      },
      'general',
    );
    expect(r.estimate).toMatchObject({ kind: 'hours', hoursLow: 6, hoursHigh: 10, monthlyLow: null });
    expect(r.topLeak).toBe('none');
    expect(r.dollarLeaks).toEqual([]);
    expect([r.liftLowPct, r.liftHighPct]).toEqual([0, 0]);
  });

  it('hides a tiny estimate (unrounded monthly high x 12 under $6,000)', () => {
    const r = computeScorecard(
      { ...greatInstall, monthly_leads: 'under_10', close_rate: '0_1', customer_value: 'under_500', response_speed: '1_2_days', follow_up_attempts: 'once_or_none' },
      'general',
    );
    expect(r.estimate.kind).toBe('hidden');
    expect(r.estimate.monthlyHigh).toBe(100); // 52.5 rounded; still stored
  });

  it('picks the proposed non-dollar leak when there is no dollar leak', () => {
    const noDollar = { response_speed: '5_min', follow_up_attempts: '7_plus', old_leads: 'regular' };
    // Q9 spreadsheet (1 point) beats one channel (1 point) on Q1 picks: leads_slip matches numbers_untrusted
    const tied = computeScorecard(
      { ...greatInstall, ...noDollar, lead_channels: ['referrals'], lead_tracking: 'spreadsheet_inbox', ai_level: 'level_3', challenges: ['leads_slip'] },
      'general',
    );
    expect(tied.topLeak).toBe('numbers_untrusted');
    // AI level 0 has the lowest points
    const ai = computeScorecard({ ...greatInstall, ...noDollar, lead_tracking: 'crm_fuzzy', ai_level: 'level_0' }, 'general');
    expect(ai.topLeak).toBe('ai_ad_hoc');
  });

  it('averages the unrounded sub-scores', () => {
    // pipeline 1/16 -> 6.25, AI 4*10 + 4*12 = 88, overall 47.125 -> 47
    const r = computeScorecard(
      { ...greatInstall, lead_channels: ['referrals'], response_speed: '1_2_days', follow_up_attempts: 'once_or_none', old_leads: 'no_list', lead_tracking: 'crm_connected', ai_level: 'level_4' },
      'general',
    );
    expect([r.pipelineScore, r.aiScore, r.overallScore, r.band]).toEqual([6, 88, 47, 'solid_base']);
  });
});

describe('bandFor', () => {
  it('puts the boundaries at 40 and 70', () => {
    expect(bandFor(0)).toBe('leaking_revenue');
    expect(bandFor(39)).toBe('leaking_revenue');
    expect(bandFor(40)).toBe('solid_base');
    expect(bandFor(69)).toBe('solid_base');
    expect(bandFor(70)).toBe('ready_to_scale');
    expect(bandFor(100)).toBe('ready_to_scale');
  });
});

describe('validateAnswers', () => {
  it('accepts a complete answer set', () => {
    expect(() => validateAnswers(greatInstall, 'general')).not.toThrow();
  });

  it.each([
    ['an unknown option id', { ...greatInstall, response_speed: 'instantly' }],
    ['a missing answer', { ...greatInstall, close_rate: undefined }],
    ['an empty multi pick', { ...greatInstall, lead_channels: [] }],
    ['too many picks', { ...greatInstall, time_sinks: ['leads', 'quotes', 'crm', 'admin'] }],
    ['a duplicate pick', { ...greatInstall, challenges: ['leads_slip', 'leads_slip'] }],
    ['a single answer given as a list', { ...greatInstall, ai_level: ['level_2'] }],
  ])('rejects %s', (_, answers) => {
    expect(() => validateAnswers(answers, 'general')).toThrow(ScorecardInputError);
  });

  it('rejects an unknown survey version', () => {
    expect(() => validateAnswers(greatInstall, 'roofing')).toThrow(ScorecardInputError);
  });
});

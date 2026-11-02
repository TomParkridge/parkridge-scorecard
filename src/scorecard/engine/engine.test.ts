// Unit tests for the engine's rules. The 20-business run2() fixtures are in cost-model.test.ts.
import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../questions.ts';
import { bandFor, computeScorecard, rankDollarLeaks, ScorecardInputError, validateAnswers } from './engine.ts';
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

  it('averages the unrounded sub-scores', () => {
    // pipeline 1/16 -> 6.25, AI 4*10 + 4*12 = 88, overall 47.125 -> 47
    const r = computeScorecard(
      { ...greatInstall, lead_channels: ['referrals'], response_speed: '1_2_days', follow_up_attempts: 'once_or_none', old_leads: 'no_list', lead_tracking: 'crm_connected', ai_level: 'level_4' },
      'general',
    );
    expect([r.pipelineScore, r.aiScore, r.overallScore, r.band]).toEqual([6, 88, 47, 'solid_base']);
  });
});

describe('lift caps', () => {
  // Great Install's revenue is $14,800 a month
  const estimate = (answers: Partial<ScorecardAnswers>) => {
    const r = computeScorecard({ ...greatInstall, ...answers }, 'general');
    return [r.liftLowPct, r.liftHighPct, r.estimate.monthlyLow, r.estimate.monthlyHigh];
  };

  it('caps both ends at 17.5% and 35%', () => {
    expect(estimate({ response_speed: '1_2_days', follow_up_attempts: 'once_or_none', old_leads: 'regular' })).toEqual([18, 35, 2600, 5200]);
  });

  it('caps each end on its own: low capped, high at 34.2%', () => {
    expect(estimate({ response_speed: 'same_day', follow_up_attempts: '4_6', old_leads: 'now_and_then' })).toEqual([18, 34, 2600, 5100]);
  });

  it('leaves a combined lift under both caps alone', () => {
    expect(estimate({ response_speed: '1_hour', follow_up_attempts: '2_3', old_leads: 'regular' })).toEqual([15, 28, 2100, 4100]);
  });

  it('uses only the top two leaks', () => {
    // Slow response + follow-up: 14.5-28%. Adding old leads would give a higher combined lift.
    expect(estimate({ response_speed: '1_hour', follow_up_attempts: '2_3', old_leads: 'rarely_never' })).toEqual([15, 28, 2100, 4100]);
  });
});

describe('half-even rounding through the engine', () => {
  it('sends an exact $1,050 down to $1,000, where half up would give $1,100', () => {
    const r = computeScorecard(
      { ...greatInstall, monthly_leads: 'under_10', close_rate: '0_1', customer_value: '10k_50k', response_speed: '5_min', follow_up_attempts: 'once_or_none', old_leads: 'regular' },
      'general',
    );
    expect([r.estimate.monthlyLow, r.estimate.monthlyHigh]).toEqual([1000, 2100]);
    expect([r.estimate.yearlyLow, r.estimate.yearlyHigh]).toEqual([12000, 25200]);
  });
});

describe('hidden threshold', () => {
  const noOtherLeaks = { old_leads: 'regular' };

  it('hides $480 a month, even though it rounds to $500, or exactly $6,000 a year', () => {
    const r = computeScorecard(
      { ...greatInstall, ...noOtherLeaks, monthly_leads: 'under_10', close_rate: '2_3', customer_value: '2k_10k', response_speed: '5_min', follow_up_attempts: '2_3' },
      'general',
    );
    expect(r.estimate).toMatchObject({ kind: 'hidden', monthlyHigh: 500, yearlyHigh: 6000 });
  });

  it('shows $510 a month, which also rounds to $500', () => {
    const r = computeScorecard(
      { ...greatInstall, ...noOtherLeaks, monthly_leads: '10_25', close_rate: '2_3', customer_value: '500_2k', response_speed: 'same_day', follow_up_attempts: '4_6' },
      'general',
    );
    expect(r.estimate).toMatchObject({ kind: 'dollars', monthlyHigh: 500, yearlyHigh: 6000 });
  });
});

describe('stored scores at the band boundaries', () => {
  const threeChannels = ['referrals', 'paid_ads', 'partners'];
  // 3 + 1 + 1 + 2 = 7/16 -> 43.75
  const pipelineOf7 = { lead_channels: threeChannels, response_speed: 'same_day', follow_up_attempts: '2_3', old_leads: 'now_and_then' };
  // 3 + 4 + 4 + 4 = 15/16 -> 93.75
  const pipelineOf15 = { lead_channels: threeChannels, response_speed: '5_min', follow_up_attempts: '7_plus', old_leads: 'regular' };

  it.each([
    // [label, answers, pipelineScore, aiScore, overallScore, band]
    ['38.875 -> 39', { ...pipelineOf7, lead_tracking: 'spreadsheet_inbox', ai_level: 'level_2' }, 44, 34, 39, 'leaking_revenue'],
    ['39.875 -> 40', { ...pipelineOf7, lead_tracking: 'none', ai_level: 'level_3' }, 44, 36, 40, 'solid_base'],
    ['68.875 -> 69', { ...pipelineOf15, lead_tracking: 'crm_fuzzy', ai_level: 'level_2' }, 94, 44, 69, 'solid_base'],
    ['69.875 -> 70', { ...pipelineOf15, lead_tracking: 'spreadsheet_inbox', ai_level: 'level_3' }, 94, 46, 70, 'ready_to_scale'],
  ])('%s', (_, answers, pipelineScore, aiScore, overallScore, band) => {
    const r = computeScorecard({ ...greatInstall, ...answers }, 'general');
    expect([r.pipelineScore, r.aiScore, r.overallScore, r.band]).toEqual([pipelineScore, aiScore, overallScore, band]);
  });

  it('scores the extremes', () => {
    const top = computeScorecard(
      { ...greatInstall, lead_channels: ['referrals', 'paid_ads', 'organic_search', 'partners'], response_speed: '5_min', follow_up_attempts: '7_plus', old_leads: 'regular', lead_tracking: 'crm_connected', ai_level: 'level_5' },
      'general',
    );
    expect([top.pipelineScore, top.aiScore, top.overallScore, top.aiLevel, top.band]).toEqual([100, 100, 100, 5, 'ready_to_scale']);

    const bottom = computeScorecard(
      { ...greatInstall, lead_channels: ['referrals'], response_speed: 'varies', follow_up_attempts: 'not_sure', old_leads: 'no_list', lead_tracking: 'none', ai_level: 'level_0' },
      'general',
    );
    // One channel is the 1-point floor: 1/16 -> 6.25, overall 3.125 -> 3
    expect([bottom.pipelineScore, bottom.aiScore, bottom.overallScore, bottom.aiLevel, bottom.band]).toEqual([6, 0, 3, 0, 'leaking_revenue']);
  });
});

describe('#1 leak when there is no dollar leak', () => {
  const noDollar = { ...greatInstall, response_speed: '5_min', follow_up_attempts: '7_plus', old_leads: 'regular' };
  const topLeak = (answers: Partial<ScorecardAnswers>) => computeScorecard({ ...noDollar, ...answers }, 'general').topLeak;

  it('only has numbers_untrusted and ai_ad_hoc as candidates', () => {
    expect(NON_DOLLAR_LEAKS.map((l) => l.id)).toEqual(['numbers_untrusted', 'ai_ad_hoc']);
  });

  it('picks the lowest points', () => {
    expect(topLeak({ lead_tracking: 'crm_fuzzy', ai_level: 'level_0' })).toBe('ai_ad_hoc');
    expect(topLeak({ lead_tracking: 'none', ai_level: 'level_2' })).toBe('numbers_untrusted');
  });

  it('breaks a points tie with the Q1 picks', () => {
    // Spreadsheet and AI level 1 both score 1 point
    const tied = { lead_tracking: 'spreadsheet_inbox', ai_level: 'level_1' };
    expect(topLeak({ ...tied, challenges: ['leads_slip'] })).toBe('numbers_untrusted');
    expect(topLeak({ ...tied, challenges: ['manual_work'] })).toBe('ai_ad_hoc');
    expect(topLeak({ ...tied, challenges: ['manual_work', 'ai_where_to_start', 'leads_slip'] })).toBe('ai_ad_hoc');
  });

  it('falls back to table order when the Q1 picks also tie', () => {
    const tied = { lead_tracking: 'spreadsheet_inbox', ai_level: 'level_1' };
    expect(topLeak({ ...tied, challenges: ['not_enough_leads'] })).toBe('numbers_untrusted');
    expect(topLeak({ ...tied, challenges: ['leads_slip', 'manual_work'] })).toBe('numbers_untrusted');
  });

  it('never returns one_channel: a single lead source alone is "none"', () => {
    expect(topLeak({ lead_channels: ['referrals'], lead_tracking: 'crm_connected', ai_level: 'level_3', challenges: ['not_enough_leads'] })).toBe('none');
  });

  it('a single lead source does not displace a qualifying leak', () => {
    expect(topLeak({ lead_channels: ['referrals'], lead_tracking: 'crm_connected', ai_level: 'level_2', challenges: ['not_enough_leads'] })).toBe('ai_ad_hoc');
  });

  it('is "none" just past each threshold', () => {
    expect(topLeak({ lead_tracking: 'crm_connected', ai_level: 'level_3' })).toBe('none');
  });
});

describe('untapped_database as the #1 leak', () => {
  const oldLeads = { id: 'untapped_database', liftLow: 0.2, liftHigh: 0.45 } as const;
  const response = { id: 'slow_response', liftLow: 0.05, liftHigh: 0.1 } as const;
  const followUp = { id: 'short_follow_up', liftLow: 0.1, liftHigh: 0.2 } as const;

  it('takes #1 when it is the only dollar leak (Benson & Cole Law)', () => {
    const r = computeScorecard(
      {
        ...greatInstall,
        monthly_leads: '25_50',
        response_speed: '15_min',
        follow_up_attempts: '4_6',
        close_rate: '2_3',
        customer_value: '10k_50k',
        old_leads: 'now_and_then',
      },
      'general',
    );
    expect(r.topLeak).toBe('untapped_database');
    expect(r.dollarLeaks.map((l) => l.id)).toEqual(['untapped_database']);
    expect([r.estimate.monthlyLow, r.estimate.monthlyHigh]).toEqual([2200, 4400]);
  });

  it('holds across every Q4, Q5 and Q8 answer', () => {
    for (const response_speed of optionIds('response_speed')) {
      for (const follow_up_attempts of optionIds('follow_up_attempts')) {
        for (const old_leads of optionIds('old_leads')) {
          const r = computeScorecard({ ...greatInstall, response_speed, follow_up_attempts, old_leads }, 'general');
          if (r.dollarLeaks.length > 1) expect(r.topLeak).not.toBe('untapped_database');
          if (r.topLeak === 'untapped_database') expect(r.dollarLeaks).toHaveLength(1);
        }
      }
    }
  });

  it('gives slow response the tie at a 10% high-end lift', () => {
    const r = computeScorecard({ ...greatInstall, response_speed: '1_hour', follow_up_attempts: '4_6', old_leads: 'rarely_never' }, 'general');
    expect(r.dollarLeaks.map((l) => l.id)).toEqual(['slow_response', 'untapped_database']);
  });

  it('stays out of #1 even if tuning gives it the highest lift, but still counts in the top two', () => {
    expect(rankDollarLeaks([response, followUp, oldLeads]).map((l) => l.id)).toEqual(['short_follow_up', 'untapped_database']);
    expect(rankDollarLeaks([oldLeads, response]).map((l) => l.id)).toEqual(['slow_response', 'untapped_database']);
    expect(rankDollarLeaks([oldLeads]).map((l) => l.id)).toEqual(['untapped_database']);
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

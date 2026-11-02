import { describe, expect, it } from 'vitest';
import { ScorecardInputError } from './engine/index.ts';
import type { ScorecardAnswers } from './engine/index.ts';
import { QUESTIONS } from './questions.ts';
import { buildSubmissionRows } from './submission.ts';
import type { SubmissionInput } from './submission.ts';

const POSTGRES_INT_MAX = 2147483647;

// Great Install LLC from the simulation
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

const submission = (overrides: Partial<SubmissionInput> = {}): SubmissionInput => ({
  answers: greatInstall,
  surveyVersion: 'general',
  contact: { name: 'Sam', email: 'sam@greatinstall.example', company: 'Great Install LLC' },
  traffic: { utmSource: 'meta', utmMedium: 'paid', utmCampaign: 'launch', referrer: 'https://facebook.com/', landingPath: '/' },
  sessionId: 's_1_abc123',
  isTest: false,
  ...overrides,
});

const withAnswers = (answers: Partial<ScorecardAnswers>) => submission({ answers: { ...greatInstall, ...answers } });

describe('lead row', () => {
  it('maps a dollar result to every column', () => {
    expect(buildSubmissionRows(submission()).lead).toEqual({
      email: 'sam@greatinstall.example',
      name: 'Sam',
      company: 'Great Install LLC',
      scorecard_version: 'v2',
      survey_version: 'general',
      score: 30,
      pipeline_score: 25,
      ai_score: 34,
      ai_level: 2,
      band: 'leaking_revenue',
      challenges: ['not_enough_leads'],
      monthly_leads_band: '25_50',
      close_rate_band: '2_3',
      customer_value_band: '2k_10k',
      est_leak_low_cents: 260000,
      est_leak_high_cents: 520000,
      est_hours_low: null,
      est_hours_high: null,
      top_leak: 'slow_response',
      leaks: {
        estimateKind: 'dollars',
        dollarLeaks: [
          { id: 'slow_response', liftLow: 0.15, liftHigh: 0.3 },
          { id: 'short_follow_up', liftLow: 0.1, liftHigh: 0.2 },
        ],
        liftLowPct: 18,
        liftHighPct: 35,
        monthlyRevenue: 14800,
      },
      utm_source: 'meta',
      utm_medium: 'paid',
      utm_campaign: 'launch',
      referrer: 'https://facebook.com/',
      landing_path: '/',
      session_id: 's_1_abc123',
      is_test: false,
    });
  });

  it('maps the hours fallback: hours set, cents null', () => {
    const { lead } = buildSubmissionRows(
      submission({
        answers: {
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
      }),
    );
    expect(lead).toMatchObject({ est_leak_low_cents: null, est_leak_high_cents: null, est_hours_low: 6, est_hours_high: 10, top_leak: 'none' });
    expect(lead.leaks).toMatchObject({ estimateKind: 'hours', dollarLeaks: [], liftLowPct: 0, liftHighPct: 0 });
  });

  it('keeps hidden and shown apart when both round to $500 a month', () => {
    const noOtherLeaks = { old_leads: 'regular' };
    const hidden = buildSubmissionRows(
      withAnswers({ ...noOtherLeaks, monthly_leads: 'under_10', close_rate: '2_3', customer_value: '2k_10k', response_speed: '5_min', follow_up_attempts: '2_3' }),
    ).lead;
    const shown = buildSubmissionRows(
      withAnswers({ ...noOtherLeaks, monthly_leads: '10_25', close_rate: '2_3', customer_value: '500_2k', response_speed: 'same_day', follow_up_attempts: '4_6' }),
    ).lead;

    expect(hidden.est_leak_high_cents).toBe(50000);
    expect(shown.est_leak_high_cents).toBe(50000);
    expect(hidden.leaks.estimateKind).toBe('hidden');
    expect(shown.leaks.estimateKind).toBe('dollars');
  });

  it.each(['general', 'insurance'])('fits the largest possible %s estimate in a Postgres int', (surveyVersion) => {
    const { lead } = buildSubmissionRows(
      submission({
        surveyVersion,
        answers: { ...greatInstall, monthly_leads: '100_plus', close_rate: '6_plus', customer_value: '50k_plus', response_speed: '1_2_days', follow_up_attempts: 'once_or_none' },
      }),
    );
    expect(Number.isInteger(lead.est_leak_low_cents)).toBe(true);
    expect(Number.isInteger(lead.est_leak_high_cents)).toBe(true);
    expect(lead.est_leak_high_cents).toBeLessThanOrEqual(POSTGRES_INT_MAX);
  });

  it('records the test flag it is given', () => {
    expect(buildSubmissionRows(submission({ isTest: true })).lead.is_test).toBe(true);
  });
});

describe('contact and traffic', () => {
  it('trims and lowercases the email', () => {
    const { lead } = buildSubmissionRows(submission({ contact: { email: '  Sam@GreatInstall.Example ' } }));
    expect(lead.email).toBe('sam@greatinstall.example');
  });

  it('stores blank optional fields as null', () => {
    const { lead } = buildSubmissionRows(
      submission({ contact: { email: 'sam@greatinstall.example', name: '  ', company: '' }, traffic: { utmSource: ' ', referrer: '' } }),
    );
    expect(lead).toMatchObject({ name: null, company: null, utm_source: null, utm_medium: null, utm_campaign: null, referrer: null, landing_path: null });
  });

  it('works with no traffic data', () => {
    const { lead } = buildSubmissionRows(submission({ traffic: undefined }));
    expect(lead.utm_source).toBeNull();
    expect(lead.landing_path).toBeNull();
  });

  it('rejects a blank email or session id', () => {
    expect(() => buildSubmissionRows(submission({ contact: { email: '   ' } }))).toThrow(ScorecardInputError);
    expect(() => buildSubmissionRows(submission({ sessionId: '' }))).toThrow(ScorecardInputError);
  });
});

describe('what the browser sends is not trusted', () => {
  it('ignores computed values and stores no junk keys', () => {
    const { lead, response } = buildSubmissionRows(
      submission({ answers: { ...greatInstall, overallScore: 100, score: 100, topLeak: 'none', band: 'ready_to_scale', estimate: { monthlyHigh: 1 }, is_test: true } }),
    );
    expect([lead.score, lead.top_leak, lead.band, lead.est_leak_high_cents, lead.is_test]).toEqual([30, 'slow_response', 'leaking_revenue', 520000, false]);
    expect(Object.keys(response.answers).sort()).toEqual(QUESTIONS.map((q) => q.id).sort());
  });

  it('rejects invalid answers and survey versions', () => {
    expect(() => buildSubmissionRows(withAnswers({ response_speed: 'instantly' }))).toThrow(ScorecardInputError);
    expect(() => buildSubmissionRows(submission({ surveyVersion: 'roofing' }))).toThrow(ScorecardInputError);
    expect(() => buildSubmissionRows(submission({ answers: null }))).toThrow(ScorecardInputError);
  });
});

describe('response row', () => {
  it('holds all 11 raw answers unchanged', () => {
    expect(buildSubmissionRows(submission()).response.answers).toEqual(greatInstall);
  });

  it('keeps the Q1 Other text, trimmed, when Other is picked', () => {
    const { response } = buildSubmissionRows(submission({ answers: { ...greatInstall, challenges: ['other'], challenges_other: '  Hiring  ' } }));
    expect(response.answers.challenges_other).toBe('Hiring');
  });

  it('drops the Q1 Other text when Other is not picked or it is blank', () => {
    const notPicked = buildSubmissionRows(submission({ answers: { ...greatInstall, challenges_other: 'Hiring' } }));
    expect(notPicked.response.answers).not.toHaveProperty('challenges_other');
    const blank = buildSubmissionRows(submission({ answers: { ...greatInstall, challenges: ['other'], challenges_other: '   ' } }));
    expect(blank.response.answers).not.toHaveProperty('challenges_other');
  });
});

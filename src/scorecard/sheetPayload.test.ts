import { describe, expect, it } from 'vitest';
import { computeScorecard } from './engine/index.ts';
import { sheetAnswerColumns, sheetResultColumns } from './sheetPayload.ts';
import { PATH_A, PATH_B } from './testScriptPaths.ts';

describe('sheetAnswerColumns', () => {
  it('uses readable labels for single and multi answers', () => {
    expect(sheetAnswerColumns(PATH_A as unknown as Record<string, unknown>)).toEqual({
      challenges: 'Not enough leads',
      lead_channels: 'Referrals, Paid ads',
      monthly_leads: '25–50',
      response_speed: 'Same day',
      follow_up_attempts: '2–3 times',
      close_rate: '2–3',
      customer_value: '$2,000–$10,000',
      old_leads: 'Rarely or never',
      lead_tracking: 'Spreadsheets or inbox',
      ai_level: 'Level 2, Regular chat',
      time_sinks: 'Follow-up emails, Quotes or proposals, CRM updates and data entry',
    });
  });

  it('sends only what has been answered so far', () => {
    expect(sheetAnswerColumns({ challenges: ['leads_slip'], lead_channels: [] })).toEqual({ challenges: 'Leads slip through the cracks' });
    expect(sheetAnswerColumns({})).toEqual({});
  });

  it('includes the Q1 Other text, trimmed, and skips it when blank', () => {
    expect(sheetAnswerColumns({ challenges: ['other'], challenges_other: '  Hiring ' })).toEqual({ challenges: 'Other', challenges_other: 'Hiring' });
    expect(sheetAnswerColumns({ challenges: ['other'], challenges_other: '  ' })).toEqual({ challenges: 'Other' });
  });

  it('ignores keys that are not questions', () => {
    expect(sheetAnswerColumns({ evil: '=1+1', ai_level: 'level_0' })).toEqual({ ai_level: 'Level 0, Not using AI yet' });
  });
});

describe('sheetResultColumns', () => {
  it('maps a dollar result', () => {
    expect(sheetResultColumns(computeScorecard(PATH_A, 'general'))).toEqual({
      estimate_kind: 'dollars',
      monthly_low: 2600,
      monthly_high: 5200,
      yearly_low: 31200,
      yearly_high: 62400,
      hours_low: null,
      hours_high: null,
      top_leak: 'slow_response',
      ai_level_number: 2,
      band: 'leaking_revenue',
      survey_version: 'general',
    });
  });

  it('maps an hours result', () => {
    expect(sheetResultColumns(computeScorecard(PATH_B, 'general'))).toMatchObject({
      estimate_kind: 'hours',
      monthly_low: null,
      hours_low: 6,
      hours_high: 10,
      top_leak: 'none',
    });
  });
});

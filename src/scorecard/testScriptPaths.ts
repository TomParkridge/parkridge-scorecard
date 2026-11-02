// TEMPORARY (M1 only): the three answer paths in Tom's manual test script. Kept here so
// testScriptPaths.test.ts can prove the script's expected values. Delete with the stub in M2.
import type { ScorecardAnswers } from './engine/index.ts';

// A dollar leak
export const PATH_A: ScorecardAnswers = {
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

// The hours fallback: no dollar leak
export const PATH_B: ScorecardAnswers = {
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
};

// The hidden case: a monthly high of $480
export const PATH_C: ScorecardAnswers = {
  challenges: ['not_enough_leads'],
  lead_channels: ['referrals'],
  monthly_leads: 'under_10',
  response_speed: '5_min',
  follow_up_attempts: '2_3',
  close_rate: '2_3',
  customer_value: '2k_10k',
  old_leads: 'regular',
  lead_tracking: 'crm_fuzzy',
  ai_level: 'level_1',
  time_sinks: ['followup', 'quotes', 'crm'],
};

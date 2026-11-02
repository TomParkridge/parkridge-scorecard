// Every number and rule the engine uses. Tuning happens here, not in engine.ts.
// Source: docs/specs/scorecard-cost-model.py run2() (approved model) and the M1 brief.
// Keys are option ids from src/scorecard/questions.ts; engine.test.ts checks they match.

export type Lift = readonly [low: number, high: number];

// ---------- Cost model ----------

// Q3 leads a month: middle of the band
export const LEADS_MID: Record<string, number> = {
  under_10: 6,
  '10_25': 17,
  '25_50': 37,
  '50_100': 75,
  '100_plus': 120,
};

// Q6 out of every 10 leads
export const CLOSE_RATE: Record<string, number> = {
  '0_1': 0.10,
  '2_3': 0.20,
  '4_5': 0.40,
  '6_plus': 0.60,
  not_sure: 0.20,
};

// Q7 first-year customer value: low end of the band
export const CUSTOMER_VALUE: Record<string, number> = {
  under_500: 250,
  '500_2k': 500,
  '2k_10k': 2000,
  '10k_50k': 10000,
  '50k_plus': 50000,
};

// Insurance: annual commission x three years at 85% retention = 2.5725. Same expression as the .py.
export const RETENTION = 1 + 0.85 + 0.85 ** 2;

// Lift if fixed, per answer. null = not a leak. Final for launch (Tom, 2026-11-02).
export const RESPONSE_LIFT: Record<string, Lift | null> = {
  '5_min': null,
  '15_min': null,
  '1_hour': [0.05, 0.10],
  same_day: [0.15, 0.30],
  '1_2_days': [0.25, 0.50],
  varies: [0.15, 0.30],
};

export const FOLLOW_UP_LIFT: Record<string, Lift | null> = {
  once_or_none: [0.20, 0.40],
  '2_3': [0.10, 0.20],
  not_sure: [0.10, 0.20],
  '4_6': null,
  '7_plus': null,
};

export const REACTIVATION_LIFT: Record<string, Lift | null> = {
  regular: null,
  now_and_then: [0.03, 0.06],
  rarely_never: [0.05, 0.10],
  no_list: null,
};

export type DollarLeakId = 'slow_response' | 'short_follow_up' | 'untapped_database';

// Array order is the tie-break when two leaks have the same high-end lift.
// topOnlyWhenAlone: the leak can be #1 only when it is the only dollar leak (Tom, 2026-11-02).
export const DOLLAR_LEAKS: readonly {
  id: DollarLeakId;
  question: string;
  lifts: Record<string, Lift | null>;
  topOnlyWhenAlone?: boolean;
}[] = [
  { id: 'slow_response', question: 'response_speed', lifts: RESPONSE_LIFT },
  { id: 'short_follow_up', question: 'follow_up_attempts', lifts: FOLLOW_UP_LIFT },
  { id: 'untapped_database', question: 'old_leads', lifts: REACTIVATION_LIFT, topOnlyWhenAlone: true },
];

export const MAX_DOLLAR_LEAKS = 2;
export const CAP_HIGH = 0.35;
export const CAP_LOW = 0.175;
export const ROUND_TO = 100;
// Below this (unrounded monthly high x 12, as in run2) the page hides the dollar figure.
export const HIDDEN_YEARLY_THRESHOLD = 6000;

// Q11 time sinks: hours a week, used when there is no dollar leak. Final for launch (Tom, 2026-11-02).
export const HOURS: Record<string, Lift> = {
  leads: [2, 4],
  quotes: [3, 5],
  followup: [2, 4],
  crm: [2, 4],
  scheduling: [1, 3],
  reporting: [1, 2],
  onboarding: [2, 3],
  admin: [2, 4],
};

// ---------- Stored scores (never shown to the visitor) ----------

// Q2: index = number of sources picked, capped at the last entry (4 or more = 4)
export const LEAD_CHANNEL_POINTS = [0, 1, 2, 3, 4];

export const RESPONSE_POINTS: Record<string, number> = {
  '5_min': 4,
  '15_min': 3,
  '1_hour': 2,
  same_day: 1,
  '1_2_days': 0,
  varies: 0,
};

export const FOLLOW_UP_POINTS: Record<string, number> = {
  once_or_none: 0,
  '2_3': 1,
  '4_6': 3,
  '7_plus': 4,
  not_sure: 0,
};

export const OLD_LEADS_POINTS: Record<string, number> = {
  regular: 4,
  now_and_then: 2,
  rarely_never: 0,
  no_list: 0,
};

export const TRACKING_POINTS: Record<string, number> = {
  crm_connected: 4,
  crm_fuzzy: 2,
  spreadsheet_inbox: 1,
  none: 0,
};

export const AI_LEVEL: Record<string, number> = {
  level_0: 0,
  level_1: 1,
  level_2: 2,
  level_3: 3,
  level_4: 4,
  level_5: 5,
};

// pipelineScore = (Q2 + Q4 + Q5 + Q8) / PIPELINE_MAX_POINTS x 100
export const PIPELINE_MAX_POINTS = 16;
// aiScore = Q9 / TRACKING_MAX_POINTS x AI_TRACKING_WEIGHT + level / AI_LEVEL_MAX x AI_LEVEL_WEIGHT
export const TRACKING_MAX_POINTS = 4;
export const AI_TRACKING_WEIGHT = 40;
export const AI_LEVEL_MAX = 5;
export const AI_LEVEL_WEIGHT = 60;

export type BandId = 'leaking_revenue' | 'solid_base' | 'ready_to_scale';

// First entry whose min the overall score reaches
export const BANDS: readonly { id: BandId; min: number }[] = [
  { id: 'ready_to_scale', min: 70 },
  { id: 'solid_base', min: 40 },
  { id: 'leaking_revenue', min: 0 },
];

// ---------- #1 leak when there is no dollar leak ----------
// Approved by Tom on 2026-11-02, without the proposed one_channel candidate (see docs/build-journal.md).
// A leak qualifies when its question scores at or below maxPoints. Lowest points wins; ties go
// to the leak matching more Q1 challenge picks, then to array order. None qualify -> "none".

export type NonDollarLeakId = 'numbers_untrusted' | 'ai_ad_hoc';

export const NON_DOLLAR_LEAKS: readonly {
  id: NonDollarLeakId;
  question: 'lead_tracking' | 'ai_level';
  maxPoints: number;
  challenges: readonly string[];
}[] = [
  { id: 'numbers_untrusted', question: 'lead_tracking', maxPoints: 3, challenges: ['leads_slip', 'leads_not_converting'] },
  { id: 'ai_ad_hoc', question: 'ai_level', maxPoints: 2, challenges: ['ai_where_to_start', 'manual_work'] },
];

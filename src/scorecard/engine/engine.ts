// Scoring and cost engine. Pure: no UI, no network. Ports run2() from
// docs/specs/scorecard-cost-model.py; the arithmetic keeps Python's operation order so the
// doubles, and therefore the rounded dollars, match exactly. The scorecard-submit Edge
// Function reuses this file to recompute everything server-side.

import { QUESTIONS } from '../questions.ts';
import { roundHalfEven, roundHalfUp } from './rounding.ts';
import {
  AI_LEVEL,
  AI_LEVEL_MAX,
  AI_LEVEL_WEIGHT,
  AI_TRACKING_WEIGHT,
  BANDS,
  CAP_HIGH,
  CAP_LOW,
  CLOSE_RATE,
  CUSTOMER_VALUE,
  DOLLAR_LEAKS,
  FOLLOW_UP_POINTS,
  HIDDEN_YEARLY_THRESHOLD,
  HOURS,
  LEAD_CHANNEL_POINTS,
  LEADS_MID,
  MAX_DOLLAR_LEAKS,
  NON_DOLLAR_LEAKS,
  OLD_LEADS_POINTS,
  PIPELINE_MAX_POINTS,
  RESPONSE_POINTS,
  RETENTION,
  ROUND_TO,
  TRACKING_MAX_POINTS,
  TRACKING_POINTS,
} from './tables.ts';
import type { BandId, DollarLeakId, NonDollarLeakId } from './tables.ts';

export type SurveyVersion = 'general' | 'insurance';

export interface ScorecardAnswers {
  challenges: string[];
  lead_channels: string[];
  monthly_leads: string;
  response_speed: string;
  follow_up_attempts: string;
  close_rate: string;
  customer_value: string;
  old_leads: string;
  lead_tracking: string;
  ai_level: string;
  time_sinks: string[];
}

export type TopLeak = DollarLeakId | NonDollarLeakId | 'none';

export interface DollarLeak {
  id: DollarLeakId;
  liftLow: number;
  liftHigh: number;
}

export interface Estimate {
  kind: 'dollars' | 'hours' | 'hidden';
  monthlyLow: number | null;
  monthlyHigh: number | null;
  yearlyLow: number | null;
  yearlyHigh: number | null;
  hoursLow: number | null;
  hoursHigh: number | null;
}

export interface ScorecardResult {
  surveyVersion: SurveyVersion;
  monthlyRevenue: number;
  topLeak: TopLeak;
  dollarLeaks: DollarLeak[];
  estimate: Estimate;
  liftLowPct: number;
  liftHighPct: number;
  pipelineScore: number;
  aiScore: number;
  overallScore: number;
  aiLevel: number;
  band: BandId;
}

export class ScorecardInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScorecardInputError';
  }
}

const SURVEY_VERSIONS: readonly SurveyVersion[] = ['general', 'insurance'];

// Every question answered, every id known, multi picks unique, non-empty and within maxPicks.
export function validateAnswers(input: unknown, surveyVersion: unknown): asserts input is ScorecardAnswers {
  if (!SURVEY_VERSIONS.includes(surveyVersion as SurveyVersion)) {
    throw new ScorecardInputError(`Unknown survey version: ${String(surveyVersion)}`);
  }
  if (typeof input !== 'object' || input === null) throw new ScorecardInputError('Answers must be an object');
  const answers = input as Record<string, unknown>;

  for (const q of QUESTIONS) {
    const value = answers[q.id];
    const ids = new Set(q.options.map((o) => o.id));
    if (q.type === 'single') {
      if (typeof value !== 'string' || !ids.has(value)) throw new ScorecardInputError(`Invalid answer for ${q.id}`);
      continue;
    }
    if (!Array.isArray(value) || value.length === 0) throw new ScorecardInputError(`No picks for ${q.id}`);
    if (value.some((v) => typeof v !== 'string' || !ids.has(v))) throw new ScorecardInputError(`Invalid pick for ${q.id}`);
    if (new Set(value).size !== value.length) throw new ScorecardInputError(`Duplicate pick for ${q.id}`);
    if (q.maxPicks !== undefined && value.length > q.maxPicks) throw new ScorecardInputError(`Too many picks for ${q.id}`);
  }
}

export function bandFor(overallScore: number): BandId {
  return BANDS.find((b) => overallScore >= b.min)!.id;
}

function pick<T>(table: Record<string, T>, key: string): T {
  if (!Object.hasOwn(table, key)) throw new ScorecardInputError(`No table entry for ${key}`);
  return table[key];
}

function topNonDollarLeak(points: Record<string, number>, challenges: string[]): TopLeak {
  const ranked = NON_DOLLAR_LEAKS
    .map((leak, order) => ({
      id: leak.id,
      points: points[leak.question],
      qualifies: points[leak.question] <= leak.maxPoints,
      matches: leak.challenges.filter((c) => challenges.includes(c)).length,
      order,
    }))
    .filter((c) => c.qualifies)
    .sort((a, b) => a.points - b.points || b.matches - a.matches || a.order - b.order);
  return ranked.length ? ranked[0].id : 'none';
}

// Rank by high-end lift; a stable sort keeps DOLLAR_LEAKS order on ties. After taking the top
// two, a topOnlyWhenAlone leak moves behind the other. The combined lift is the same either way.
export function rankDollarLeaks(leaks: DollarLeak[]): DollarLeak[] {
  const topOnlyWhenAlone = (leak: DollarLeak) => (DOLLAR_LEAKS.find((l) => l.id === leak.id)?.topOnlyWhenAlone ? 1 : 0);
  return [...leaks]
    .sort((a, b) => b.liftHigh - a.liftHigh)
    .slice(0, MAX_DOLLAR_LEAKS)
    .sort((a, b) => topOnlyWhenAlone(a) - topOnlyWhenAlone(b));
}

export function computeScorecard(answers: ScorecardAnswers, surveyVersion: SurveyVersion): ScorecardResult {
  validateAnswers(answers, surveyVersion);

  // Stored scores
  const channelPoints = LEAD_CHANNEL_POINTS[Math.min(answers.lead_channels.length, LEAD_CHANNEL_POINTS.length - 1)];
  const responsePoints = pick(RESPONSE_POINTS, answers.response_speed);
  const followUpPoints = pick(FOLLOW_UP_POINTS, answers.follow_up_attempts);
  const oldLeadsPoints = pick(OLD_LEADS_POINTS, answers.old_leads);
  const trackingPoints = pick(TRACKING_POINTS, answers.lead_tracking);
  const aiLevel = pick(AI_LEVEL, answers.ai_level);

  // Weights divide evenly (100/16, 40/4, 60/5), so these stay exact multiples of 0.25.
  const pipelineRaw = ((channelPoints + responsePoints + followUpPoints + oldLeadsPoints) * 100) / PIPELINE_MAX_POINTS;
  const aiRaw = trackingPoints * (AI_TRACKING_WEIGHT / TRACKING_MAX_POINTS) + aiLevel * (AI_LEVEL_WEIGHT / AI_LEVEL_MAX);
  const overallScore = roundHalfUp((pipelineRaw + aiRaw) / 2);
  const band = bandFor(overallScore);

  // Monthly new-customer revenue: leads x close rate x value, in run2's order
  let value = pick(CUSTOMER_VALUE, answers.customer_value);
  if (surveyVersion === 'insurance') value = value * RETENTION;
  const monthlyRevenue = pick(LEADS_MID, answers.monthly_leads) * pick(CLOSE_RATE, answers.close_rate) * value;

  const dollarLeaks: DollarLeak[] = rankDollarLeaks(
    DOLLAR_LEAKS
      .map((leak) => ({ id: leak.id, lift: pick(leak.lifts, answers[leak.question as keyof ScorecardAnswers] as string) }))
      .filter((l): l is { id: DollarLeakId; lift: readonly [number, number] } => l.lift !== null)
      .map((l) => ({ id: l.id, liftLow: l.lift[0], liftHigh: l.lift[1] })),
  );

  const scores = {
    pipelineScore: roundHalfUp(pipelineRaw),
    aiScore: roundHalfUp(aiRaw),
    overallScore,
    aiLevel,
    band,
  };

  if (dollarLeaks.length === 0) {
    const hours = answers.time_sinks.map((t) => pick(HOURS, t));
    return {
      surveyVersion,
      monthlyRevenue,
      topLeak: topNonDollarLeak(
        { lead_tracking: trackingPoints, ai_level: aiLevel },
        answers.challenges,
      ),
      dollarLeaks,
      estimate: {
        kind: 'hours',
        monthlyLow: null,
        monthlyHigh: null,
        yearlyLow: null,
        yearlyHigh: null,
        hoursLow: hours.reduce((sum, [low]) => sum + low, 0),
        hoursHigh: hours.reduce((sum, [, high]) => sum + high, 0),
      },
      liftLowPct: 0,
      liftHighPct: 0,
      ...scores,
    };
  }

  // Combine with overlap: 1 - (1 - a)(1 - b), then cap
  let keepLow = 1;
  let keepHigh = 1;
  for (const leak of dollarLeaks) {
    keepLow *= 1 - leak.liftLow;
    keepHigh *= 1 - leak.liftHigh;
  }
  const liftHigh = Math.min(1 - keepHigh, CAP_HIGH);
  const liftLow = Math.min(1 - keepLow, CAP_LOW);

  const low = monthlyRevenue * liftLow;
  const high = monthlyRevenue * liftHigh;
  const monthlyLow = roundHalfEven(low, ROUND_TO);
  const monthlyHigh = roundHalfEven(high, ROUND_TO);

  return {
    surveyVersion,
    monthlyRevenue,
    topLeak: dollarLeaks[0].id,
    dollarLeaks,
    estimate: {
      // run2 tests the unrounded monthly high
      kind: high * 12 >= HIDDEN_YEARLY_THRESHOLD ? 'dollars' : 'hidden',
      monthlyLow,
      monthlyHigh,
      yearlyLow: monthlyLow * 12,
      yearlyHigh: monthlyHigh * 12,
      hoursLow: null,
      hoursHigh: null,
    },
    liftLowPct: roundHalfEven(liftLow * 100),
    liftHighPct: roundHalfEven(liftHigh * 100),
    ...scores,
  };
}

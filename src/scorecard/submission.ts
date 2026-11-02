// Turns one quiz submission into rows for assessment.leads and assessment.scorecard_responses.
// Pure: no network. The scorecard-submit Edge Function calls this, so every score and estimate
// is recomputed here from the raw answers and nothing computed by the browser is ever read.
// Every submission is a new lead row, and rows are never updated: emails are unverified, so a
// repeat email must not be able to change an existing lead (docs/build-journal.md, Step 5).

import { computeScorecard, ScorecardInputError, validateAnswers } from './engine/index.ts';
import type { DollarLeak, ScorecardAnswers, SurveyVersion, TopLeak } from './engine/index.ts';
import type { BandId } from './engine/index.ts';
import { OTHER_OPTION_ID, OTHER_TEXT_KEY, QUESTIONS } from './questions.ts';

export const SCORECARD_VERSION = 'v2';

export interface SubmissionContact {
  name?: string | null;
  email: string;
  company?: string | null;
}

export interface SubmissionTraffic {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  landingPath?: string | null;
}

export interface SubmissionInput {
  answers: unknown;
  surveyVersion: unknown;
  contact: SubmissionContact;
  traffic?: SubmissionTraffic;
  sessionId: string;
  /** Set by the server from the request's origin, never by the browser. */
  isTest: boolean;
}

export interface LeadRow {
  email: string;
  name: string | null;
  company: string | null;
  scorecard_version: string;
  survey_version: SurveyVersion;
  score: number;
  pipeline_score: number;
  ai_score: number;
  ai_level: number;
  band: BandId;
  challenges: string[];
  monthly_leads_band: string;
  close_rate_band: string;
  customer_value_band: string;
  est_leak_low_cents: number | null;
  est_leak_high_cents: number | null;
  est_hours_low: number | null;
  est_hours_high: number | null;
  top_leak: TopLeak;
  leaks: {
    estimateKind: 'dollars' | 'hours' | 'hidden';
    dollarLeaks: DollarLeak[];
    liftLowPct: number;
    liftHighPct: number;
    monthlyRevenue: number;
  };
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_path: string | null;
  session_id: string;
  is_test: boolean;
}

/** scorecard_responses.answers. lead_id is added once the lead row exists. */
export interface ResponseRow {
  answers: Record<string, unknown>;
}

// Trimmed text, or null when there is nothing left
function text(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function cents(dollars: number | null): number | null {
  return dollars === null ? null : dollars * 100;
}

// Only known question ids are copied, so junk keys in a request are never stored
function rawAnswers(answers: ScorecardAnswers): Record<string, unknown> {
  const source = answers as unknown as Record<string, unknown>;
  const raw: Record<string, unknown> = {};
  for (const q of QUESTIONS) raw[q.id] = source[q.id];

  const other = source[OTHER_TEXT_KEY];
  if (answers.challenges.includes(OTHER_OPTION_ID) && typeof other === 'string' && other.trim()) {
    raw[OTHER_TEXT_KEY] = other.trim();
  }
  return raw;
}

export function buildSubmissionRows(input: SubmissionInput): { lead: LeadRow; response: ResponseRow } {
  const { answers, surveyVersion, contact, traffic = {}, sessionId, isTest } = input;
  validateAnswers(answers, surveyVersion);

  const email = contact.email.trim().toLowerCase();
  if (!email) throw new ScorecardInputError('Email is required');
  if (!sessionId) throw new ScorecardInputError('Session id is required');

  const result = computeScorecard(answers, surveyVersion as SurveyVersion);

  return {
    lead: {
      email,
      name: text(contact.name),
      company: text(contact.company),
      scorecard_version: SCORECARD_VERSION,
      survey_version: result.surveyVersion,
      score: result.overallScore,
      pipeline_score: result.pipelineScore,
      ai_score: result.aiScore,
      ai_level: result.aiLevel,
      band: result.band,
      challenges: answers.challenges,
      monthly_leads_band: answers.monthly_leads,
      close_rate_band: answers.close_rate,
      customer_value_band: answers.customer_value,
      // Monthly, including the hidden case. Yearly is this x 12.
      est_leak_low_cents: cents(result.estimate.monthlyLow),
      est_leak_high_cents: cents(result.estimate.monthlyHigh),
      est_hours_low: result.estimate.hoursLow,
      est_hours_high: result.estimate.hoursHigh,
      top_leak: result.topLeak,
      // estimateKind cannot be derived from the cents: $480 (hidden) and $510 (shown) both round to $500
      leaks: {
        estimateKind: result.estimate.kind,
        dollarLeaks: result.dollarLeaks,
        liftLowPct: result.liftLowPct,
        liftHighPct: result.liftHighPct,
        monthlyRevenue: result.monthlyRevenue,
      },
      utm_source: text(traffic.utmSource),
      utm_medium: text(traffic.utmMedium),
      utm_campaign: text(traffic.utmCampaign),
      referrer: text(traffic.referrer),
      landing_path: text(traffic.landingPath),
      session_id: sessionId,
      is_test: isTest,
    },
    response: { answers: rawAnswers(answers) },
  };
}

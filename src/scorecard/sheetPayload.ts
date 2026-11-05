// Google Sheets columns for a v2 submission, keyed as docs/apps-script/Code.gs expects. Answers are
// written as readable labels, because people read this sheet. Pure: App.jsx sends the result.

import type { ScorecardResult } from './engine/index.ts';
import { OTHER_TEXT_KEY, QUESTIONS } from './questions.ts';

export function sheetAnswerColumns(answers: Record<string, unknown>): Record<string, string> {
  const columns: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const value = answers[q.id];
    const label = (id: unknown) => q.options.find((o) => o.id === id)?.label ?? String(id);
    if (Array.isArray(value) && value.length > 0) columns[q.id] = value.map(label).join(', ');
    else if (typeof value === 'string' && value) columns[q.id] = label(value);
  }
  const other = answers[OTHER_TEXT_KEY];
  if (typeof other === 'string' && other.trim()) columns[OTHER_TEXT_KEY] = other.trim();
  return columns;
}

// ai_level is the Q10 answer's label; ai_level_number is the engine's level, 0 to 5
export function sheetResultColumns(result: ScorecardResult) {
  return {
    estimate_kind: result.estimate.kind,
    monthly_low: result.estimate.monthlyLow,
    monthly_high: result.estimate.monthlyHigh,
    yearly_low: result.estimate.yearlyLow,
    yearly_high: result.estimate.yearlyHigh,
    hours_low: result.estimate.hoursLow,
    hours_high: result.estimate.hoursHigh,
    top_leak: result.topLeak,
    ai_level_number: result.aiLevel,
    band: result.band,
    survey_version: result.surveyVersion,
  };
}

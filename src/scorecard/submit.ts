// Sends a finished quiz to the scorecard-submit endpoint in the background. It never throws and
// never delays the results. Retrying is safe: the server ignores a session id it has already saved.

import { SCORECARD_SUBMIT_URL } from './env.ts';
import type { SubmissionContact, SubmissionTraffic } from './submission.ts';

export interface SubmissionPayload {
  sessionId: string;
  answers: Record<string, unknown>;
  contact: SubmissionContact;
  traffic: SubmissionTraffic;
  [honeypot: string]: unknown;
}

const RETRY_DELAY_MS = 2000;

async function attempt(body: string, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(SCORECARD_SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
    // A 4xx will fail the same way again
    return res.status < 500;
  } catch {
    return false;
  }
}

export async function sendSubmission(
  payload: SubmissionPayload,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  retryDelayMs: number = RETRY_DELAY_MS,
): Promise<void> {
  const body = JSON.stringify(payload);
  if (await attempt(body, fetchImpl)) return;
  await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  await attempt(body, fetchImpl);
}

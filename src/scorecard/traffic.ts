// Where a visitor came from, captured on first page load and kept for the browser session, so
// it still reaches the submission if the URL changes. The first values in a session win.

import type { SubmissionTraffic } from './submission.ts';

const STORAGE_KEY = 'scorecard_traffic';

export function readTraffic(search: string, referrer: string, landingPath: string): SubmissionTraffic {
  const params = new URLSearchParams(search);
  return {
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
    referrer: referrer || null,
    landingPath: landingPath || null,
  };
}

// Storage can throw or come back empty (private windows, blocked site data); capture still works.
// Even reading window.sessionStorage can throw, so that also happens inside the try.
export function captureTraffic(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
  current: SubmissionTraffic = readTraffic(window.location.search, document.referrer, window.location.pathname),
): SubmissionTraffic {
  try {
    const store = storage ?? window.sessionStorage;
    const saved = store.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as SubmissionTraffic;
    store.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Fall through to the values from this page load
  }
  return current;
}

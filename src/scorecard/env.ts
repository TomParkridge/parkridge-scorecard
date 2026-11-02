// Production is the custom domain only. Vercel previews, the git-main vercel.app alias and
// localhost all count as non-production: Meta Pixel, HubSpot, EmailJS and Mixpanel stay off
// there, and Sheets rows get a test_ session id. index.html repeats this hostname for the
// Pixel and HubSpot loaders; keep the two in sync.

export const PRODUCTION_HOSTNAME = 'scorecard.parkridgeadvisory.com';

// Public endpoint. The server decides from the request's origin whether a row is a test.
export const SCORECARD_SUBMIT_URL = 'https://tknkwbfusywxxazndeks.supabase.co/functions/v1/scorecard-submit';

export function isProduction(hostname: string = window.location.hostname): boolean {
  return hostname === PRODUCTION_HOSTNAME;
}

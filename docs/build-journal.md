# M1 Scorecard v2: build journal

## 2026-10-29: Step 1, inspect before building

**Built:** Branch `scorecard-v2` created from `main` (eb74a72). Specs committed in
docs/specs/ (b1784a4). No app code changed.

**What the repo is today**
- Vite 8 + React 19, plain JS/JSX (no TypeScript), ESLint flat config, inline styles plus
  App.css/index.css. No test runner. Env vars use the `VITE_` prefix and live only in the
  Vercel dashboard (no .env or .vercel/ in the repo).
- No serverless functions (no `api/` folder). vercel.json has one SPA catch-all rewrite.
- Routing is client-side in src/main.jsx: `/insurance` and `/insurance/*` render
  InsuranceApp.jsx; every other path renders App.jsx. `?r=1&...` renders a shared report
  directly from URL params (both apps). `?mp_id=` links Mixpanel identity.
- Everything is in two ~1,640-line files. App.jsx holds QUESTIONS (16 questions with
  per-question score functions), LEAK_DEFS, calcRevenueLeak(), the Results screen, and
  handleSubmit(). InsuranceApp.jsx is a near-copy (586 differing lines).

**Data flow on submit (all in the browser)**
- Google Sheets: Apps Script webhook (URL hardcoded in App.jsx), posted after every question
  and again on submit, upserted by session_id. Keys: session_id, timestamp, completed,
  q1_challenge ... q15_deal_size, first_name, email, company, score, report_url
  (insurance adds industry). The Apps Script source is not in this repo.
- HubSpot: Forms API v3, unauthenticated, portal 245806817, form 62f93bdb-...
  Fields: email, firstname, company. Context: pageUri, pageName. No hutk cookie sent.
  HubSpot tracking script loaded in index.html.
- EmailJS: report email to the lead, Tom BCC'd via template. VITE_EMAILJS_SERVICE_ID,
  VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY.
- Mixpanel (VITE_MIXPANEL_TOKEN) and Meta Pixel (Lead event on submit).
- No secret keys reachable from browser code. Everything exposed is public by design.
  Caveats: anyone can POST rows to the Sheets webhook. The shared report URL carries name
  and email in its query string.
- No Supabase usage anywhere.

**Decisions and recommendations (awaiting Tom)**
- Step 6 storage: recommend option (a), a Supabase Edge Function `scorecard-submit` in
  ~/parkridge-assessment. There is no existing Vercel function to extend, and (a) keeps
  the service role key off Vercel.
- Caveat for (a): _shared/config.ts requires every secret (Stripe, Anthropic, Calendly,
  ...) at import time. The public function should build its own Supabase client from
  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and load logEvent lazily after the insert, so a
  missing paid-side secret can never block lead capture. `lead_created` must be added to
  EventName in _shared/slackFormat.ts.
- Preview deploys will send real HubSpot, Sheets, EmailJS and Meta Pixel traffic unless
  guarded.

**Noted, not fixed**
- calcRevenueLeak() reads answers.lead_volume, which no question sets anymore, so the live
  estimate always assumes 20 leads/month. The Step 3 engine replaces it.

**Tom's decisions (2026-10-29)**
- Storage: option (a) approved. `scorecard-submit` builds its own Supabase client from the
  runtime variables, writes the row first, then lazily loads logEvent. Add `lead_created`
  to EventName. No ADMIN_API_TOKEN.
- The Edge Function recomputes the estimate and all scores server-side from the raw answers
  with the same engine. It never trusts computed values sent by the browser.
- TypeScript for src/scorecard/ only; Vitest as a dev dependency.
- Preview deploys: Meta Pixel, HubSpot, EmailJS and Mixpanel off. Supabase and Sheets still
  written, rows marked as tests. Production behavior unchanged. Additive changes only.
- Sheets payload stays unchanged until Tom shares the Apps Script code.
- InsuranceApp.jsx and the /insurance routes are not touched in M1.
- Step 2 changes to App.jsx stay minimal: wire in the question config, no refactor.

**For M2**
- Shared report links (`?r=1&nm=...&em=...`) carry the lead's name and email in the URL.
  M2 should replace them with a private results link.
- The Google Sheets webhook accepts posts from anyone, so fake rows are possible.

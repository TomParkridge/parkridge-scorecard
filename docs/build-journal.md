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

## 2026-10-29: Step 2, question config and preview guard

**Built**
- src/scorecard/questions.ts: the 11 locked questions, copied from the handoff spec, with
  stable question and option ids. Option ids follow the cost model keys; Q11 ids match the
  .py HOURS keys. Q1 "Other" text is stored as `challenges_other` (max 120 chars, optional).
- App.jsx: old 16-question array removed; QuestionView renders the new config (option ids,
  question and option help text, max picks with dimmed options at the limit, "Pick up to 3"
  hint, Q1 Other text box). Old scoring, results and report URL code left in place; the two
  score divisions are guarded, so the branch shows score 0 and no leaks until Steps 3 and 7.
- Preview guard: src/scorecard/env.ts `isProduction()` is an exact hostname match on
  scorecard.parkridgeadvisory.com. Off production: Meta Pixel and the HubSpot tracking
  script (index.html), Mixpanel (analytics.js), HubSpot form POST and EmailJS (App.jsx) are
  skipped. Sheets still posts, with session ids starting `test_`.
- Tooling: TypeScript 6.0 (typescript-eslint supports <6.1), typescript-eslint, Vitest 4.1
  (Vitest 5 does not support local Node 25). `npm run typecheck`, `npm test`.
- Tests: 23 passing. They include a cross-check that parses the spec markdown and compares
  every prompt, option label and help text; verified it fails when a label is changed.

**Why these choices**
- Hostname over VITE_VERCEL_ENV: no dependency on Vercel settings, and a misfire can only
  turn tracking off on a non-production host, never on the live domain.
- `test_` session prefix over new Sheets keys: the Apps Script ignores unknown keys, so new
  keys would vanish without a hand redeploy. The prefix needs no script change and leaves
  production payloads identical.

**Vercel (from Tom)**
- Team slug tom-8931s-projects; production branch main; preview env vars set.
- Production domains: scorecard.parkridgeadvisory.com and
  parkridge-scorecard-git-main-tom-8931s-projects.vercel.app (treated as non-production).
- Step 6 CORS allowlist: https://scorecard.parkridgeadvisory.com and
  ^https://parkridge-scorecard-[a-z0-9-]+-tom-8931s-projects\.vercel\.app$ only.
  CORS is not the protection for a public endpoint; validation and rate limits are.

**Google Sheets (Apps Script read)**
- doPost upserts by session_id (column A) and writes fixed keys to fixed columns 1-26;
  unknown keys are dropped. sendToSheet() is unchanged, and v2 answer ids do not collide
  with old keys, so v2 rows fill columns 1-7 and 26 only.
- M2 PREREQUISITE: before merging to main, add v2 answer keys to sendToSheet and new
  columns 27+ to the Apps Script (Tom redeploys), or production rows lose all answers.
- Apps Script issues for Tom (not changed in M1): setValue treats strings starting with
  "=" as formulas, and the HYPERLINK for report_url is string-concatenated, so the public
  webhook allows formula injection; prefix such values with '. The live app sends
  q4_marketing_spend and q8b_deals_closed_90d, which the script never writes.

**Anything Tom needs to know**
- /insurance on preview still sends its own HubSpot form and EmailJS (InsuranceApp.jsx is
  off limits). Do not test /insurance on preview. A visitor with JavaScript disabled still
  fires the Pixel noscript image; that cannot be gated without JS.
- Lint already failed on main with 10 errors (react-hooks/static-components,
  no-unused-vars, react-refresh). Step 2 adds none; they are left alone per the
  no-refactor rule.
- Copy flagged for M2: the intro's "5-minute assessment", "Pipeline Health Score" and
  "Benchmark Comparison", and the contact step's "your score".
- Q10 labels and help text are shown exactly as the spec writes them (lowercase help).

## 2026-10-29: Step 3, scoring and cost engine

**Built** (src/scorecard/engine/, pure TypeScript, no UI or network, not yet wired into App.jsx)
- tables.ts: every number and rule (lead/close/value tables, retention, the three lift
  tables, caps, hidden threshold, hours, points, score weights, bands, the non-dollar rule).
- rounding.ts: roundHalfEven matches Python round(x) and round(x, -2) on the exact binary
  value (x % step is exact for doubles), roundHalfUp for the stored scores.
- engine.ts: validateAnswers (every question answered, ids known, multi picks unique,
  non-empty, within maxPicks; throws ScorecardInputError) and computeScorecard, a line-by-line
  port of run2() that keeps Python's operation order, so the doubles match bit for bit.
- Imports use explicit .ts extensions (tsconfig allowImportingTsExtensions) so the Step 6
  Edge Function can use these files unchanged under Deno.
- Tests: 58 passing. Spot checks match the brief: Great Install LLC $2,600-$5,200 slow
  response; Summit Farmers Agency (insurance) $2,800-$5,400 short follow-up; NetGuard IT
  6-10 hours. Every table's keys are checked against the option ids in questions.ts.

**Decisions (Tom approved the defaults on 2026-10-29)**
1. Hidden threshold follows run2: the UNROUNDED monthly high x 12 is compared with $6,000.
   The brief's "yearly high" (rounded monthly x 12) differs only for a monthly high
   between $450 and $500.
2. topLeak is never "hours". With no dollar leak, estimate.kind = "hours" and topLeak comes
   from the non-dollar rule. Step 4 compares run2's "hours" with estimate.kind.
3. overallScore averages the unrounded sub-scores, then rounds half up; pipelineScore and
   aiScore are rounded half up for storage.
4. Non-dollar #1 leak rule: STILL PROPOSED, needs Tom's confirmation. In tables.ts:
   - numbers_untrusted when Q9 <= 3 points; one_channel when Q2 = 1 source;
     ai_ad_hoc when AI level <= 2. Points used for ranking are those question points.
   - Lowest points wins; ties go to the candidate matching more Q1 picks
     (numbers_untrusted: leads_slip, leads_not_converting; one_channel: not_enough_leads;
     ai_ad_hoc: ai_where_to_start, manual_work), then to that list order. None -> "none".
   - NetGuard IT and Shield Pest Control both come out "none".

**Anything Tom needs to know**
- The run2 personas have no Q1 answers, so the Step 4 fixtures need a Q1 pick per persona.
  It only affects the non-dollar tie-break, and only NetGuard and Shield have no dollar
  leak; both are "none" regardless.
- The build prints a parse5 notice about the Meta Pixel <noscript> in <head>. main prints
  it too; it is harmless.

## 2026-11-02: Tom's decisions on the #1 leak and the cost tables

**Tom's decisions (2026-11-02)**
1. Non-dollar #1 leak rule approved, with one_channel removed. This replaces the proposal in
   the Step 3 entry. Candidates: numbers_untrusted (Q9 <= 3 points) and ai_ad_hoc (AI level
   <= 2). Lowest points wins, ties go to the candidate matching more Q1 picks, none -> "none".
2. untapped_database can be #1 only when it is the only dollar leak.
3. The lift ranges and the hours table are final for launch. No numbers changed.

**Built**
- tables.ts: one_channel removed from NON_DOLLAR_LEAKS and NonDollarLeakId; a
  topOnlyWhenAlone flag on the untapped_database entry in DOLLAR_LEAKS; comments mark the lift
  and hours tables final.
- engine.ts: rankDollarLeaks() applies the flag after taking the top two, so the leak stays in
  the combined estimate and only gives up the #1 slot. The dead Q2 input to the non-dollar
  rule is gone. Q2 still counts toward pipelineScore.
- Tests: the old non-dollar test relied on one_channel and was replaced.

**Anything Tom needs to know**
- Decision 2 changes no result today. Old leads tops out at a 10% high-end lift, every other
  dollar leak starts at 10% or more, and the tie at 10% already goes to slow response. The flag
  protects the rule if the lift tables are tuned later. run2() and the Step 4 fixtures still
  agree, and Benson & Cole Law keeps old leads as #1 because it is that firm's only dollar leak.
- Decision 1 affects only businesses with no dollar leak and one lead source. Where one_channel
  used to win, they now get the next qualifying leak, or "none" with a connected CRM and AI
  level 3 or higher.
- Not specified by Tom, kept from the proposal: when Q1 picks also tie, table order decides,
  so numbers_untrusted wins. not_enough_leads no longer breaks any tie.
- Specs not updated, so they still show these items as open or proposed: the M1 brief (Step 3),
  the handoff (Open items), cost-model-and-simulation.md and results-page-approved.md.
- M2: the leak lookup table in results-page-approved.md still has a One-channel dependence row,
  which can no longer be used, and has no copy for topLeak "none". NetGuard IT and Shield Pest
  Control both land on "none", so the page needs copy for that case.

## 2026-11-02: Step 4, tests against the 20 simulated businesses

**Built**
- tests/fixtures/generate-cost-model-cases.py: loads the cost model .py unchanged, maps persona
  values to option ids (an unmapped value raises an error) and writes cost-model-cases.json.
- src/scorecard/engine/cost-model.test.ts: all 20 businesses against run2(), plus the brief's
  four spot checks hardcoded, so a bad regeneration cannot pass unnoticed.
- engine.test.ts: caps (each end capped on its own), top two leaks only, half-even rounding
  through the engine, the hidden threshold, stored scores at 39/40 and 69/70, and the extremes.
- Tests: 105 passing. Engine and tables unchanged. All 20 businesses matched on the first run.

**Why these choices**
- Every persona's Q1 pick is growth_stalled because the personas have no Q1 answers and
  validation requires one. It matches neither no-dollar-leak candidate, so it cannot decide a
  tie. The fixtures therefore do not test the Q1 tie-break; engine.test.ts does.
- Hidden threshold tests use $480 (hidden) and $510 (shown). Both round to $500 a month, so
  they lock the Step 3 decision to compare the unrounded high.

**Checks beyond the test run**
- The generator run twice gives an identical file.
- The fixtures match the spec's 20-business table in cost-model-and-simulation.md (monthly or
  hours range, #1 leak, share of revenue): 20 of 20, no differences.
- Nine deliberate breaks were all caught, then reverted: a lift value, both caps, the hidden
  threshold, an hours value, a band boundary, the retention multiplier, testing the rounded
  high, and removing topOnlyWhenAlone.

**Anything Tom needs to know**
- None of the 20 businesses is in the hidden case (18 dollars, 2 hours), so only the unit tests
  cover it. That is not a gap in the fixtures' accuracy, but the simulation never exercised it.
- The cap binds so often that raising same_day's high-end lift from 30% to 31% changed only 2
  tests. This matches the spec's finding that business size, not the lift table, drives most
  numbers.
- run2() does not compute stored scores, so those are checked against the brief's formula by
  hand-worked unit tests, not against the Python model.

## 2026-11-02: Step 5, what each submission stores

**Tom's decisions (2026-11-02, plan approved)**
- The same email submitting twice creates a new lead row each time. The public endpoint never
  updates or merges a row. Emails are unverified, so updating by email would let anyone who
  knows a client's address overwrite that client's record, even on a lead with a paid order.

**Built**
- src/scorecard/submission.ts: pure buildSubmissionRows() returns { lead, response }. It
  validates, recomputes with computeScorecard and ignores any computed value sent by the
  browser. Only known question ids reach scorecard_responses.answers, plus challenges_other
  when Other is picked.
- Migration 003 in ~/parkridge-assessment (branch m1-scorecard-storage, not pushed): adds
  referrer, landing_path, session_id and is_test to assessment.leads, and a unique constraint
  on session_id. Lead type in src/lib/types.ts updated to match.
- Tests: 120 passing here, all five paid-repo checks pass. Migration tested on PGlite with 001,
  002, 003: 13 checks, including a second run changing nothing and a retry not overwriting.
- No live row is written yet. The endpoint is Step 6.

**Why these choices**
- session_id only stops a double-tap or retry creating a second row. A retake is a new page
  load, so it gets a new id and a new row.
- Email is stored trimmed and lowercased, so rows for one person group together.
- est_leak_*_cents hold the monthly range. Yearly is that x 12.
- estimateKind is stored in the existing leaks jsonb because the cents cannot tell hidden from
  shown: $480 (hidden) and $510 (shown) both round to $500.
- Referrer and landing path sit on leads beside the UTMs. Raw answers and the Q1 Other text go
  in scorecard_responses.answers, which needs no new columns.
- is_test will be set by the server from the request's origin (Step 6), never by the browser.
- Lead row is written first, then the response row, with no transaction. If the second write
  fails, the lead is kept and an alert goes to Slack, but those raw answers are lost. Keeping
  the lead matters more, and this needs no database function.

**Anything Tom needs to know**
- STILL TO DO BY HAND: run 003 in the Supabase SQL editor before Step 6 is deployed. It has
  only run on PGlite, not on the live database.
- M2 rule: an order must attach to a specific lead id from the results link, never by looking
  up an email. Stripe's confirmed email is the first verified one.
- Counting people means counting distinct emails, and reports should filter on not is_test.
  Deleting someone's data must cover every row for that email.
- Not changed: HubSpot's form merges by email, so an unverified submission can already overwrite
  a contact's first name and company, and EmailJS sends to whatever address is typed.
- The contact form only collects a first name, so leads.name holds a first name. The handoff
  says "name" and the results page wants a full name. Flagged for M2.
- For the Step 6 plan: the paid repo's hard rule 3 bans insurance terms and it is clean today,
  but the engine contains insurance logic and has to run in that repo's Edge Function.
- The preview URL redirects to Vercel login (Vercel Authentication is on), so only signed-in
  team members can open it.

**Tom's follow-up (2026-11-02)**
- First name only is settled: the contact form stays as is, and M2 uses "{First name},
  {Company}" on the Snapshot cover. results-page-approved.md still lists a full name, so update
  it in M2.
- Migration 003 is held for review: do not push or merge m1-scorecard-storage until Tom says so.
- Step 6 plan: Tom's preferred fix for the insurance conflict is to amend hard rule 3 in the paid
  repo's CLAUDE.md to allow insurance terms only in the shared scorecard engine files
  (survey_version "insurance" and its multiplier). The ban stays everywhere else.
- Migration 003 applied by Tom and verified: column_count = 33, leads_session_id_key present.
  Branch m1-scorecard-storage pushed, not merged.

## 2026-11-02: Step 6, the scorecard-submit endpoint and traffic capture

**Tom's decisions (2026-11-02, plan approved)**
- is_test is decided by the server from the request's origin. Only
  https://scorecard.parkridgeadvisory.com counts as real. Preview origins are allowed and marked
  as tests; anything else, or no origin, gets 403 and no row.
- A duplicate session_id returns the same success as a new submission and changes nothing,
  including when that IP is over the rate limit.
- Hard rule 3 in the paid repo's CLAUDE.md amended (Option A): the copied engine folder is the one
  exception. It also has to cover the empty insuranceLabel field and code comments, which goes
  slightly beyond Tom's wording. A test there enforces the ban everywhere else.

**Built**
- Paid repo (branch m1-scorecard-storage): supabase/functions/scorecard-submit/ (handler.ts holds
  the logic and is unit-tested, index.ts is thin Deno wiring), the engine copy in
  _shared/scorecard/, lead_created in slackFormat.ts, migration 004 (ip_hash and an index), the
  rule 3 change and its guard test.
- This repo: scripts/sync-engine-to-assessment.mjs (copy, and --check to catch drift),
  src/scorecard/traffic.ts, src/scorecard/submit.ts, the endpoint URL in env.ts, and minimal
  App.jsx changes: capture traffic, a hidden honeypot field, one send call in handleSubmit.
- InsuranceApp.jsx, HubSpot, Sheets and EmailJS are unchanged.

**Why these choices**
- The endpoint always uses survey version "general" and reads none from the request. The insurance
  code in the engine copy stays inactive until that fork exists.
- index.ts builds its own Supabase client and loads logEvent only after the row is written, because
  _shared/config.ts requires every paid-side secret at import and must not block lead capture.
- Rate limit is counted in the database because Edge Function memory does not reliably persist:
  10 new leads per IP per hour. If the check itself fails, the lead is still saved.
- ip_hash is an HMAC of the IP keyed with the runtime's service role key, so there is no new secret
  to set and the raw IP is never stored. If the key changes, the current hour's counts reset.
- The honeypot field has a meaningless name (field_7q) because browsers autofill by name, and a
  false positive would silently lose a real lead.
- Long traffic values are cut short, not rejected, so a long referrer cannot lose a lead.

**Anything Tom needs to know**
- Reading window.sessionStorage can itself throw when site data is blocked. The first version of
  traffic.ts did that outside its try and would have crashed the page on load; fixed before commit,
  with a test.
- A script can forge the Origin header, so a curl with the production origin would get
  is_test = false. is_test labels our own traffic; it is not a security control.
- Whether Supabase lets a caller override x-forwarded-for is unknown until the live check.
- Editing questions.ts, submission.ts or the engine now needs a sync and a redeploy of
  scorecard-submit, or the server scores with old rules. --check catches this; nothing runs it
  automatically.

**Deployed and live-checked (2026-11-02)**
- Migration 004 applied by Tom and verified: column_count = 34, ip_index = 1. scorecard-submit
  deployed (version 1) from m1-scorecard-storage at 9ffe42c, which is not merged to main. Tom's
  CLAUDE.md wording covering insuranceLabel is approved.
- ip_hash confirmed keyed: HMAC-SHA-256 with the runtime's service role key. Nothing plain-hashes
  the IP, so no dedicated secret was added. A dedicated key would be cleaner but is not needed.
- All 19 stage 1 checks passed on the live endpoint: CORS, disallowed origins, validation, size
  limit, honeypot, and a replay returning the identical response.
- Faking the IP did not work with any header tried. Ten requests with a different fake
  x-forwarded-for each still tripped the limit on request 10 (1 earlier row + 9 new). Two-value,
  IPv6 and garbage x-forwarded-for, x-real-ip, true-client-ip and forwarded all got 429.
  cf-connecting-ip got 403 from Cloudflare. A saved session replayed over the limit got 200.
- The checks created 10 test rows. Over-limit requests wrote nothing.

**Still unproven, must be settled before production**
- Whether the limit is really per visitor. The results would look the same if the platform gave
  every visitor one shared value, which would cap the whole site at 10 leads an hour. IPv4 and
  IPv6 from this machine leave from the same public address, so they could not test this. It
  needs a submission from another network, with a different ip_hash on its row.
- Slack delivery of lead_created. The Slack connector cannot see the channel or the messages, so
  this needs Tom's eyes on #ai-alerts and the assessment.events query.
- The is_test = false path on the live endpoint: first check at production launch in M2.

**Step 6 closed by Tom (2026-11-02)**
- Query 1 matched: 10 test rows, 10 marked test, 1 distinct hash, 0 replay rows, 10 response rows,
  10 lead_created events, 0 slack_failed in the last day.
- The rate limit is per visitor: Tom's phone submission on cellular is the newest row (is_test
  true, utm_source phonetest, has_answers true) with a different ip_prefix from the smoke rows.
- Slack: 0 slack_failed rows means the webhook accepted the posts. Tom's confirmation still had
  template text ("[or: Slack messages did not arrive]"), so seeing them in #ai-alerts is unconfirmed.

## Pre-launch list (before M2 goes live)
- Switch the ip_hash HMAC key from the service role key to a dedicated secret (Tom, 2026-11-02).
  Generate it straight into a gitignored env file without printing it, set it with supabase
  secrets set --env-file, then redeploy scorecard-submit. Rate limit counts reset for the current
  hour; nothing else changes.
- Add the v2 answer keys to sendToSheet and new columns 27+ to the Apps Script, which Tom redeploys,
  or production Sheets rows lose all answers.
- Fix the Apps Script formula injection: prefix values starting with "=" with '. The webhook is
  public and this is live today, independent of v2.
- Replace the shared report links, which carry the lead's name and email in the URL.
- Merge m1-scorecard-storage to main in the paid repo, and run
  node scripts/sync-engine-to-assessment.mjs --check to confirm the deployed engine matches.
- First check after launch: a real submission from the production domain has is_test = false.
- Decide whether to clear the smoke-test rows (smoke-test@example.com) and the phonetest row.

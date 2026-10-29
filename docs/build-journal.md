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

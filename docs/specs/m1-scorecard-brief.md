# Build task: M1 Scorecard v2 (general version)

Updated Oct 29, 2026 (repo found, M0 complete).

## Context
I'm Tom, founder of Parkridge Advisory. M0 (the paid-side foundation in ~/parkridge-assessment)
is DONE: 8 tables in the `assessment` schema, migration 002 applied, secrets set, functions
deployed behind ADMIN_API_TOKEN, smoke tests passed. M1 rebuilds the free AI readiness
scorecard: the old 16-question quiz becomes 11 tap-to-answer questions plus a contact step,
and a new scoring and cost engine computes a monthly "revenue leak" estimate, the #1 leak and
stored sub-scores.

M1 is the quiz and the engine only. The results page (the "AI Revenue Snapshot") is M2 and is
NOT built here. Because of that, M1 lives on a branch with preview deploys and does not merge
to production until M2 is done.

Repos:
- SCORECARD repo (this task): the live site at scorecard.parkridgeadvisory.com.
  GitHub: TomParkridge/parkridge-scorecard. Local path: ~/parkridge-scorecard.
  Hosted on Vercel. A push to `main` deploys straight to the LIVE site, so never push to main.
- PAID-SIDE repo (read only, except Step 5/6 if needed): ~/parkridge-assessment
  (Supabase project ref tknkwbfusywxxazndeks)

Before anything else, run `pwd` and confirm you are in ~/parkridge-scorecard. Earlier sessions
started in an old ~/Documents folder by mistake. Run every command from ~/parkridge-scorecard
(or ~/parkridge-assessment for paid-side work), never from ~/Documents.

Specs. These are in docs/specs/ in the scorecard repo (I copied them in, not yet committed;
commit them on the scorecard-v2 branch in Step 1). Treat them as the source of truth:
- docs/specs/scorecard-v2-handoff.md      the 11 locked questions, order, labels, help text
- docs/specs/cost-model-and-simulation.md the cost formula, tables, decisions, simulation
- docs/specs/scorecard-cost-model.py      reference implementation; run2() is the APPROVED model
- docs/specs/results-page-approved.md     for context only (M2), including the leak lookup table
- docs/specs/m1-scorecard-brief.md        this brief

Decisions already made:
- General-business version only. Insurance becomes a separate fork on its own URL, built later.
  The engine still supports survey_version "insurance" (customer value x 2.5725) because one
  of the 20 test cases is an insurance agency.
- Keep what already works: the UI look and flow, HubSpot sync and Google Sheets logging.
- Everything copy- or number-related lives in lookup tables (config), so copy and tuning changes
  never need code changes.
- The score, band and sub-scores are computed and stored, never shown to the visitor.
- Supabase: my existing project, shared with the diagnostic app (its live client data is in the
  `public` schema). Lead data goes in the `assessment` schema. Never read, alter or drop
  anything outside it. Every SQL statement must be schema-qualified with `assessment.`.
  No DROP statements without my explicit approval.
- No new paid tools.

## Ground rules for this session
1. One step at a time. Start each step in plan mode: show the plan, wait for my OK, then build.
2. When I need to do something by hand (Vercel dashboard, env vars, Supabase SQL editor),
   stop and give exact click-by-click instructions. Never guess values.
3. Match this repo's existing conventions (framework, TypeScript, lint, test runner, styling).
   If it has no test runner, propose adding Vitest (dev dependency only).
4. Work on a branch named `scorecard-v2`. Commit after each step. Never commit secrets.
   Never push to main. Pushing the branch is fine (it creates a Vercel preview deploy).
5. After each step, append a dated entry to docs/build-journal.md: what was built, key decisions
   and why, anything I need to know. Create the file if it does not exist.
6. No em-dashes in any user-facing copy.
7. Never print, echo or log secret values, and keep them out of commands that land in shell
   history.

## Steps

### Step 1: Inspect before building (no code changes except committing the specs)
Create the scorecard-v2 branch and commit docs/specs/ to it. Then report back on:
- Stack: framework, bundler, env var prefix, Vercel setup, how preview deploys work.
- Routes: every public URL the quiz and results use today (these must keep working).
- Data flow on submit: where answers go today (HubSpot, Google Sheets, anything else), whether
  that happens in the browser or in a serverless function, and which keys are exposed client-side.
  Flag any secret key reachable from browser code.
- HubSpot: the exact property names the current sync writes.
- The current question set and scoring code, and where results are computed and rendered.
- Whether the repo already talks to Supabase.
Then propose the Step 6 storage design (see Step 6 for the options) and wait.

### Step 2: Question config (the 11 locked questions)
Create one config file (e.g. src/scorecard/questions.ts) that the quiz UI renders from.
Copy every label, option and help text exactly from docs/specs/scorecard-v2-handoff.md
("Final 11 questions"). Each question: stable id, number, section, prompt, type
(single | multi), max picks for multi, options with stable ids, optional help text, and an
optional `insuranceLabel` field (empty for now, for the later fork).

Sections and order:
- Your challenge: Q1 biggest challenge (multi, up to 3; "Other" opens a short text box)
- Your pipeline: Q2 lead sources (multi, pick all) · Q3 leads a month · Q4 response speed ·
  Q5 follow-up attempts · Q6 close rate out of 10 · Q7 first-year customer value (with help
  text) · Q8 reaching back out to old leads
- Your tools and AI: Q9 lead tracking · Q10 AI level (0 to 5, help text on every option) ·
  Q11 time sinks (multi, up to 3)
- Contact step: name, email, company

Wire the existing quiz UI to this config. Keep the current look, progress indicator and
tap-to-answer flow. Remove the 5 questions that moved to paid intake and the dropped one.
Target: the whole quiz finishes in under 3 minutes.

### Step 3: Scoring and cost engine (pure TypeScript, no UI, no network)
Create src/scorecard/engine/ with pure functions and all tables in a separate tables file.
Port run2() from scorecard-cost-model.py exactly. Input: answer ids + survey_version.
Output object:
{
  surveyVersion, monthlyRevenue,
  topLeak,                  // slow_response | short_follow_up | untapped_database | hours | <non-dollar leak id>
  dollarLeaks: [...],       // the top two dollar leaks used, in rank order
  estimate: { kind: "dollars" | "hours" | "hidden",
              monthlyLow, monthlyHigh, yearlyLow, yearlyHigh,   // dollars
              hoursLow, hoursHigh },                            // hours
  liftLowPct, liftHighPct,
  pipelineScore, aiScore, overallScore, aiLevel, band
}

Cost model (from the spec and run2):
- Monthly new-customer revenue = leads (band middle) x close rate x customer value (band low).
  Leads: Under 10 = 6 · 10-25 = 17 · 25-50 = 37 · 50-100 = 75 · 100+ = 120
  Close rate: 0-1 = 10% · 2-3 = 20% · 4-5 = 40% · 6+ = 60% · Not sure = 20%
  Value: Under $500 = 250 · $500-2K = 500 · $2K-10K = 2,000 · $10K-50K = 10,000 · $50K+ = 50,000
  Insurance: value x (1 + 0.85 + 0.85^2) = 2.5725
- Lift tables: Q4 response, Q5 follow-up, Q8 old leads, exactly as RESP, FU and REACT in the .py.
- Rank dollar leaks by high-end lift, ties: slow_response, then short_follow_up, then
  untapped_database. Take the top two.
- Combine with overlap: 1 - (1 - a)(1 - b), separately for low and high. Cap high at 35%,
  low at 17.5%.
- Monthly low/high = revenue x combined lift, rounded to the nearest $100. IMPORTANT: Python's
  round(x, -2) rounds halves to even (2650 -> 2600, 2750 -> 2800). Match it exactly or the
  test cases will drift.
- Yearly = rounded monthly x 12.
- kind "hidden" when yearly high < $6,000 (the page will lead with the consequence instead).
- No dollar leak -> kind "hours": sum the Q11 picks from the hours table
  (leads 2-4 · quotes 3-5 · follow-up 2-4 · CRM 2-4 · scheduling 1-3 · reporting 1-2 ·
  onboarding 2-3 · admin 2-4).

Stored scores (not shown). Each answer gives 0 to 4 points:
- Q2 sources: 1 = 1 · 2 = 2 · 3 = 3 · 4+ = 4
- Q4 response: 5 min = 4 · 15 min = 3 · hour = 2 · same day = 1 · 1-2 days = 0 · varies = 0
- Q5 follow-up: once or none = 0 · 2-3 = 1 · 4-6 = 3 · 7+ on a schedule = 4 · not sure = 0
- Q8 old leads: regular = 4 · now and then = 2 · rarely or never = 0 · no list = 0
- Q9 tracking: connected CRM = 4 · CRM with copy-paste = 2 · spreadsheets or inbox = 1 · none = 0
- Q10 AI level: the level number, 0 to 5
- pipelineScore = (Q2 + Q4 + Q5 + Q8) / 16 x 100
- aiScore = Q9 / 4 x 40 + level / 5 x 60
- overallScore = (pipelineScore + aiScore) / 2; round half up to whole numbers
- band: 0-39 leaking_revenue · 40-69 solid_base · 70-100 ready_to_scale

Top leak when there is no dollar leak (PROPOSED, flag it in the journal for my confirmation):
pick the weakest of numbers_untrusted (Q9 below 4), one_channel (Q2 = 1 source) and ai_ad_hoc
(level 2 or lower), lowest points first; ties broken by the Q1 challenge picks; none qualify ->
"none". Keep this rule in the tables file so I can change it.

### Step 4: Tests (the 20 simulated businesses)
- Write a small one-off script that imports the .py's P, SINKS, INSURANCE and run2() and dumps
  each persona's inputs and run2() output to tests/fixtures/cost-model-cases.json (inputs mapped
  to this repo's answer ids, Q11 picks from SINKS). Run it with python3 and commit the JSON.
- Unit tests: all 20 must match exactly (monthly low/high or hours low/high, top leak, status).
  Expected spot checks: Great Install LLC $2,600-$5,200, slow response; Summit Farmers Agency
  (insurance) $2,800-$5,400; NetGuard IT 6-10 hours; Shield Pest Control 4-9 hours.
- Add unit tests for: the 35% / 17.5% caps, the half-even rounding, the hidden case
  (yearly high under $6,000), the stored scores and band boundaries (39/40, 69/70).
Stop and show me the test output before Step 5.

### Step 5: Save each submission to Supabase
One row per submission in assessment.leads. What the live database already has (verified Oct 29):

assessment.leads (29 columns):
- From migration 001: id uuid, created_at timestamptz, email text, name text, company text,
  phone text, scorecard_version text, score numeric, leaks jsonb, opportunities jsonb,
  utm_source text, utm_medium text, utm_campaign text, hubspot_contact_id text, status text
  (status has a check constraint; use an allowed value).
- From migration 002 (applied): pipeline_score int, ai_score int, ai_level smallint, band text,
  challenges text[], monthly_leads_band text, close_rate_band text, customer_value_band text,
  est_leak_low_cents int, est_leak_high_cents int, est_hours_low int, est_hours_high int,
  top_leak text, survey_version text.
- Reuse existing columns rather than duplicating: `score` for the overall score, the utm_*
  columns for UTMs, `scorecard_version` = "v2" (survey_version stays "general" or "insurance").
- There is also an assessment.scorecard_responses table (linked to leads). Read its columns
  in ~/parkridge-assessment (migration 001) and propose whether raw answers (jsonb), the Q1
  "Other" text, referrer and landing path go there or need new columns.

Also store: name, email, company, all raw answers (jsonb), Q1 "Other" text, overall score,
utm_source, utm_medium, utm_campaign, referrer, landing path, created_at.
If any new columns are needed, write the migration in the PAID-SIDE repo (it owns the schema)
as 003, additive only (ADD COLUMN IF NOT EXISTS), and give me the SQL to run by hand in the
Supabase SQL editor. Never `db push`.

### Step 6: Storage path and traffic source
- Capture UTM parameters, referrer and landing path on first page load, keep them in
  sessionStorage, and send them with the submission.
- The assessment schema grants access only to service_role, so the write must happen
  server-side. Recommend one of these from what Step 1 found, then wait for my OK:
  (a) a Supabase Edge Function `scorecard-submit` in the paid-side repo (service role stays
      server-side; validates answer ids against the config; inserts the row), or
  (b) the scorecard's existing Vercel serverless function, if it has one, with the Supabase
      service role key as a server-only env var.
- This endpoint is PUBLIC (anyone taking the quiz calls it). It must NOT use ADMIN_API_TOKEN;
  that token is only for internal admin endpoints and never goes near browser code. Protect it
  instead with: strict validation of every answer id against the config, size limits on all
  free text, a honeypot field, basic rate limiting, and CORS limited to
  scorecard.parkridgeadvisory.com and this project's Vercel preview domains.
- M0 found that the Supabase runtime's service role key differs from the dashboard key, but
  database writes from Edge Functions work (proven by the M0 smoke test rows). Use the
  runtime-provided client in Edge Functions; don't paste dashboard keys into function code.
- Never put the service role key in browser code. Never allow anonymous select on lead data.
- Keep the existing HubSpot sync and Google Sheets logging working with the same property
  names. New HubSpot properties for the estimate and top leak come in M2.
- Optionally log a `lead_created` event to assessment.events (posts to Slack #ai-alerts)
  using the existing logEvent helper, if option (a) is chosen.

### Step 7: Old links and preview
- Every old public route lands somewhere sensible (redirect old quiz URLs to the new quiz).
- Until M2 builds the Snapshot, the branch shows a plain temporary results stub on preview only:
  the computed estimate, top leak and hours. Mark it clearly as temporary in the code.
- Give me the preview URL and a 5-minute manual test script: 3 answer paths (a dollar leak,
  the hours fallback, the hidden case) and what row I should see in Supabase for each.

## Done when
- The general version runs on the Vercel preview deploy and finishes in under 3 minutes.
- Each submission writes one row in assessment.leads with the estimate, top leak,
  survey_version "general" and the traffic source.
- All 20 fixture cases and the extra unit tests pass.
- Old links still land, and HubSpot and Google Sheets still receive submissions.
- docs/build-journal.md has an entry per step, including the proposed non-dollar leak rule.
- Nothing merged or pushed to main (it ships with M2).

Start with Step 1, in plan mode.

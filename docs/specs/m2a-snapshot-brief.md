# Build task: M2a, the AI Revenue Snapshot (results page, email, Sheets, HubSpot)

Nov 5, 2026 · Tom Vignard

## Context
M0 (paid-side foundation, ~/parkridge-assessment) and M1 (scorecard v2: 11 questions, scoring and
cost engine, lead storage, public scorecard-submit endpoint) are DONE and tested on the
scorecard-v2 preview. Nothing is merged to main. M1 ships together with M2.

M2 is split in two:
- **M2a (this brief):** replace the temporary results stub with the approved AI Revenue Snapshot
  page, give each lead a private results link, and bring the results email, Google Sheets and
  HubSpot up to v2. None of this needs pending business decisions.
- **M2b (later, separate brief):** offer page, Stripe checkout with SOW and terms, payment
  webhook, then the launch checklist. Blocked on price and product name.

Repos and rules are unchanged from M1:
- SCORECARD repo: ~/parkridge-scorecard, branch scorecard-v2. Vercel deploys main to the LIVE
  site, so never push to main. Pushing the branch is fine (preview deploy).
- PAID-SIDE repo: ~/parkridge-assessment (Supabase project tknkwbfusywxxazndeks). Work on a
  new branch m2a-snapshot cut from m1-scorecard-storage. Migrations are additive only, schema-
  qualified with `assessment.`, run by Tom by hand in the SQL editor. Never `db push`.
- Run `pwd` first; never work from ~/Documents.

Specs in docs/specs/ (source of truth):
- results-page-approved.md: the approved V5 layout, style rules, dynamic fields and the leak
  copy lookup table
- results-page-v5-reference.html: static V5 markup with sample data (copy layout and styles)
- logo-horizontal-white.svg / .png: the logo for the navy cover band
- m2-parking-lot.md: open decisions and the pre-launch list
- this brief

## Ground rules (same as M1)
1. One step at a time, plan mode first, wait for my OK, then build.
2. Click-by-click instructions whenever I have to do something by hand (Supabase, EmailJS,
   Google Apps Script, HubSpot, Vercel). Never guess values.
3. Commit after each step, append a dated entry to docs/build-journal.md, never commit secrets,
   never print or log secret values.
4. No em-dashes in user-facing copy. Locked Parkridge palette and DM Sans only.
5. Do not touch InsuranceApp.jsx or /insurance.
6. Keep every piece of copy in lookup tables so copy changes need no code changes.

## Steps

### Step 1: Inspect and plan (no code changes)
Report on: how the temporary stub gets its data today; what the scorecard-submit response
returns; the current EmailJS call and template parameters; the current Sheets payload and how
the Apps Script maps columns; the HubSpot Forms API call and whether it can send extra contact
properties (and whether they must exist in HubSpot first). Then propose the plan for Steps 2 to
6, including the three proposed copy blocks below, and wait.

### Step 2: Google Sheets v2 (fixes a LIVE issue, do it first)
Write a full updated Apps Script that:
- neutralizes formula injection: any string value starting with =, +, - or @ is written with a
  leading apostrophe;
- stays backward compatible with the payload production sends TODAY (the old 16-question keys),
  because main keeps using this script until M1 and M2 merge;
- adds columns for the v2 payload (the 11 answers, estimate, top leak, AI level, band,
  survey_version, snapshot link, is_test).
Then update sendToSheet on the branch for the v2 keys. Give me click-by-click steps to paste the
script and redeploy as a new version of the SAME deployment, so the webhook URL doesn't change,
plus a 1-minute check that production rows still arrive.

### Step 3: Private results link
- Each submission gets an unguessable results token (at least 128 bits of randomness, generated
  server-side in scorecard-submit). Store only a hash of it in assessment.leads (migration 005,
  additive). The submit response returns the token once.
- New public Edge Function `scorecard-result`: takes a token, returns only what the Snapshot
  displays (first name, company, date, estimate, top leak, survey_version). Never email, phone,
  raw answers or scores. Same CORS allowlist and a rate limit like scorecard-submit. Unknown
  token returns 404 with no detail.
- Results URL shape: /results/<token> on the scorecard site. Reloading or sharing it shows the
  same Snapshot. Old ?r=1 links keep working as they do today; no new ones are generated.
- Tests: token never logged, hash lookup, no PII beyond the display fields, 404 path.

### Step 4: The AI Revenue Snapshot page
Replace the temporary stub with the V5 design, exactly per results-page-approved.md and the
reference HTML: cover band, number panel, biggest leak with three "How AI fixes it" cards,
AI Revenue Roadmap panel, footer. Responsive down to 360px wide.
- Cover: "{First name}, {Company}" (the form collects first name only). Meta row: Prepared for
  {First name} · Company · Date. Fallbacks per the spec ("there", "your business").
- Leak copy from the lookup table in results-page-approved.md (six leaks).
- "Get my AI roadmap" button: links to /roadmap, a placeholder page for now ("Coming soon" in
  the Parkridge style). M2b builds the real offer page there. No price anywhere.
- Video tile: show it as designed with no video yet; clicking does nothing (video comes later).
- Download: a print stylesheet so the browser's Save as PDF produces a clean branded page
  (no new libraries or paid tools).
- Share: native share sheet where available, otherwise copy the /results/<token> link with a
  small "Link copied" confirmation. Log a `snapshot_shared` event (no PII) to assessment.events.
- Edge cases, using the PROPOSED copy below (Tom confirms at Step 1 review):

  **A. Hours version (estimate kind "hours")**, number panel:
  - "{First name}, your team is losing about"
  - "{low}–{high} hours" with " a week" in the small style
  - "to busywork AI can take off your plate. About {low×4}–{high×4} hours a month."

  **B. Hidden version (yearly high under $6,000)**, number panel shows no dollars:
  - "{First name}, {Company}'s biggest leak is"
  - the leak title in the big number style (smaller size so it fits, e.g. 48px)
  - its consequence line from the lookup table.
  The "Your biggest leak" section below then shows only "How AI fixes it" (no repeated title).

  **C. No leak at all (top leak "none")**: skip the "Your biggest leak" section entirely; show
  the number panel (hours) and the Roadmap panel. Label above the Roadmap panel stays as is.

- Remove the temporary stub and its tests.
- Tests: rendering for all four states (dollars, hours, hidden, none) using the M1 Step 7 test
  paths A, B, C, plus a "none" case; fallbacks; no em-dashes in any rendered copy.

### Step 5: Results email
- The results email (EmailJS) shows: greeting with first name, the monthly and yearly range (or
  the hours / hidden / none variants), the biggest leak title and consequence, a "View your AI
  Revenue Snapshot" button to /results/<token>, and the "Get my AI roadmap" button. Short,
  Parkridge-styled, works in Gmail and Outlook, no em-dashes.
- Give me the full EmailJS template HTML to paste, the exact template parameter names, and
  click-by-click steps. Update the send call on the branch (still off on preview).
- Also give me click-by-click steps to restrict EmailJS to the domain
  scorecard.parkridgeadvisory.com in the EmailJS dashboard, if that setting exists, so nobody
  can use the public key to send email from other sites.

### Step 6: HubSpot
- Propose contact properties: estimate monthly low and high, top leak, AI level, band,
  survey_version, snapshot link. Give me click-by-click steps to create them in HubSpot (or
  tell me if the Forms API can't send them and what the alternative is).
- Update the HubSpot sync on the branch to send them (still off on preview).

### Step 7: Preview test script
A 10-minute script: the four Snapshot states, reload and share of /results/<token>, Save as
PDF, the /roadmap placeholder, phone layout, and the Supabase rows to check. Then report M2a
against the "Done when" list.

## Done when
- The V5 Snapshot renders correctly on preview for dollars, hours, hidden and none, on desktop
  and phone, and Save as PDF looks clean.
- /results/<token> reloads and shares without exposing email or answers; unknown tokens 404.
- The Apps Script is redeployed with the formula fix, production rows still arrive, and v2 rows
  carry the new columns.
- The EmailJS template and HubSpot properties are ready (sending stays off on preview).
- The temporary stub is gone; all tests, typecheck and lint for src/scorecard pass.
- docs/build-journal.md has an entry per step. Nothing merged to main.

Start with Step 1, in plan mode.

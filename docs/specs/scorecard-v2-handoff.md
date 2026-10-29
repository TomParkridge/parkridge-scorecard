# AI Readiness Scorecard v2: Handoff

Oct 27, 2026 · Tom Vignard

Direction: reuse the live scorecard (scorecard.parkridgeadvisory.com), keep its look and flow, and simplify it to 11 questions and a short results page. Core message: AI turns the same ad spend into more revenue.

Links:
- Approved results page: claude/results-page-approved.md and source claude/results-page-v5.dc.html (design canvas https://claude.ai/artifact/EnJ1Un8o25n5Fg3cFoRkYF, artboard V5, locked Oct 27; V3 superseded)
- M1 build brief for Claude Code: claude/m1-scorecard-brief.md
- Cost model, decisions and 20-business simulation: claude/cost-model-and-simulation.md
- Scoring and results spec (needs updating, see Open items): https://claude.ai/artifact/W8okCaTxW1smY5q72jQ5sh
- Earlier results page mockups (superseded): https://claude.ai/artifact/EcpP76tnSVr9pLTBWvfkBR

## Two surveys

General business ships first. Insurance gets its own survey on its own URL, built as a separate fork with insurance wording. Same 11 questions and the same results page; the differences are labels and the customer-value math (three years at 85% retention).

## Final 11 questions (locked Oct 27)

Order: their challenge, then the pipeline in the order a lead moves (with the numbers inside it), then tools and AI last. AI goes last because it is the hardest question, it frames the quiz as a revenue quiz that uses AI as the fix, and it sets up "How AI fixes it" on the results page.

**Your challenge**

1. What's your biggest challenge right now? (pick up to 3): Not enough leads · Leads don't turn into customers · Leads slip through the cracks · Profit margins are too thin · My team is buried in manual work · Growth has stalled · I don't know where to start with AI · Other (opens a short text box)

**Your pipeline**

2. How do most customers find you? (pick all): Referrals · Paid ads · Organic search · Social media · Outbound · Partners
3. How many new leads do you get in a typical month? Under 10 · 10–25 · 25–50 · 50–100 · 100+
4. How quickly does someone respond to a new lead? Within 5 minutes · Within 15 minutes · Within an hour · Same day · 1–2 days · It varies
5. How many times does someone follow up before a lead is dropped? Once or not at all · 2–3 times · 4–6 times · 7+ times, on a set schedule · Not sure
6. Out of every 10 new leads, about how many become customers? 0–1 · 2–3 · 4–5 · 6 or more · Not sure (insurance label: out of every 10 quotes, how many bind)
7. What's a new customer worth to you, on average (first-year value)? Under $500 · $500–$2,000 · $2,000–$10,000 · $10,000–$50,000 · $50,000+ (help text: "A rough guess is fine; we only use it to estimate what leaks cost you." Insurance label: average annual commission per new client; the model multiplies it by 2.57 for three years at 85% retention)
8. Do you ever reach back out to old leads or past customers? Yes, on a regular schedule · Now and then, when we think of it · Rarely or never · We don't have a list we could use

**Your tools and AI**

9. How do you track leads and results? A CRM connected to our other tools, with numbers we trust · A CRM, but lots of copy-paste and fuzzy numbers · Spreadsheets or inbox · No real system
10. Which best describes how your business uses AI today? (each option has help text)
   - Level 0, Not using AI yet: we haven't started, or only tried it once or twice
   - Level 1, Occasional chat: someone asks ChatGPT, Claude or Copilot a question now and then
   - Level 2, Regular chat: the team uses AI chat weekly for emails, writing, notes or research
   - Level 3, Set up for our business: custom GPTs, Claude Projects, skills or saved prompts loaded with our documents, templates and tone
   - Level 4, AI that does tasks: agents or automations that respond to leads, update the CRM or draft proposals, with a person reviewing
   - Level 5, Built into how we work: AI runs inside core workflows, connected to our systems, and results are measured
11. Which tasks eat the most time each week? (pick up to 3): Responding to new leads · Quotes or proposals · Follow-up emails · CRM updates and data entry · Scheduling · Reporting · Client onboarding · Admin and back office

Contact step: name, email, company.

Reviewed against the live 16-question scorecard. Moved to paid intake or the discovery call: what you've tried, CPL/CAC, who sells, where deals fall apart, what the business does, annual revenue. Dropped: years in business. Marketing spend left out on purpose: people guess at it, and "without spending more on ads" lives in the copy instead.

## Free results page (V5, locked Oct 27)

Full spec: claude/results-page-approved.md. In short: a personalized **AI Revenue Snapshot** with a navy cover band ("Prepared for {name}, {company}"), one monthly dollar range as the main number, the #1 leak with three "How AI fixes it" outcomes, and the **AI Revenue Roadmap** offer with a "Get my AI roadmap" button that goes to an offer page, then Stripe. No score, no #2 leak, no per-leak cost, no price on the button. V5 keeps the V3 layout with modern styling: 4px corners, hairline borders, no shadows, larger medium-weight headlines.

## Scoring and cost logic (decided Oct 27)

Full formula, tables and simulation: claude/cost-model-and-simulation.md.

- Monthly new-customer revenue = leads (middle of band) × close rate × customer value (low end of band; insurance × 2.57).
- The top two dollar leaks combine with overlap, capped at 17.5–35% of that revenue. Yearly = × 12.
- No dollar leak → show hours a week from the Q11 time sinks.
- The scoring engine in the spec doc stays: points per answer, sub-scores and AI level are still computed and stored (for the paid report and HubSpot), just not shown.
- Q1 picks still break ties; no branching in the question flow.

## Learnings

- Free page = what's wrong and what it costs. Paid plan = why, how to fix it, and in what order.
- Repeating answers back adds nothing. Translate answers into consequences and dollars.
- Too many scores confuse. One number, one leak, one offer.
- A leak that sounds like a chore ("email old leads") kills the sale. Lead with leaks AI solves and effort cannot.
- Show the what of AI, keep the how behind the paywall.
- The dollar figure is the strongest hook. Keep it conservative, as a range, and never above 35% of new-customer revenue.
- Present it as a consultant document, personalized, with the offer as its last section. A pitch-style block breaks the flow.
- Keep everything as lookup tables so copy changes need no code changes.

## Open items

- Confirm the lift ranges and the hours table.
- Decide whether "old leads" can take the #1 slot.
- Confirm the proposed #1 leak rule when there is no dollar leak (in the M1 brief, Step 3).
- Price for the paid product ($500–$1,000 range); it lives on the offer page.
- Align the paid product name (AI Revenue Roadmap vs AI Assessment) across the offer page, Stripe, SOW and emails.
- Build the offer page and restyle the results email to match the approved page.
- Insurance survey fork: separate URL, insurance labels, retention multiplier.
- Turnaround: "10 days" mentioned; confirm whether that is report delivery time.
- Update the spec doc: the 11 questions and new order, cost formula, one-leak results page. Question numbers in the spec's scoring tables are now out of date (the M1 brief has the remapped point tables).
- Find the real scorecard repo. The local ~/parkridge-scorecard folder is an empty Vite template; the live site's code lives elsewhere.
- M0 schema (paid-side repo, Claude Code in VS Code): add to assessment.leads before Step 3 runs: pipeline_score int, ai_score int, ai_level smallint, band text, challenges text[], monthly_leads_band text, close_rate_band text, customer_value_band text, est_leak_low_cents int, est_leak_high_cents int, est_hours_low int, est_hours_high int, top_leak text, survey_version text (general or insurance). Drop the earlier industry and revenue_band suggestion.

# Scorecard Cost Model: Decisions and Simulation

Oct 27, 2026 · Tom Vignard

The formula behind the dollar number on the AI Revenue Snapshot (claude/results-page-approved.md), the decisions behind it, and a 20-business test run.

## Decisions (Oct 27)

1. **Cap the combined loss at 35%** of monthly new-customer revenue. Two leaks combine with overlap, not by adding: combined = 1 − (1 − a)(1 − b). The low end is capped at 17.5% so the range stays about 2x.
2. **Leads use the middle of the band;** customer value keeps the low end. This stops the low end of every band compounding.
3. **Insurance gets its own survey on its own URL** (a separate fork). Customer value = annual commission per new client × 2.57, which is three years at 85% retention (1 + 0.85 + 0.72).
4. **No dollar leak → show hours a week instead,** from the Q11 time sinks.

Still open: whether "old leads" can take the #1 slot; confirming the lift ranges and the hours table below.

## The formula

**Monthly new-customer revenue** = leads × close rate × customer value

| Input | Band → value used |
|---|---|
| Q3 Leads a month (middle) | Under 10 → 6 · 10–25 → 17 · 25–50 → 37 · 50–100 → 75 · 100+ → 120 |
| Q6 Close rate | 0–1 → 10% · 2–3 → 20% · 4–5 → 40% · 6+ → 60% · Not sure → 20% |
| Q7 Customer value (low end) | Under $500 → $250 · $500–2K → $500 · $2K–10K → $2,000 · $10K–50K → $10,000 · $50K+ → $50,000 (insurance: × 2.57) |

**Lift if fixed (draft):**

| Leak | Answer → lift range |
|---|---|
| Slow response (Q4) | Within 5 or 15 min → none · Within an hour → 5–10% · Same day → 15–30% · 1–2 days → 25–50% · It varies → 15–30% |
| Short follow-up (Q5) | Once or none → 20–40% · 2–3 times → 10–20% · Not sure → 10–20% · 4+ → none |
| Untapped database (Q8) | Now and then → 3–6% · Rarely or never → 5–10% · Regular → none · No list → none |

**Headline** = revenue × combined lift of the top two dollar leaks (capped at 17.5–35%), rounded to $100. Yearly = × 12. The #1 leak is the one with the highest high-end lift; ties go slow response, then follow-up, then old leads.

**Edge cases:** yearly high under $6,000 → hide the dollar figure and lead with the consequence. No dollar leak → hours a week.

**Hours a week by Q11 pick (draft):** Responding to new leads 2–4 · Quotes or proposals 3–5 · Follow-up emails 2–4 · CRM updates 2–4 · Scheduling 1–3 · Reporting 1–2 · Client onboarding 2–3 · Admin 2–4. Sum their picks.

## Simulation: 20 businesses, before and after

| Company | Staff | #1 leak | Before (monthly) | After (monthly) | Share of new-customer revenue, after |
|---|---|---|---|---|---|
| Clear Path Coaching | 1 | Follow-up | $300–$600 | $300–$700 | 15–28% |
| Lens & Light Photography | 1 | Slow response | $500–$1,000 | $400–$800 | 18–35% |
| Mike's Mobile Plumbing | 1 | Follow-up | $700–$1,400 | $600–$1,200 | 18–35% |
| Hartley Realty | 1 | Slow response | $2,000–$4,000 | $2,900–$5,700 | 8–15% |
| Ledger Bookkeeping | 2 | Follow-up | $1,400–$2,800 | $800–$1,700 | 18–35% |
| Wasatch Wealth Partners | 4 | Slow response | $2,000–$4,000 | $2,400–$4,800 | 18–35% |
| Summit Farmers Agency (insurance) | 5 | Follow-up | $750–$1,500 | $2,800–$5,400 | 15–28% |
| Tally CPA Group | 6 | Slow response | $5,400–$10,800 | $3,600–$7,100 | 18–35% |
| Glow Med Spa | 8 | Slow response | $1,250–$2,500 | $1,300–$2,600 | 18–35% |
| Great Install LLC | 10 | Slow response | $2,500–$5,000 | $2,600–$5,200 | 18–35% |
| Spark Digital Agency | 10 | Slow response | $3,600–$7,200 | $6,000–$11,600 | 18–34% |
| Benson & Cole Law | 12 | Old leads | $1,500–$3,000 | $2,200–$4,400 | 3–6% |
| Peak Roofing | 15 | Follow-up | $35,000–$70,000 | $26,200–$52,500 | 18–35% |
| NetGuard IT | 18 | None | No number | 6–10 hours a week | — |
| Bright Smile Dental | 20 | Follow-up | $1,500–$3,000 | $2,200–$4,200 | 15–28% |
| Sparkle Home Cleaning | 20 | Follow-up | $14,000–$28,000 | $10,500–$21,000 | 18–35% |
| Evergreen Landscaping | 25 | Slow response | $9,000–$18,000 | $5,200–$10,400 | 18–35% |
| Ridgeline Custom Homes | 30 | Slow response | $12,500–$25,000 | $14,900–$29,800 | 18–35% |
| SunCore Solar | 30 | Follow-up | $15,000–$30,000 | $17,400–$33,600 | 15–28% |
| Shield Pest Control | 30 | None | No number | 4–9 hours a week | — |

**Results after the changes:** median $2,700–$5,300 a month (was $2,000–$4,000). Nothing above 35% of new-customer revenue (was up to 90% for six businesses). The insurance agency rose from $750–$1,500 to $2,800–$5,400.

## Findings to act on

- **The cap binds for most businesses:** 11 of 18 land at exactly 18–35%. The number is now driven mainly by business size; the lift table only changes the result for milder cases.
- **Solo owners still come in low:** three show under $750 a month, below a $750 price. They're also the weakest buyers, so this may be acceptable.
- **The hours fallback looks small for big teams:** 4–10 hours a week for 18–30 person firms, because the survey doesn't ask team size.
- **Old leads still took #1 once** (the law firm), pending that decision.

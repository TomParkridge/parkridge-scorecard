# Parking Lot: Before M2 and Launch

Nov 5, 2026 · Tom Vignard

M1 (scorecard v2: 11 questions, scoring and cost engine, lead storage, public submit endpoint) is built and tested on the scorecard-v2 preview. Nothing is merged to main. M1 ships together with M2. This is the list of parked items and open decisions to clear before launch.

## Parked by Tom

- **Landing page redesign (scorecard intro screen):** rewrite the content to be AI-focused (AI revenue optimization), matching the new 11 questions and the AI Revenue Snapshot. The current intro still pitches the old pipeline quiz. Do in M2, before launch.

## Decisions needed (for M2)

- **Price** of the AI Revenue Roadmap: original range $500–$1,000; the webinar outline (Oct 29) uses $499. Pick one number and use it everywhere.
- **Product name:** AI Revenue Roadmap vs AI Assessment, aligned across offer page, Stripe, SOW and emails.
- **"10 days":** confirm whether that is report delivery time.

## Decided (Nov 2)

- No-dollar-leak #1 rule: weakest of "numbers you can't trust" and "AI used ad hoc", ties by Q1 picks. One-channel dependence removed (conflicts with the same-ad-spend message).
- "Old leads" can be #1 only when it is the only dollar leak.
- Lift ranges and hours table are final for launch; tune later with real data.
- Contact form stays first name only. The Snapshot cover uses "{First name}, {Company}" (update results-page-approved.md, which still says full name).
- Every submission is a new lead row; the public endpoint never updates rows (emails are unverified).

## Must do before launch (from the M1 build)

- **Google Sheets (live issue today):** the Apps Script accepts formula injection (values starting with =). Fix: prefix such values with an apostrophe, then redeploy without changing the webhook URL.
- **Google Sheets (v2):** add the v2 answer keys to sendToSheet and new columns to the Apps Script, or production rows lose their answers.
- **Results email and Sheets score / report_url** still use the old scoring code (would send a score of 0). Replace in M2.
- **HubSpot:** off on preview, so untested. Do a real check at launch; add new properties for the estimate and top leak.
- **Shared report links** put name and email in the URL. Replace with a private results link in M2.
- **ip_hash key:** switch the HMAC key from the service role key to a dedicated secret.
- **Remove** the temporary results stub and its tests.
- **First production check:** a real submission on scorecard.parkridgeadvisory.com writes is_test = false.
- **Merge** paid-side branch m1-scorecard-storage to main (migrations 003 and 004 are already live).
- **Don't submit /insurance on preview:** it still sends real HubSpot and EmailJS traffic.

## Later

- Insurance fork on its own URL (insurance labels, 2.57x customer value).
- Pre-existing lint errors on main (10), optional cleanup.

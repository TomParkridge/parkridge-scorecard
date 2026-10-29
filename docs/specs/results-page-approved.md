# Free Results Page: Approved UI (V5, locked)

Oct 27, 2026 · Tom Vignard · Approved and locked (replaces V3)

Design canvas: https://claude.ai/artifact/EnJ1Un8o25n5Fg3cFoRkYF (artboard "V5: APPROVED (Oct 27, locked)"; V1 to V4 are earlier rounds)
Source file: claude/results-page-v5.dc.html (in this project). claude/results-page-v3.dc.html is kept for reference only.
Cost model and simulation: claude/cost-model-and-simulation.md

## Concept

The free results page is a short personalized consultant document, the **AI Revenue Snapshot**, not a quiz score. It shows one number, one leak and one next step. The paid product it leads to is named on the page as the **AI Revenue Roadmap**: the free Snapshot shows what's wrong and what it costs, the paid Roadmap shows how to fix it.

V5 keeps the V3 layout and copy exactly and modernizes the styling: square 4px corners instead of soft rounded cards, a hairline border instead of a drop shadow, larger medium-weight headlines with tight letter spacing.

## Layout, top to bottom

One white document (max width 800px, 4px radius, 1px #E2E8F0 border, no shadow) on a #F8FAFC page background, 64px top and bottom padding. Inner side padding 56px.

1. **Cover band** (navy #1E293B, the page's only dark element)
   - Top row: white horizontal logo (26px tall), left. Right: "AI REVENUE SNAPSHOT" label (12px, 600, 0.14em tracking, #FF6B2B), then Download and Share as one joined pair of 44px outlined buttons (1px #475569, 4px outer corners, white 1.6px stroke icons).
   - Name line: "{Full name}, {Company}" at 44px, weight 500, -0.03em tracking, white.
   - Meta row under a 1px #334155 rule: three small columns, Prepared for · Company · Date (12px uppercase #9AA5B1 labels, 15px white values).
2. **The number** (#FFF1E8 panel, square, 2px #FF6B2B top rule)
   - 48px white square tile (4px radius) with the leak icon in #E85D20.
   - "{First name}, {Company} is losing about" (18px, #475569)
   - "$X–$Y a month" (72px, weight 500, -0.045em tracking, navy #1E293B; "a month" 20px #475569)
   - "from leads it's already paying for. About **$A–$B a year.**" (16px; the yearly range in 600 navy)
3. **Your biggest leak**
   - Label with a small square orange marker: "YOUR BIGGEST LEAK" (12px, 600, 0.14em, #64748B)
   - Leak title (40px, weight 500, -0.03em), then one consequence line (18px, #475569).
   - "How AI fixes it" (14px, 600), then three separate cards in a responsive grid (min 190px, 16px gap). Each card: white, 1px #E2E8F0 border, 4px radius, 22px padding; 40px icon tile (#FFF1E8, 4px radius, #E85D20 icon); outcome label 18px weight 500.
4. **Your AI Revenue Roadmap** (#F1F5F9 panel, square, 40px padding)
   - Title only (32px, weight 500, -0.03em).
   - Three items with orange checkmarks, separated by hairline rules: "1-hour consultation on your business" · "System review and AI tool recommendations" · "Step-by-step AI roadmap for your business"
   - Orange button with an arrow: "Get my AI roadmap" (52px tall, 4px radius, no price on the button)
   - Video tile beside it: flat navy block (4px radius) with an "OVERVIEW" label, a square white play button and "2:00"; caption "2-minute overview" below.
5. **Footer line** (hairline rule above): "Conservative estimate based on your answers. Your roadmap uses your real numbers."

## Style rules

- Font: DM Sans (web) with weights 400, 500, 600, 700, then Calibri and system fallbacks. Headlines use 500, not bold.
- Corners: 4px everywhere (document, tiles, cards, buttons, video). No large radii, no drop shadows.
- Orange is an accent only: the cover label, the number panel's top rule, checkmarks, icon tiles, the leak marker and the button. The main number stays navy.
- Button: bright orange #FF6B2B with navy text (passes contrast).
- Locked Parkridge palette only. No em-dashes in any copy.

## Dynamic fields

| Field | Source | Fallback |
|---|---|---|
| Full name, first name | Contact step | First name only in the sentence; "there" if blank |
| Company | Contact step | "your business" |
| Date | Submission date | — |
| Monthly and yearly range | Cost model (claude/cost-model-and-simulation.md) | See edge cases |
| Leak title, consequence, 3 AI outcomes | Leak lookup table, #1 leak only | — |

## Leak copy (lookup table)

| Leak | Consequence | How AI fixes it |
|---|---|---|
| Slow lead response | Most leads buy from whoever responds first. | Replies in under a minute · Qualifies every lead · Books the call for you |
| Follow-up stops too early | Most leads need several touches. Yours stop too soon. | Follows up until they reply · Personal, not templated · Flags hot leads for you |
| Untapped past leads | Past leads and customers are revenue sitting untouched. | Reaches out with a reason to talk · Spots who's ready to buy · Runs every month on its own |
| Numbers you can't trust | You can't see which leads turn into revenue. | Logs every call and email · Keeps your CRM current · Sends a weekly pipeline report |
| One-channel dependence | When your main channel slows, revenue slows. | Asks for referrals at the right moment · Collects reviews after every job · Keeps partners sending leads |
| AI used ad hoc | AI helps with tasks but isn't working your pipeline. | Knows your services and pricing · Drafts replies ready to send · Takes the busywork off your team |

Only the first three carry a dollar figure. Open question: whether the last three can ever take the #1 slot (one-channel dependence pulls against the same-ad-spend message).

## Cost formula (summary)

Full detail and the 20-business simulation: claude/cost-model-and-simulation.md.

- Monthly new-customer revenue = leads (middle of band) × close rate × customer value (low end of band). Insurance survey: value × 2.57 (three years at 85% retention).
- The top two dollar leaks combine with overlap, capped at 17.5–35% of that revenue. Yearly = × 12.

## What was cut, and why

- Score out of 100, band label and sub-scores: one number only, the dollar figure.
- Leak #2 and the cost per leak: one leak per page; per-leak dollars added confusion.
- Basis sentence: replaced by the one-line footer.
- "Recommended next step" tag and section numbers: read as a pitch setup and added numbers.
- "No sales calls" line and the roadmap description line: cleaner without them.
- V5: soft rounded corners and drop shadows from V3 (read as dated).

## Behavior and build notes

- **Button flow:** results page → short offer page (video, sample report pages, how it works, price, FAQ) → Stripe checkout with SOW and terms. The price lives on the offer page, not the button.
- **Download:** saves the Snapshot as a branded PDF.
- **Share:** copies the results link or opens the phone's share sheet. Log share clicks to HubSpot as a buying signal.
- **Edge cases:** no dollar leak → the number panel shows hours a week from their Q11 time sinks instead of dollars; yearly high under $6,000 → drop the dollar figures and lead with the consequence.
- The logo in the source file points to canvas uploads; use the files in the parkridge-design skill when building.

## Open items

- Confirm the lift ranges and the hours table.
- Decide whether "old leads" can take the #1 slot.
- Copy for the hours version of the number panel.
- Set the price for the offer page.
- Align the paid product name (AI Revenue Roadmap vs AI Assessment) across the offer page, Stripe, the SOW and emails.
- Build the offer page.
- Restyle the results email to match this page.

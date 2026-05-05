import { useState, useEffect, useRef } from "react";
import emailjs from "@emailjs/browser";
import analytics from "./utils/analytics";

// ============================================================
// PARKRIDGE GROWTH ENGINE SCORECARD
// Full scoring app with revenue leak calculator
// ============================================================

// Brand colors
const C = {
  navy: "#334155",
  navyDark: "#1E2A38",
  navyMid: "#2D3E50",
  navyLight: "#475569",
  navyMuted: "#64748B",
  orange: "#EA682F",
  orangeDark: "#C4510F",
  orangeLight: "#F49D6E",
  orangeBg: "#FEF3E7",
  silver: "#9AA5B1",
  snow: "#F8FAFC",
  cloud: "#F1F5F9",
  mist: "#E2E8F0",
  warmWhite: "#FAF9F6",
  white: "#FFFFFF",
  red: "#D94F4F",
  green: "#059669",
};

// ============================================================
// QUESTIONS DATA
// ============================================================
const QUESTIONS = [
  // Section 1: Emotional Hook (unscored)
  {
    id: "challenge",
    section: "Your Challenge",
    sectionDesc: "Let's start with what matters most to you",
    question: "What's the biggest growth challenge facing your agency right now?",
    type: "longtext",
    placeholder: "Example: I'm getting plenty of quote requests but my close rate is stuck around 15% and I can't figure out why.",
    scored: false,
  },
  {
    id: "tried",
    section: "Your Challenge",
    question: "What have you already tried to fix it?",
    type: "longtext",
    placeholder: "Example: We tried a follow-up cadence and a few internet lead vendors but nothing's stuck.",
    scored: false,
  },
  // Section 2: New Business & Lead Generation
  {
    id: "lead_sources",
    section: "New Business & Lead Generation",
    sectionDesc: "Where new clients come from",
    question: "Where do most of your new clients come from?",
    type: "multiselect",
    options: [
      "Referrals from current clients",
      "Centers of influence (mortgage brokers, realtors, CPAs)",
      "Carrier-supplied leads (captive)",
      "Internet leads (EverQuote, NetQuote, web forms)",
      "Networking · chamber · community",
      "Outbound prospecting · cold outreach",
      "Other",
    ],
    scored: true,
    // Referrals only = 1 · 1 non-referral source = 2 · 2 sources = 3 · 3+ sources = 5
    score: (val) => {
      if (!val || val.length === 0) return 0;
      if (val.length === 1 && val[0] === "Referrals from current clients") return 1;
      if (val.length === 1) return 2;
      if (val.length === 2) return 3;
      return 5;
    },
    leakId: "lead_diversity",
  },
  {
    id: "marketing_spend",
    section: "New Business & Lead Generation",
    question: "What's your approximate monthly spend on marketing and lead generation?",
    type: "single",
    options: [
      "$0 — we don't spend on marketing or paid leads",
      "Under $1,000 / month",
      "$1,000 – $5,000 / month",
      "$5,000 – $15,000 / month",
      "$15,000+ / month",
    ],
    scored: true,
    // $0 = 1 · any positive monthly budget = 5
    score: (val) => {
      if (val === 0) return 1;
      if (val >= 1 && val <= 4) return 5;
      return 0;
    },
  },
  {
    id: "cpq_cac",
    section: "New Business & Lead Generation",
    question: "Do you know your cost per quote (CPQ) and cost to acquire a household (CAC)?",
    type: "single_with_input",
    options: [
      "Yes, I know my numbers",
      "I have a rough idea",
      "No idea",
    ],
    inputFields: [
      { label: "CPQ", prefix: "$", showOn: [0, 1] },
      { label: "CAC", prefix: "$", showOn: [0, 1] },
    ],
    scored: true,
    score: (val) => ({ 0: 5, 1: 3, 2: 1 })[val] ?? 0,
    leakId: "cost_awareness",
  },
  // Section 3: Sales & Quote Process
  {
    id: "who_sells",
    section: "Sales & Quote Process",
    sectionDesc: "What happens after a quote request comes in",
    question: "Who's responsible for writing new business in your agency?",
    type: "single",
    options: [
      "Just me — I quote and bind everything myself",
      "Me + 1–2 CSRs who help with quoting",
      "A small producer team (2–4 producers)",
      "Dedicated producers + sales support · marketing",
    ],
    scored: false,
  },
  {
    id: "follow_up_speed",
    section: "Sales & Quote Process",
    question: "How quickly does someone respond to a new quote request?",
    type: "single",
    options: [
      "Within 5 minutes",
      "Within 1 hour",
      "Same day",
      "1–2 days",
      "It varies",
    ],
    scored: true,
    score: (val) => ({ 0: 5, 1: 4, 2: 3, 3: 1, 4: 1 })[val] ?? 0,
    leakId: "follow_up_speed",
    benchmark: {
      label: "Quote response speed",
      best: "Under 5 minutes",
      answers: ["Within 5 minutes", "Within 1 hour", "Same day", "1–2 days", "It varies"],
    },
  },
  {
    id: "sales_process",
    section: "Sales & Quote Process",
    question: "Do you have a defined quoting and follow-up process?",
    type: "single",
    options: [
      "Yes, clearly defined and documented",
      "Sort of — we have a general approach",
      "No, it's mostly ad hoc",
    ],
    scored: true,
    score: (val) => ({ 0: 5, 1: 3, 2: 1 })[val] ?? 0,
    leakId: "sales_process",
    benchmark: {
      label: "Quote follow-up process",
      best: "Documented & repeatable",
      answers: ["Clearly defined", "General approach", "Ad hoc"],
    },
  },
  // Section 4: Conversion & Tracking
  {
    id: "quote_to_bind",
    section: "Conversion & Tracking",
    sectionDesc: "Do you know your numbers?",
    question: "Do you know your quote-to-bind ratio?",
    type: "single_with_input",
    options: [
      "Yes — I track it regularly",
      "I have a rough sense",
      "No — I've never measured it",
    ],
    inputFields: [
      { label: "Quote-to-bind", suffix: "%", showOn: [0, 1] },
    ],
    scored: true,
    score: (val) => ({ 0: 5, 1: 3, 2: 1 })[val] ?? 0,
    leakId: "conversion_tracking",
    benchmark: {
      label: "Quote-to-bind tracking",
      best: "Tracked weekly",
      answers: ["Tracked regularly", "Rough sense", "Not tracked"],
    },
  },
  {
    id: "deal_falloff",
    section: "Conversion & Tracking",
    question: "Where do most quotes fall apart?",
    type: "multiselect",
    options: [
      "They never respond after we send the quote",
      "\"I'll think about it\" — then they ghost",
      "We lose on price",
      "Their current carrier matched or undercut us at renewal",
      "We can't write the risk (carrier appetite issue)",
      "Not sure",
    ],
    scored: true,
    // Any specific answer = 5 · "Not sure" only = 1
    score: (val) => {
      if (!val || val.length === 0) return 0;
      if (val.includes("Not sure") && val.length === 1) return 1;
      return 5;
    },
    leakId: "deal_falloff",
  },
  {
    id: "ams_use",
    section: "Conversion & Tracking",
    question: "Are you using your AMS or CRM for proactive pipeline activity?",
    type: "single",
    options: [
      "Yes — we run reports, set follow-ups, work renewals proactively",
      "Yes for policy admin only — but not for sales activity",
      "Barely — it's a record-keeping system at best",
      "We don't really use one",
    ],
    scored: true,
    score: (val) => ({ 0: 5, 1: 3, 2: 2, 3: 1 })[val] ?? 0,
    leakId: "crm_usage",
  },
  // Section 5: Retention & Multi-line (insurance-specific)
  {
    id: "retention",
    section: "Retention & Multi-line",
    sectionDesc: "What happens after the bind",
    question: "Do you know your client retention / book persistency rate?",
    type: "single_with_input",
    options: [
      "Yes — I track it",
      "I have a rough sense",
      "No idea",
    ],
    inputFields: [
      { label: "Retention rate", suffix: "%", showOn: [0, 1] },
    ],
    scored: true,
    score: (val) => ({ 0: 5, 1: 3, 2: 1 })[val] ?? 0,
    leakId: "retention",
    benchmark: {
      label: "Retention tracking",
      best: "Tracked monthly",
      answers: ["Tracked", "Rough sense", "No idea"],
    },
  },
  {
    id: "policies_per_household",
    section: "Retention & Multi-line",
    question: "How many policies does your average household have with you?",
    type: "single",
    options: [
      "3+ policies — we round out aggressively",
      "2 policies — some bundling",
      "Mostly 1 policy — transactional book",
      "Not sure",
    ],
    scored: true,
    score: (val) => ({ 0: 5, 1: 3, 2: 1, 3: 1 })[val] ?? 0,
    leakId: "multiline",
  },
  // Section 6: About Your Agency (unscored)
  {
    id: "agency_model",
    section: "About Your Agency",
    sectionDesc: "A few quick details to personalize your results",
    question: "What's your agency model?",
    type: "single",
    options: [
      "Captive (State Farm, Allstate, Farmers, etc.)",
      "Independent",
      "Hybrid",
    ],
    scored: false,
  },
  {
    id: "primary_lines",
    section: "About Your Agency",
    question: "What are your primary lines of business?",
    type: "multiselect",
    options: [
      "Personal P&C",
      "Commercial P&C",
      "Life & financial",
      "Health",
      "Medicare",
      "Group benefits",
    ],
    scored: false,
  },
  {
    id: "revenue",
    section: "About Your Agency",
    question: "What's your approximate annual agency revenue (commission + fees)?",
    type: "single",
    options: [
      "Under $250K",
      "$250K – $500K",
      "$500K – $1M",
      "$1M – $3M",
      "$3M+",
    ],
    scored: false,
  },
];

// ============================================================
// LEAK DEFINITIONS
// ============================================================
const LEAK_DEFS = {
  lead_diversity: {
    title: "Single-source new business",
    desc: "Most of your new business comes from one channel. When that channel fluctuates, so does your revenue. Top agencies typically run 3+ channels in parallel.",
    fix: "Diversify into 2–3 additional new-business channels — referrals, COIs, paid, and outbound — to reduce concentration risk.",
  },
  cost_awareness: {
    title: "No visibility into CPQ and CAC",
    desc: "Without knowing what each quote and each new household costs you, every marketing dollar is a guess. You can't optimize what you don't measure.",
    fix: "Track cost per quote and cost to acquire a household monthly. Knowing these two numbers makes every other decision sharper.",
  },
  follow_up_speed: {
    title: "Slow quote response time",
    desc: "Insurance shoppers contact 3–4 agencies in the same hour. Responding within 5 minutes makes you 9x more likely to bind. Past 30 minutes, you're often the third option.",
    fix: "Set up auto-acknowledgment within 1 minute and producer outreach within 5 minutes for every inbound quote request.",
  },
  sales_process: {
    title: "No defined quoting and follow-up process",
    desc: "Every producer is doing it their own way. Quotes that should bind don't, and you can't tell where the breakdown is happening.",
    fix: "Document a 5–7 touch quoting and follow-up cadence. When everyone runs the same play, conversion gets predictable.",
  },
  conversion_tracking: {
    title: "Quote-to-bind ratio not tracked",
    desc: "If you don't know what % of quotes you bind, you can't tell whether your problem is leads, pricing, follow-up, or producer skill. You're flying blind.",
    fix: "Track quote-to-bind ratio weekly, by producer, by line of business. This single metric reveals where your real leak is.",
  },
  deal_falloff: {
    title: "Quotes stalling mid-funnel",
    desc: "You're doing the work to send the quote — but the bind doesn't happen. The leak is in the middle of the funnel, not the top.",
    fix: "Identify the exact stage where quotes stall and address the root cause — usually follow-up cadence, perceived value, or pricing context.",
  },
  crm_usage: {
    title: "AMS not used for sales activity",
    desc: "Your AMS holds policy data but isn't running your sales motion. Cross-sell triggers are missed, follow-ups slip, and renewal opportunities die quietly.",
    fix: "Configure your AMS for proactive sales workflows: renewal alerts, cross-sell triggers, follow-up reminders. The data's already there — use it.",
  },
  retention: {
    title: "Retention rate unknown",
    desc: "If you don't track retention, you don't notice when the leak starts — until it's a flood. A 1-percentage-point drop in retention silently costs a $1M agency $10K/year compounding.",
    fix: "Track persistency monthly. Investigate any month-over-month drop. The earlier you spot churn, the cheaper it is to fix.",
  },
  multiline: {
    title: "Single-policy book — low household depth",
    desc: "When most households have one policy with you, both retention and lifetime value are lower than they need to be. Multi-line clients stay 3–5x longer.",
    fix: "Build a systematic cross-sell workflow at every renewal and every policy-change touchpoint. Goal: lift average policies-per-household to 2.5+.",
  },
};

// ============================================================
// REVENUE CALCULATOR
// ============================================================
// Insurance-flavored leak calculator: estimates annual commission lost to
// quote-to-bind gaps + retention gaps. Uses agency-revenue bucket as a
// proxy for monthly quote volume + average commission per household.
function calcRevenueLeak(answers) {
  // Estimate monthly quote requests from agency revenue bucket
  // (rough proxy: ~1 bound per $500-1000 annual commission, so quotes ≈ binds ÷ close-rate)
  const revBucket = answers.revenue;
  // [Under $250K, $250K–$500K, $500K–$1M, $1M–$3M, $3M+]
  const monthlyQuotes = [40, 80, 150, 300, 600][revBucket] ?? 60;

  // Estimate current quote-to-bind from Q9
  const qtbAnswer = answers.quote_to_bind;
  let currentConv = 0.20; // industry default ~20%
  if (qtbAnswer === 0) currentConv = 0.30;
  else if (qtbAnswer === 1) currentConv = 0.22;
  else currentConv = 0.18;

  // User-provided quote-to-bind %
  const qtbInput = answers.quote_to_bind_input_0;
  if (qtbInput && !isNaN(parseFloat(qtbInput))) {
    currentConv = parseFloat(qtbInput) / 100;
  }

  // Estimate improvement based on weaknesses
  let improvement = 0;
  const speedScore = QUESTIONS.find(q => q.id === "follow_up_speed")?.score(answers.follow_up_speed) ?? 5;
  const processScore = QUESTIONS.find(q => q.id === "sales_process")?.score(answers.sales_process) ?? 5;
  const trackingScore = QUESTIONS.find(q => q.id === "quote_to_bind")?.score(answers.quote_to_bind) ?? 5;
  const amsScore = QUESTIONS.find(q => q.id === "ams_use")?.score(answers.ams_use) ?? 5;
  const retentionScore = QUESTIONS.find(q => q.id === "retention")?.score(answers.retention) ?? 5;
  const multilineScore = QUESTIONS.find(q => q.id === "policies_per_household")?.score(answers.policies_per_household) ?? 5;

  if (speedScore <= 3) improvement += 0.07;
  if (processScore <= 3) improvement += 0.06;
  if (trackingScore <= 3) improvement += 0.04;
  if (amsScore <= 2) improvement += 0.03;
  if (retentionScore <= 3) improvement += 0.04;
  if (multilineScore <= 3) improvement += 0.04;

  improvement = Math.min(improvement, 0.25);
  const potentialConv = currentConv + improvement;

  // Average annual commission per household
  // (rough: $300 personal P&C, $600 bundled, $800+ multi-line)
  const commissionPerHousehold = 500;

  // Annualized: monthly quotes × 12 × bind-gap × commission per bound household
  const gap = potentialConv - currentConv;
  const lostCommissionLow = Math.round(monthlyQuotes * 12 * gap * commissionPerHousehold * 0.7);
  const lostCommissionHigh = Math.round(monthlyQuotes * 12 * gap * commissionPerHousehold * 1.3);

  return {
    low: Math.max(lostCommissionLow, 500),
    high: Math.max(lostCommissionHigh, 2000),
    leads: monthlyQuotes,
    currentConv: Math.round(currentConv * 100),
    potentialConv: Math.round(potentialConv * 100),
    dealSize: commissionPerHousehold,
  };
}

// ============================================================
// COMPONENTS
// ============================================================

// Progress bar with section steps
function Progress({ current, total, questions }) {
  const pct = ((current + 1) / total) * 100;
  
  // Build section list with question indices
  const sections = [];
  let lastSection = "";
  questions.forEach((q, i) => {
    if (q.section !== lastSection) {
      sections.push({ name: q.section, startIdx: i, endIdx: i });
      lastSection = q.section;
    } else {
      sections[sections.length - 1].endIdx = i;
    }
  });

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(250,249,246,0.95)", backdropFilter: "blur(12px)",
      borderBottom: `1px solid ${C.mist}`,
    }}>
      {/* Orange progress line */}
      <div style={{ width: "100%", height: 3, background: C.cloud }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: C.orange,
          transition: "width 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        }} />
      </div>
      {/* Section steps */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: 0, padding: "10px 24px", maxWidth: 780, margin: "0 auto",
        overflowX: "auto",
      }}>
        {/* Add <img src="/parkridge-icon.png" alt="" style={{ height: 24, marginRight: 20, opacity: 0.7 }} /> when deploying */}
        {sections.map((sec, i) => {
          const isActive = current >= sec.startIdx && current <= sec.endIdx;
          const isComplete = current > sec.endIdx;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: isComplete ? C.orange : isActive ? C.orange : "transparent",
                  border: `2px solid ${isComplete || isActive ? C.orange : C.mist}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.3s",
                  flexShrink: 0,
                }}>
                  {isComplete ? (
                    <span style={{ color: C.white, fontSize: 11, fontWeight: 700 }}>✓</span>
                  ) : (
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: isActive ? C.white : C.silver,
                    }}>{i + 1}</span>
                  )}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: isActive ? 600 : 400,
                  color: isActive ? C.navy : isComplete ? C.navyMuted : C.silver,
                  whiteSpace: "nowrap",
                  letterSpacing: "0.02em",
                  transition: "all 0.3s",
                }}>{sec.name}</span>
              </div>
              {i < sections.length - 1 && (
                <div style={{
                  width: 32, height: 1,
                  background: isComplete ? C.orange : C.mist,
                  margin: "0 10px",
                  transition: "background 0.3s",
                  flexShrink: 0,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Section header
function SectionHeader({ section, desc }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
        color: C.orange, marginBottom: 6,
      }}>{section}</div>
      {desc && <div style={{ fontSize: 14, color: C.navyMuted, fontWeight: 300 }}>{desc}</div>}
    </div>
  );
}

// Question renderer
function QuestionView({ q, value, onChange, inputValues, onInputChange, onNext, onBack, canProceed, currentQ, totalQ }) {
  const showSection = q.sectionDesc !== undefined;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "100px 24px 80px", maxWidth: 640, margin: "0 auto",
      animation: "fadeIn 0.4s ease",
    }}>
      {showSection && <SectionHeader section={q.section} desc={q.sectionDesc} />}
      {!showSection && (
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
          color: C.silver, marginBottom: 24,
        }}>{q.section}</div>
      )}

      <h2 style={{
        fontSize: "clamp(1.3rem, 3vw, 1.7rem)", fontWeight: 600, color: C.navy,
        lineHeight: 1.35, marginBottom: 32,
      }}>{q.question}</h2>

      {q.type === "longtext" && (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder}
          rows={4}
          style={{
            width: "100%", padding: "16px 20px", fontSize: 15, fontFamily: "'DM Sans', sans-serif",
            border: `1px solid ${C.mist}`, borderRadius: 4, background: C.white,
            color: C.navy, lineHeight: 1.7, resize: "vertical", outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => e.target.style.borderColor = C.orange}
          onBlur={(e) => e.target.style.borderColor = C.mist}
        />
      )}

      {q.type === "shorttext" && (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder}
          style={{
            width: "100%", padding: "16px 20px", fontSize: 15, fontFamily: "'DM Sans', sans-serif",
            border: `1px solid ${C.mist}`, borderRadius: 4, background: C.white,
            color: C.navy, outline: "none", transition: "border-color 0.2s",
          }}
          onFocus={(e) => e.target.style.borderColor = C.orange}
          onBlur={(e) => e.target.style.borderColor = C.mist}
        />
      )}

      {(q.type === "single" || q.type === "single_with_input") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.options.map((opt, i) => (
            <div key={i}>
              <button
                onClick={() => onChange(i)}
                style={{
                  width: "100%", textAlign: "left", padding: "14px 20px",
                  fontSize: 15, fontFamily: "'DM Sans', sans-serif",
                  background: value === i ? C.orangeBg : C.white,
                  border: `1px solid ${value === i ? C.orange : C.mist}`,
                  borderRadius: 4, cursor: "pointer", color: C.navy,
                  transition: "all 0.2s", fontWeight: value === i ? 500 : 400,
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${value === i ? C.orange : C.mist}`,
                  background: value === i ? C.orange : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                }}>
                  {value === i && <span style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>✓</span>}
                </span>
                {opt}
              </button>
              {q.type === "single_with_input" && q.inputFields && value === i && q.inputFields.some(f => f.showOn.includes(i)) && (
                <div style={{ display: "flex", gap: 12, marginTop: 10, paddingLeft: 36 }}>
                  {q.inputFields.filter(f => f.showOn.includes(i)).map((field, fi) => (
                    <div key={fi} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {field.prefix && <span style={{ color: C.navyMuted, fontSize: 14 }}>{field.prefix}</span>}
                      <input
                        type="text"
                        placeholder={field.label}
                        value={inputValues?.[fi] || ""}
                        onChange={(e) => onInputChange(fi, e.target.value)}
                        style={{
                          width: 120, padding: "10px 14px", fontSize: 14,
                          fontFamily: "'DM Sans', sans-serif",
                          border: `1px solid ${C.mist}`, borderRadius: 4,
                          background: C.white, color: C.navy, outline: "none",
                        }}
                        onFocus={(e) => e.target.style.borderColor = C.orange}
                        onBlur={(e) => e.target.style.borderColor = C.mist}
                      />
                      {field.suffix && <span style={{ color: C.navyMuted, fontSize: 14 }}>{field.suffix}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {q.type === "multiselect" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.options.map((opt, i) => {
            const selected = (value || []).includes(opt);
            return (
              <button
                key={i}
                onClick={() => {
                  const curr = value || [];
                  if (selected) onChange(curr.filter(v => v !== opt));
                  else onChange([...curr, opt]);
                }}
                style={{
                  width: "100%", textAlign: "left", padding: "14px 20px",
                  fontSize: 15, fontFamily: "'DM Sans', sans-serif",
                  background: selected ? C.orangeBg : C.white,
                  border: `1px solid ${selected ? C.orange : C.mist}`,
                  borderRadius: 4, cursor: "pointer", color: C.navy,
                  transition: "all 0.2s", fontWeight: selected ? 500 : 400,
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${selected ? C.orange : C.mist}`,
                  background: selected ? C.orange : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                }}>
                  {selected && <span style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>✓</span>}
                </span>
                {opt}
              </button>
            );
          })}
          <div style={{ fontSize: 12, color: C.silver, marginTop: 4 }}>Select all that apply</div>
        </div>
      )}

      {/* Inline navigation */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 32, paddingTop: 20,
      }}>
        <button
          onClick={onBack}
          style={{
            padding: "10px 20px", fontSize: 13, fontWeight: 500,
            background: "transparent", border: `1px solid ${C.mist}`,
            borderRadius: 4, cursor: currentQ > 0 ? "pointer" : "default",
            color: currentQ > 0 ? C.navyMuted : "transparent",
            borderColor: currentQ > 0 ? C.mist : "transparent",
            fontFamily: "'DM Sans', sans-serif",
            transition: "all 0.2s",
          }}
          disabled={currentQ === 0}
        >← Back</button>
        <div style={{ fontSize: 12, color: C.silver }}>{currentQ + 1} of {totalQ}</div>
        <button
          onClick={onNext}
          disabled={!canProceed}
          style={{
            padding: "12px 32px", fontSize: 13, fontWeight: 600,
            letterSpacing: "0.04em", textTransform: "uppercase",
            background: canProceed ? C.orange : C.mist,
            color: canProceed ? C.white : C.silver,
            border: "none", borderRadius: 4,
            cursor: canProceed ? "pointer" : "default",
            fontFamily: "'DM Sans', sans-serif",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { if (canProceed) e.target.style.background = C.orangeDark; }}
          onMouseLeave={(e) => { if (canProceed) e.target.style.background = C.orange; }}
        >Next →</button>
      </div>
    </div>
  );
}

// Email capture screen
function EmailCapture({ data, onChange, onSubmit }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "100px 24px 80px", maxWidth: 640, margin: "0 auto",
      animation: "fadeIn 0.4s ease",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
        color: C.orange, marginBottom: 8,
      }}>Almost done</div>
      <h2 style={{
        fontSize: "clamp(1.4rem, 3vw, 1.8rem)", fontWeight: 600, color: C.navy,
        lineHeight: 1.3, marginBottom: 12,
      }}>Where should we send your results?</h2>
      <p style={{ fontSize: 15, color: C.navyMuted, fontWeight: 300, marginBottom: 36 }}>
        We'll email you a detailed breakdown of your score, your top revenue leaks, and how you compare to top-performing businesses.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[
          { key: "firstName", label: "First name", required: true },
          { key: "email", label: "Email address", required: true, type: "email" },
          { key: "company", label: "Company name (optional)", required: false },
        ].map(field => (
          <div key={field.key}>
            <label style={{ fontSize: 12, fontWeight: 500, color: C.navyLight, marginBottom: 6, display: "block" }}>
              {field.label} {field.required && <span style={{ color: C.orange }}>*</span>}
            </label>
            <input
              type={field.type || "text"}
              value={data[field.key] || ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              style={{
                width: "100%", padding: "14px 20px", fontSize: 15,
                fontFamily: "'DM Sans', sans-serif",
                border: `1px solid ${C.mist}`, borderRadius: 4,
                background: C.white, color: C.navy, outline: "none",
              }}
              onFocus={(e) => e.target.style.borderColor = C.orange}
              onBlur={(e) => e.target.style.borderColor = C.mist}
            />
          </div>
        ))}
      </div>
      <button
        onClick={onSubmit}
        disabled={!data.firstName || !data.email}
        style={{
          marginTop: 32, padding: "16px 40px", fontSize: 14, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase",
          background: (!data.firstName || !data.email) ? C.mist : C.orange,
          color: (!data.firstName || !data.email) ? C.silver : C.white,
          border: "none", borderRadius: 4, cursor: (!data.firstName || !data.email) ? "default" : "pointer",
          fontFamily: "'DM Sans', sans-serif",
          transition: "all 0.3s",
          alignSelf: "flex-start",
        }}
      >
        Get My Results
      </button>
    </div>
  );
}

// Answers summary table for standalone report view
function ReportSummary({ ra }) {
  const Section = ({ title, rows }) => {
    const visible = rows.filter(([, v]) => v);
    if (!visible.length) return null;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.orange, marginBottom: 8 }}>
          {title}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", background: C.white, border: `1px solid ${C.mist}`, borderRadius: 6, overflow: "hidden" }}>
          <tbody>
            {visible.map(([label, value], i) => (
              <tr key={i} style={{ borderBottom: i < visible.length - 1 ? `1px solid ${C.cloud}` : "none" }}>
                <td style={{ padding: "9px 16px", fontSize: 13, color: C.silver, fontWeight: 500, width: "38%", verticalAlign: "top" }}>{label}</td>
                <td style={{ padding: "9px 16px", fontSize: 13, color: C.navy }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ marginBottom: 40, animation: "fadeIn 0.5s ease" }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: C.navy, marginBottom: 20 }}>Answers Summary</h3>
      <Section title="Agency Profile" rows={[
        ["Name", ra.name],
        ["Email", ra.email],
        ["Agency", ra.company],
        ["Agency Model", ra.agencyModel],
        ["Primary Lines", ra.primaryLines],
        ["Annual Revenue", ra.revenue],
        ["Primary Challenge", ra.challenge],
      ]} />
      <Section title="New Business & Lead Generation" rows={[
        ["Lead Sources", ra.leadSources],
        ["Monthly Marketing Spend", ra.marketingSpend],
        ["CPQ / CAC Awareness", ra.cpqCac],
        ["Cost per Quote", ra.cpqValue ? `$${ra.cpqValue}` : ""],
        ["Cost to Acquire (CAC)", ra.cacValue ? `$${ra.cacValue}` : ""],
      ]} />
      <Section title="Sales & Quote Process" rows={[
        ["Who Writes New Business", ra.whoSells],
        ["Quote Response Speed", ra.followUpSpeed],
        ["Quoting Process", ra.salesProcess],
        ["Quote-to-Bind", ra.quoteToBind + (ra.quoteToBindValue ? ` — ${ra.quoteToBindValue}` : "")],
        ["Quotes Stalling At", ra.dealFalloff],
        ["AMS / CRM Use", ra.amsUse],
      ]} />
      <Section title="Retention & Multi-line" rows={[
        ["Retention / Persistency", ra.retention + (ra.retentionValue ? ` — ${ra.retentionValue}` : "")],
        ["Policies per Household", ra.policiesPerHousehold],
      ]} />
    </div>
  );
}

// Results screen
function Results({ score, maxScore, revenue, leaks, answers, benchmarks, reportAnswers }) {
  const displayScore = Math.round((score / maxScore) * 100);
  // For URL-loaded reports, leak entries don't carry score/maxPts —
  // only active leaks ever made it into the URL, so include them all.
  const activeLeaks = leaks.filter(l =>
    l.maxPts === undefined || l.score < l.maxPts
  ).slice(0, 3);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const step = 16;
    const increment = (displayScore / (duration / step));
    const timer = setInterval(() => {
      start += increment;
      if (start >= displayScore) {
        setAnimatedScore(displayScore);
        clearInterval(timer);
        setTimeout(() => setShowContent(true), 300);
      } else {
        setAnimatedScore(Math.round(start));
      }
    }, step);
    return () => clearInterval(timer);
  }, [displayScore]);

  let diagnosis = "";
  let diagColor = C.orange;
  if (displayScore <= 44) { diagnosis = "Critical — Your book has major leaks. Significant revenue is walking out the door at renewal or never getting bound."; diagColor = C.red; }
  else if (displayScore <= 64) { diagnosis = "Needs Work — Your pipeline has clear gaps. Fixing them could unlock meaningful growth without buying more leads."; diagColor = C.orange; }
  else if (displayScore <= 84) { diagnosis = "Solid Foundation — Your agency is functional but there's room to optimize retention, cross-sell, and process."; diagColor = "#D97706"; }
  else { diagnosis = "Strong — Your book is in good shape. Fine-tuning could take you to the next level."; diagColor = C.green; }

  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`;

  return (
    <div style={{
      minHeight: "100vh", padding: "80px 24px 60px", maxWidth: 700, margin: "0 auto",
      animation: "fadeIn 0.5s ease",
    }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <a href="https://parkridgeadvisory.com" target="_blank" rel="noopener noreferrer">
          <img src="/logo-horizontal.svg" alt="Parkridge Advisory" style={{ height: 32, width: "auto" }} />
        </a>
      </div>

      {/* Score */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
          color: C.orange, marginBottom: 16,
        }}>Your Results</div>
        <div style={{ fontSize: 13, color: C.navyMuted, fontWeight: 400, marginBottom: 8 }}>Pipeline Health Score</div>
        <div style={{
          fontSize: "clamp(4rem, 10vw, 6rem)", fontWeight: 700, color: C.navy, lineHeight: 1,
          marginBottom: 4,
        }}>
          {animatedScore}<span style={{ fontSize: "0.4em", color: C.silver }}>/100</span>
        </div>
        <div style={{
          fontSize: 15, fontWeight: 500, color: diagColor, marginTop: 12,
          padding: "10px 20px", background: `${diagColor}11`, borderRadius: 4,
          display: "inline-block",
        }}>{diagnosis}</div>
      </div>

      {showContent && (
        <>
          {/* Answers summary — only shown on standalone report links */}
          {reportAnswers && <ReportSummary ra={reportAnswers} />}

          {/* Revenue Leak */}
          {activeLeaks.length > 0 && (
          <div style={{
            background: C.navyDark, borderRadius: 6, padding: "32px 36px",
            marginBottom: 36, animation: "fadeIn 0.5s ease",
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.orangeLight, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              Estimated Revenue Leak
            </div>
            <div style={{ fontSize: "clamp(1.8rem, 5vw, 2.6rem)", fontWeight: 700, color: C.white, marginBottom: 8 }}>
              {fmt(revenue.low)} – {fmt(revenue.high)}<span style={{ fontSize: "0.5em", fontWeight: 400, color: C.silver }}> /month</span>
            </div>
            <div style={{ fontSize: 14, color: "rgba(248,250,252,0.5)", fontWeight: 300 }}>
              Based on your answers, this is how much revenue may be slipping through your pipeline each month.
            </div>
          </div>
          )}

          {/* Top Leaks */}
          {(() => {
            return (
              <div style={{ marginBottom: 36, animation: "fadeIn 0.5s ease 0.2s both" }}>
                {activeLeaks.length === 0 ? (
                  <div style={{
                    background: C.white, border: `1px solid ${C.mist}`, borderRadius: 6,
                    padding: "28px 24px", textAlign: "center", borderLeft: `3px solid ${C.green}`,
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 12 }}>✓</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: C.navy, marginBottom: 8 }}>
                      Strong Pipeline — No Major Leaks Detected
                    </div>
                    <div style={{ fontSize: 14, color: C.navyMuted, fontWeight: 300, lineHeight: 1.6 }}>
                      Your pipeline is performing well across all key areas. A strategy call can help you identify edge-case optimizations and build on what's already working.
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: C.navy, marginBottom: 20 }}>
                      Your Top Revenue Leaks
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {activeLeaks.map((leak, i) => (
                        <div key={i} style={{
                          background: C.white, border: `1px solid ${C.mist}`, borderRadius: 6,
                          padding: "20px 24px", position: "relative", borderLeft: `3px solid ${C.orange}`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, color: C.white, background: C.orange,
                              width: 22, height: 22, borderRadius: "50%", display: "flex",
                              alignItems: "center", justifyContent: "center",
                            }}>{i + 1}</span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: C.navy }}>{leak.title}</span>
                          </div>
                          <div style={{ fontSize: 14, color: C.navyMuted, fontWeight: 300, lineHeight: 1.6 }}>{leak.desc}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Benchmarks */}
          {benchmarks.length > 0 && (
            <div style={{ marginBottom: 36, animation: "fadeIn 0.5s ease 0.4s both" }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: C.navy, marginBottom: 20 }}>
                How You Compare
              </h3>
              <div style={{
                background: C.white, border: `1px solid ${C.mist}`, borderRadius: 6,
                overflow: "hidden",
              }}>
                {benchmarks.map((b, i) => (
                  <div key={i} style={{
                    padding: "16px 24px", display: "flex", justifyContent: "space-between",
                    alignItems: "center", borderBottom: i < benchmarks.length - 1 ? `1px solid ${C.cloud}` : "none",
                  }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.silver, fontWeight: 500, marginBottom: 2 }}>{b.label}</div>
                      <div style={{ fontSize: 14, color: C.navy, fontWeight: 500 }}>You: {b.yours}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: C.green, fontWeight: 500, marginBottom: 2 }}>Top performers</div>
                      <div style={{ fontSize: 14, color: C.green, fontWeight: 600 }}>{b.best}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reframe — tailored to marketing spend bucket (Q4) */}
          {(() => {
            if (activeLeaks.length === 0) return null;
            const reframeMap = {
              // 0: $0/month
              0: "Before buying internet leads, the highest-leverage move is usually fixing your quote-to-bind ratio and retention. A small lift in either is almost always cheaper than a new lead source.",
              // 1: Under $1k/month
              1: "You're spending modestly — every dollar should be measurable. Tighten your quote follow-up cadence and round out existing households before scaling spend.",
              // 2: $1k–$5k/month
              2: "You're spending real money on leads. The biggest ROI move now is closing the conversion gaps in this report — same budget, more bound policies.",
              // 3: $5k–$15k/month
              3: "At this spend level, conversion leaks compound fast. A few percentage points of quote-to-bind improvement are usually worth more than another $1k of ad spend.",
              // 4: $15k+/month
              4: "You're investing seriously in lead acquisition. Make sure every quote works as hard as it can — at this volume, small conversion gains move real revenue.",
            };
            const reframe = reframeMap[answers.marketing_spend];
            if (!reframe) return null;
            return (
              <div style={{
                background: C.orangeBg, borderLeft: `3px solid ${C.orange}`,
                padding: "20px 28px", borderRadius: 4, marginBottom: 36,
                animation: "fadeIn 0.5s ease 0.6s both",
              }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.navy, lineHeight: 1.6 }}>
                  {reframe}
                </div>
              </div>
            );
          })()}

          {/* CTA */}
          {(() => {
            let ctaHeading, ctaBody, ctaLabel;
            if (displayScore <= 44) {
              ctaHeading = "Your book has major leaks.";
              ctaBody = "Book a free 30-minute Pipeline Review. We'll prioritise the 2–3 fixes that will move the needle fastest — usually retention, quote follow-up, or account rounding.";
              ctaLabel = "Book Your 30 Min Pipeline Review";
            } else if (displayScore <= 64) {
              ctaHeading = "Want to see exactly where commission is leaking?";
              ctaBody = "Book a free 30-minute Pipeline Review. We'll walk through your score and map out a clear action plan tailored to your book.";
              ctaLabel = "Book Your 30 Min Pipeline Review";
            } else if (displayScore <= 84) {
              ctaHeading = "Ready to take your book to the next level?";
              ctaBody = "Book a free 30-minute Pipeline Review. We'll identify the optimisations that turn a solid book into a predictable growth engine.";
              ctaLabel = "Book Your 30 Min Pipeline Review";
            } else {
              ctaHeading = "Your book is strong — let's keep it that way.";
              ctaBody = "Book a free 30-minute call. We'll look at edge-case optimisations and build on what's already working to protect and extend your lead.";
              ctaLabel = "Book Your 30 Min Pipeline Review";
            }
            return (
          <div style={{
            background: C.navyDark, borderRadius: 6, padding: "40px 36px",
            textAlign: "center", animation: "fadeIn 0.5s ease 0.8s both",
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 12 }}>
              {ctaHeading}
            </h3>
            <p style={{ fontSize: 14, color: "rgba(248,250,252,0.5)", fontWeight: 300, marginBottom: 8, lineHeight: 1.6 }}>
              {ctaBody}
            </p>
            <p style={{ fontSize: 13, color: "rgba(248,250,252,0.35)", marginBottom: 28 }}>
              No pitch — just clarity.
            </p>
            <a
              href="https://calendly.com/tom-parkridgeadvisory/30min"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analytics.callRequested('scorecard')}
              style={{
                display: "inline-block", padding: "16px 40px", fontSize: 14,
                fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                background: C.orange, color: C.white, textDecoration: "none",
                borderRadius: 4, transition: "all 0.3s",
                fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={(e) => { e.target.style.background = C.orangeDark; e.target.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.target.style.background = C.orange; e.target.style.transform = "translateY(0)"; }}
            >
              {ctaLabel}
            </a>
          </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

// ============================================================
// INTRO SCREEN
// ============================================================
function Intro({ onStart }) {
  const ctaStyle = {
    display: "inline-flex", alignItems: "center", gap: 10,
    padding: "16px 40px", background: C.orange, color: C.white,
    fontSize: 15, fontWeight: 500, letterSpacing: "0.06em",
    textTransform: "uppercase", border: "none", borderRadius: 4,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.3s",
  };
  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F5" }}>

      {/* Header */}
      <header style={{
        padding: "20px 40px", display: "flex", alignItems: "center",
        justifyContent: "flex-start", borderBottom: `1px solid rgba(51,65,85,0.07)`,
        background: C.white,
      }}>
        <a href="https://parkridgeadvisory.com" target="_blank" rel="noopener noreferrer">
          <img src="/logo-horizontal.svg" alt="Parkridge Advisory" style={{ height: 38, width: "auto", display: "block" }} />
        </a>
      </header>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "80px 24px 60px", maxWidth: 720, margin: "0 auto" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 20px", background: C.white,
          border: `1px solid rgba(51,65,85,0.12)`, borderRadius: 100,
          fontSize: 12, fontWeight: 500, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.navyLight, marginBottom: 32,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.orange, flexShrink: 0 }} />
          For Insurance Agents
        </div>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif", fontWeight: 400,
          fontSize: "clamp(2.5rem, 5.5vw, 3.5rem)", lineHeight: 1.15,
          color: C.navy, marginBottom: 20, letterSpacing: "-0.01em",
        }}>
          Let's find where your<br /><em style={{ fontStyle: "italic", color: C.orange }}>commission</em> is leaking
        </h1>

        <p style={{ fontSize: 17, color: C.navyMuted, lineHeight: 1.65, maxWidth: 480, margin: "0 auto 24px" }}>
          This 5-minute assessment will show you:
        </p>

        <ul style={{
          listStyle: "none", display: "flex", flexDirection: "column", gap: 14,
          maxWidth: 460, margin: "0 auto 40px", textAlign: "left",
          background: C.white, border: `1px solid rgba(51,65,85,0.07)`,
          borderRadius: 8, padding: "28px 32px",
        }}>
          {[
            { title: "Pipeline Health Score", desc: "a single number diagnosing where your agency's pipeline is strong and where it's leaking" },
            { title: "Commission Left on the Table", desc: "see exactly where quotes don't bind, renewals don't stick, and households don't get rounded out" },
            { title: "Benchmark Comparison", desc: "understand how your book stacks up against top-performing agencies" },
          ].map((item, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 15, color: C.navy, lineHeight: 1.55 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.orange, flexShrink: 0, marginTop: 5 }} />
              <span><strong>{item.title}</strong> — {item.desc}</span>
            </li>
          ))}
        </ul>

        <button onClick={() => { analytics.scorecardStarted(); onStart(); }} style={ctaStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.orangeDark; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = C.orange; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          Start Assessment
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span style={{ display: "block", marginTop: 16, fontSize: 13, color: C.silver }}>Takes less than 5 minutes</span>
        <p style={{ marginTop: 20, fontSize: 14, color: C.navyMuted, fontStyle: "italic" }}>
          Finish the scorecard and book a free strategy call to walk through your results.
        </p>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: "center", padding: "32px 24px",
        borderTop: `1px solid rgba(51,65,85,0.07)`,
        fontSize: 12, color: C.silver, letterSpacing: "0.03em",
      }}>
        © 2026 Parkridge Advisory. All rights reserved.
      </footer>
    </div>
  );
}

// ============================================================
// INSURANCE FUNNEL APP
// ============================================================
export default function InsuranceApp() {
  // Set page title for the insurance funnel
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Insurance Pipeline Scorecard — Parkridge Advisory";
    }
  }, []);

  // Load results directly from URL params (shared report links)
  const [screen, setScreen] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('r') === '1' ? 'results' : 'intro';
  });
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [inputValues, setInputValues] = useState({});
  const [emailData, setEmailData] = useState({ firstName: "", email: "", company: "" });
  const [results, setResults] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('r') !== '1') return null;
    // Parse leak entries; score/maxPts are present on URLs generated after the
    // share-URL bugfix. For older URLs they'll be undefined and the activeLeaks
    // filter in <Results> includes them by default.
    const parseLeak = (n) => {
      const title = p.get(`l${n}`) || '';
      if (!title) return null;
      const sRaw = p.get(`l${n}s`);
      const mRaw = p.get(`l${n}m`);
      return {
        title,
        desc: p.get(`d${n}`) || '',
        score: sRaw !== null ? parseInt(sRaw, 10) : undefined,
        maxPts: mRaw !== null ? parseInt(mRaw, 10) : undefined,
      };
    };
    return {
      score: parseInt(p.get('score') || '0'),
      maxScore: 100,
      leaks: [parseLeak(1), parseLeak(2), parseLeak(3)].filter(Boolean),
      revenue: {
        low: parseInt(p.get('rlo') || '0'),
        high: parseInt(p.get('rhi') || '0'),
      },
      benchmarks: Array.from({ length: 6 }, (_, i) => ({
        label: p.get(`b${i}l`), yours: p.get(`b${i}y`), best: p.get(`b${i}b`),
      })).filter(b => b.label),
      reportAnswers: {
        name: p.get('nm') || '',
        email: p.get('em') || '',
        company: p.get('co') || '',
        agencyModel: p.get('amdl') || '',
        primaryLines: p.get('plines') || '',
        revenue: p.get('rev') || '',
        challenge: p.get('ch') || '',
        leadSources: p.get('lsrc') || '',
        marketingSpend: p.get('msp') || '',
        cpqCac: p.get('cpq') || '',
        cpqValue: p.get('cpqv') || '',
        cacValue: p.get('cacv') || '',
        whoSells: p.get('ws') || '',
        followUpSpeed: p.get('fup') || '',
        salesProcess: p.get('sp') || '',
        quoteToBind: p.get('qtb') || '',
        quoteToBindValue: p.get('qtbv') || '',
        dealFalloff: p.get('df') || '',
        amsUse: p.get('ams') || '',
        retention: p.get('ret') || '',
        retentionValue: p.get('retv') || '',
        policiesPerHousehold: p.get('pph') || '',
      },
    };
  });

  // Session ID to track partial submissions
  const [sessionId] = useState(() => "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));

  // Google Sheets webhook URL
  const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycby8qdZmUuZfouBH-4Uloc3O5A4TxP7batJxggqQRAypROG77LysGPteo3HXV556J4croQ/exec";

  // Send data to Google Sheet (updates same row using session_id)
  const sendToSheet = (extraData = {}) => {
    const q = QUESTIONS[currentQ];
    const val = answers[q?.id];

    // Map answers to sheet columns
    const payload = {
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      completed: false,
    };

    // Add all answered questions (insurance funnel)
    payload.industry = "Insurance";
    if (answers.challenge) payload.q1_challenge = answers.challenge;
    if (answers.tried) payload.q2_tried = answers.tried;
    if (answers.lead_sources) payload.q3_lead_sources = Array.isArray(answers.lead_sources) ? answers.lead_sources.join(", ") : answers.lead_sources;
    if (answers.marketing_spend !== undefined) payload.q4_marketing_spend = QUESTIONS.find(q => q.id === "marketing_spend")?.options[answers.marketing_spend] || "";
    if (answers.cpq_cac !== undefined) payload.q5_cpq_cac = QUESTIONS.find(q => q.id === "cpq_cac")?.options[answers.cpq_cac] || "";
    if (answers.cpq_cac_input_0) payload.q5_cpq_value = answers.cpq_cac_input_0;
    if (answers.cpq_cac_input_1) payload.q5_cac_value = answers.cpq_cac_input_1;
    if (answers.who_sells !== undefined) payload.q6_who_sells = QUESTIONS.find(q => q.id === "who_sells")?.options[answers.who_sells] || "";
    if (answers.follow_up_speed !== undefined) payload.q7_follow_up_speed = QUESTIONS.find(q => q.id === "follow_up_speed")?.options[answers.follow_up_speed] || "";
    if (answers.sales_process !== undefined) payload.q8_sales_process = QUESTIONS.find(q => q.id === "sales_process")?.options[answers.sales_process] || "";
    if (answers.quote_to_bind !== undefined) payload.q9_quote_to_bind = QUESTIONS.find(q => q.id === "quote_to_bind")?.options[answers.quote_to_bind] || "";
    if (answers.quote_to_bind_input_0) payload.q9_qtb_value = answers.quote_to_bind_input_0;
    if (answers.deal_falloff) payload.q10_quote_falloff = Array.isArray(answers.deal_falloff) ? answers.deal_falloff.join(", ") : answers.deal_falloff;
    if (answers.ams_use !== undefined) payload.q11_ams_use = QUESTIONS.find(q => q.id === "ams_use")?.options[answers.ams_use] || "";
    if (answers.retention !== undefined) payload.q12_retention = QUESTIONS.find(q => q.id === "retention")?.options[answers.retention] || "";
    if (answers.retention_input_0) payload.q12_retention_value = answers.retention_input_0;
    if (answers.policies_per_household !== undefined) payload.q13_policies_per_household = QUESTIONS.find(q => q.id === "policies_per_household")?.options[answers.policies_per_household] || "";
    if (answers.agency_model !== undefined) payload.q14_agency_model = QUESTIONS.find(q => q.id === "agency_model")?.options[answers.agency_model] || "";
    if (answers.primary_lines) payload.q15_primary_lines = Array.isArray(answers.primary_lines) ? answers.primary_lines.join(", ") : answers.primary_lines;
    if (answers.revenue !== undefined) payload.q16_revenue = QUESTIONS.find(q => q.id === "revenue")?.options[answers.revenue] || "";

    // Merge any extra data (email, score, completed flag)
    Object.assign(payload, extraData);

    // Send in background — don't block the UI
    fetch(WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    }).catch(() => {}); // Silently fail if network issue
  };

  const canProceed = () => {
    const q = QUESTIONS[currentQ];
    const val = answers[q.id];
    if (q.type === "longtext" || q.type === "shorttext") return val && val.trim().length > 0;
    if (q.type === "single" || q.type === "single_with_input") return val !== undefined;
    if (q.type === "multiselect") return val && val.length > 0;
    return false;
  };

  const handleNext = () => {
    // Send partial data to sheet after each question
    sendToSheet();
    analytics.stepCompleted(currentQ + 1, QUESTIONS[currentQ].id, QUESTIONS.length);
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setScreen("email");
    }
  };

  const handleBack = () => {
    if (currentQ > 0) setCurrentQ(currentQ - 1);
  };

  const submittedRef = useRef(false);

  const handleSubmit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    // Calculate score
    let totalScore = 0;
    let maxScore = 0;
    const leakScores = [];

    // Scored question IDs (10 total):
    //   lead_sources · marketing_spend · cpq_cac · follow_up_speed · sales_process
    //   · quote_to_bind · deal_falloff · ams_use · retention · policies_per_household
    // All ten max at 5pts each → raw total: 10–50
    // Display = round((raw / 50) × 100) i.e. raw × 2
    QUESTIONS.forEach(q => {
      if (q.scored && q.score) {
        const val = answers[q.id];
        const pts = q.score(val);
        const maxPts = q.maxPts ?? 5;
        totalScore += pts;
        maxScore += maxPts;
        if (q.leakId) {
          leakScores.push({ id: q.leakId, score: pts, maxPts, ...LEAK_DEFS[q.leakId] });
        }
      }
    });

    // Sort leaks by score ascending (worst first)
    leakScores.sort((a, b) => a.score - b.score);

    // Build benchmarks
    const benchmarks = [];
    QUESTIONS.forEach(q => {
      if (q.benchmark && answers[q.id] !== undefined) {
        benchmarks.push({
          label: q.benchmark.label,
          yours: q.benchmark.answers[answers[q.id]] || "Unknown",
          best: q.benchmark.best,
        });
      }
    });

    const revenue = calcRevenueLeak(answers);

    setResults({ score: totalScore, maxScore, leaks: leakScores, revenue, benchmarks });
    setScreen("results");

    // Send final data with email, score, and completed flag
    const displayScore = Math.round((totalScore / maxScore) * 100);

    // Identify user and track submission
    analytics.identifyUser(emailData.email, {
      $name: emailData.firstName,
      company: emailData.company,
    });
    analytics.scorecardSubmitted(displayScore, {
      top_leak: leakScores[0]?.title || null,
      revenue_low: revenue?.low || null,
      revenue_high: revenue?.high || null,
      company: emailData.company || null,
    });

    // Meta Pixel: Lead event — scorecard completion
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', {
        content_name: 'Insurance Pipeline Scorecard',
        content_category: 'Diagnostic — Insurance',
        value: 50.00,
        currency: 'USD'
      });
    }

    // Build shareable report URL
    const readable = (id) => {
      const q = QUESTIONS.find(q => q.id === id);
      const val = answers[id];
      if (!q || val === undefined) return '';
      if (q.options) return q.options[val] || '';
      return val || '';
    };

    const reportUrl = new URL(window.location.href);
    reportUrl.search = '';
    reportUrl.searchParams.set('r', '1');
    reportUrl.searchParams.set('score', displayScore);
    // Lead info
    reportUrl.searchParams.set('nm', emailData.firstName);
    reportUrl.searchParams.set('em', emailData.email);
    reportUrl.searchParams.set('co', emailData.company || '');
    // Leaks
    // Top 3 leaks (titles, descriptions, raw score, max pts)
    [0, 1, 2].forEach(i => {
      const lk = leakScores[i];
      if (!lk) return;
      const n = i + 1;
      reportUrl.searchParams.set(`l${n}`, lk.title);
      reportUrl.searchParams.set(`d${n}`, lk.desc);
      reportUrl.searchParams.set(`l${n}s`, String(lk.score));
      reportUrl.searchParams.set(`l${n}m`, String(lk.maxPts));
    });
    // Revenue
    if (revenue?.low) reportUrl.searchParams.set('rlo', revenue.low);
    if (revenue?.high) reportUrl.searchParams.set('rhi', revenue.high);
    // Company
    if (readable('agency_model')) reportUrl.searchParams.set('amdl', readable('agency_model'));
    if (answers.primary_lines) reportUrl.searchParams.set('plines', Array.isArray(answers.primary_lines) ? answers.primary_lines.join(', ') : answers.primary_lines);
    if (readable('revenue')) reportUrl.searchParams.set('rev', readable('revenue'));
    if (answers.challenge) reportUrl.searchParams.set('ch', answers.challenge.slice(0, 200));
    // Leads
    if (answers.lead_sources) reportUrl.searchParams.set('lsrc', Array.isArray(answers.lead_sources) ? answers.lead_sources.join(', ') : answers.lead_sources);
    if (readable('marketing_spend')) reportUrl.searchParams.set('msp', readable('marketing_spend'));
    if (readable('cpq_cac')) reportUrl.searchParams.set('cpq', readable('cpq_cac'));
    if (answers.cpq_cac_input_0) reportUrl.searchParams.set('cpqv', answers.cpq_cac_input_0);
    if (answers.cpq_cac_input_1) reportUrl.searchParams.set('cacv', answers.cpq_cac_input_1);
    // Sales
    if (readable('who_sells')) reportUrl.searchParams.set('ws', readable('who_sells'));
    if (readable('follow_up_speed')) reportUrl.searchParams.set('fup', readable('follow_up_speed'));
    if (readable('sales_process')) reportUrl.searchParams.set('sp', readable('sales_process'));
    if (readable('quote_to_bind')) reportUrl.searchParams.set('qtb', readable('quote_to_bind'));
    if (answers.quote_to_bind_input_0) reportUrl.searchParams.set('qtbv', answers.quote_to_bind_input_0 + '%');
    if (answers.deal_falloff) reportUrl.searchParams.set('df', Array.isArray(answers.deal_falloff) ? answers.deal_falloff.join(', ') : answers.deal_falloff);
    if (readable('ams_use')) reportUrl.searchParams.set('ams', readable('ams_use'));
    // Retention & multi-line
    if (readable('retention')) reportUrl.searchParams.set('ret', readable('retention'));
    if (answers.retention_input_0) reportUrl.searchParams.set('retv', answers.retention_input_0 + '%');
    if (readable('policies_per_household')) reportUrl.searchParams.set('pph', readable('policies_per_household'));
    // Benchmarks
    benchmarks.forEach((b, i) => {
      reportUrl.searchParams.set(`b${i}l`, b.label);
      reportUrl.searchParams.set(`b${i}y`, b.yours);
      reportUrl.searchParams.set(`b${i}b`, b.best);
    });

    sendToSheet({
      first_name: emailData.firstName,
      email: emailData.email,
      company: emailData.company,
      score: displayScore,
      completed: true,
      report_url: reportUrl.toString(),
    });

    // Send email report to lead and Tom
    let diagnosisText = "";
    let diagColor = "#f97316";
    if (displayScore <= 44) { diagnosisText = "Critical — Your book has major leaks. Significant revenue is walking out the door at renewal or never getting bound."; diagColor = "#ef4444"; }
    else if (displayScore <= 64) { diagnosisText = "Needs Work — Your pipeline has clear gaps. Fixing them could unlock meaningful growth without buying more leads."; diagColor = "#f97316"; }
    else if (displayScore <= 84) { diagnosisText = "Solid Foundation — Your agency is functional but there's room to optimize retention, cross-sell, and process."; diagColor = "#D97706"; }
    else { diagnosisText = "Strong — Your book is in good shape. Fine-tuning could take you to the next level."; diagColor = "#22c55e"; }

    const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`;

    const benchmarksHtml = benchmarks.length > 0
      ? benchmarks.map((b, i) => `
          <tr style="border-bottom:${i < benchmarks.length - 1 ? "1px solid #e2e8f0" : "none"}">
            <td style="padding:14px 20px;">
              <div style="font-size:12px;color:#94a3b8;font-weight:500;margin-bottom:2px;">${b.label}</div>
              <div style="font-size:14px;color:#334155;font-weight:500;">You: ${b.yours}</div>
            </td>
            <td style="padding:14px 20px;text-align:right;">
              <div style="font-size:12px;color:#22c55e;font-weight:500;margin-bottom:2px;">Top performers</div>
              <div style="font-size:14px;color:#22c55e;font-weight:600;">${b.best}</div>
            </td>
          </tr>`).join("")
      : "";

    const emailParams = {
      to_name: emailData.firstName,
      to_email: emailData.email,
      company: emailData.company || "N/A",
      score: displayScore,
      diagnosis: diagnosisText,
      diag_color: diagColor,
      top_leak_1: leakScores[0]?.title || "",
      top_leak_1_desc: leakScores[0]?.desc || "",
      top_leak_2: leakScores[1]?.title || "",
      top_leak_2_desc: leakScores[1]?.desc || "",
      top_leak_3: leakScores[2]?.title || "",
      top_leak_3_desc: leakScores[2]?.desc || "",
      revenue_low: revenue?.low ? fmt(revenue.low) : "N/A",
      revenue_high: revenue?.high ? fmt(revenue.high) : "N/A",
      benchmarks_html: benchmarksHtml,
    };

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    console.log("[EmailJS] Sending with:", { serviceId, templateId, publicKey: publicKey ? "set" : "MISSING" });

    // HubSpot contact creation
    const hsFields = [{ name: "email", value: emailData.email }];
    if (emailData.firstName) hsFields.push({ name: "firstname", value: emailData.firstName });
    if (emailData.company)   hsFields.push({ name: "company", value: emailData.company });

    fetch("https://api.hsforms.com/submissions/v3/integration/submit/245806817/62f93bdb-38db-418b-a40a-c8a807f75949", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: hsFields,
        context: { pageUri: "https://scorecard.parkridgeadvisory.com/insurance", pageName: "Insurance Pipeline Scorecard" },
      }),
    }).catch(() => {});

    // Email to the lead (Tom receives a copy via BCC in EmailJS template settings)
    emailjs.send(serviceId, templateId, emailParams, publicKey)
      .then(() => console.log("[EmailJS] Email sent OK"))
      .catch((err) => console.error("[EmailJS] Email failed:", err));
  };

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif", background: C.warmWhite,
      minHeight: "100vh", color: C.navy,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        ::selection { background: ${C.orangeBg}; color: ${C.navy}; }
      `}</style>

      {/* Home link - update href when website is live */}
      {screen === "questions" || screen === "email" ? (
        <a
          href="https://parkridgeadvisory.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ position: "fixed", top: 14, left: 20, zIndex: 60, display: "block" }}
        >
          <img src="/logo-horizontal.svg" alt="Parkridge Advisory" style={{ height: 28, width: "auto", display: "block" }} />
        </a>
      ) : null}

      {screen === "intro" && <Intro onStart={() => setScreen("questions")} />}

      {screen === "questions" && (
        <>
          <Progress current={currentQ} total={QUESTIONS.length} questions={QUESTIONS} />
          <QuestionView
            key={currentQ}
            q={QUESTIONS[currentQ]}
            value={answers[QUESTIONS[currentQ].id]}
            onChange={(val) => setAnswers({ ...answers, [QUESTIONS[currentQ].id]: val })}
            inputValues={inputValues[QUESTIONS[currentQ].id] || {}}
            onInputChange={(fi, val) => {
              const qId = QUESTIONS[currentQ].id;
              const curr = inputValues[qId] || {};
              const updated = { ...curr, [fi]: val };
              setInputValues({ ...inputValues, [qId]: updated });
              setAnswers({ ...answers, [`${qId}_input_${fi}`]: val });
            }}
            onNext={handleNext}
            onBack={handleBack}
            canProceed={canProceed()}
            currentQ={currentQ}
            totalQ={QUESTIONS.length}
          />
        </>
      )}

      {screen === "email" && (
        <>
          <Progress current={QUESTIONS.length} total={QUESTIONS.length + 1} questions={QUESTIONS} />
          <EmailCapture
            data={emailData}
            onChange={(key, val) => setEmailData({ ...emailData, [key]: val })}
            onSubmit={handleSubmit}
          />
        </>
      )}

      {screen === "results" && (
        <Results
          score={results.score}
          maxScore={results.maxScore}
          revenue={results.revenue}
          leaks={results.leaks}
          answers={answers}
          benchmarks={results.benchmarks}
          reportAnswers={results.reportAnswers || null}
        />
      )}
    </div>
  );
}

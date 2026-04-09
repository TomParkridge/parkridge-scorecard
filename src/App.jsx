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
  // Section 1: Emotional Hook
  {
    id: "challenge",
    section: "Your Challenge",
    sectionDesc: "Let's start with what matters most to you",
    question: "What's the biggest growth challenge you're facing right now?",
    type: "longtext",
    placeholder: "Example: We're stuck at $2M and can't figure out how to break through. Most of our business comes from referrals and it's inconsistent month to month.",
    scored: false,
  },
  {
    id: "tried",
    section: "Your Challenge",
    question: "What have you already tried to fix it?",
    type: "longtext",
    placeholder: "Example: We tried running Google Ads for 6 months and hired a part-time salesperson but neither really moved the needle.",
    scored: false,
  },
  // Section 2: Lead Generation
  {
    id: "lead_sources",
    section: "Lead Generation",
    sectionDesc: "Where your customers come from",
    question: "How do most of your customers find you?",
    type: "multiselect",
    options: [
      "Referrals / word of mouth",
      "Paid ads (Google, Facebook, etc.)",
      "Organic / SEO",
      "Social media",
      "Outbound / cold outreach",
      "Other",
    ],
    scored: true,
    score: (val) => {
      if (!val || val.length === 0) return 0;
      if (val.length === 1 && val[0] === "Referrals / word of mouth") return 1;
      if (val.length === 1) return 1;
      if (val.length === 2) return 2;
      return 4;
    },
    leakId: "lead_diversity",
  },
  {
    id: "lead_volume",
    section: "Lead Generation",
    question: "Are you getting enough leads to hit your revenue goals?",
    type: "single",
    options: [
      "More than enough — we can't keep up",
      "Enough, but inconsistent month to month",
      "Not enough — we need more",
      "I'm not sure what \"enough\" looks like",
    ],
    scored: true,
    score: (val) => {
      const scores = { 0: 5, 1: 3, 2: 2, 3: 1 };
      return scores[val] ?? 0;
    },
    leakId: "lead_volume",
  },
  {
    id: "cpl_cac",
    section: "Lead Generation",
    question: "Do you know your cost per lead (CPL) and cost to acquire a customer (CAC)?",
    type: "single_with_input",
    options: [
      "Yes, I know my numbers",
      "I have a rough idea",
      "No idea",
    ],
    inputFields: [
      { label: "CPL", prefix: "$", showOn: [0, 1] },
      { label: "CAC", prefix: "$", showOn: [0, 1] },
    ],
    scored: true,
    score: (val) => {
      const scores = { 0: 5, 1: 3, 2: 1 };
      return scores[val] ?? 0;
    },
    leakId: "cost_awareness",
  },
  // Section 3: Sales Process
  {
    id: "who_sells",
    section: "Sales Process",
    sectionDesc: "What happens after a lead comes in",
    question: "Who's responsible for bringing in new business?",
    type: "single",
    options: [
      "Just me — I handle all sales and marketing",
      "Me plus 1–2 people who help",
      "A small team (3–5 people)",
      "We have a dedicated sales or marketing team",
    ],
    scored: false,
  },
  {
    id: "follow_up_speed",
    section: "Sales Process",
    question: "How quickly does someone follow up with a new lead?",
    type: "single",
    options: [
      "Within 15 minutes",
      "Within 1 hour",
      "Same day",
      "1–2 days",
      "It varies",
    ],
    scored: true,
    score: (val) => {
      const scores = { 0: 5, 1: 4, 2: 3, 3: 1, 4: 1 };
      return scores[val] ?? 0;
    },
    leakId: "follow_up_speed",
    benchmark: {
      label: "Follow-up speed",
      best: "Under 5 minutes",
      answers: ["Within 15 minutes", "Within 1 hour", "Same day", "1–2 days", "It varies"],
    },
  },
  {
    id: "sales_process",
    section: "Sales Process",
    question: "Do you have a defined sales or follow-up process?",
    type: "single",
    options: [
      "Yes, clearly defined and documented",
      "Sort of — we have a general approach",
      "No, it's mostly ad hoc",
    ],
    scored: true,
    score: (val) => {
      const scores = { 0: 5, 1: 3, 2: 1 };
      return scores[val] ?? 0;
    },
    leakId: "sales_process",
    benchmark: {
      label: "Sales process",
      best: "Documented & repeatable",
      answers: ["Clearly defined", "General approach", "Ad hoc"],
    },
  },
  // Section 4: Conversion
  {
    id: "conversion_rate",
    section: "Conversion & Tracking",
    sectionDesc: "Do you know your numbers?",
    question: "Do you know your lead-to-close conversion rate?",
    type: "single_with_input",
    options: [
      "Yes — I track it regularly",
      "I have a rough sense",
      "No — I've never measured it",
    ],
    inputFields: [
      { label: "Conversion rate", suffix: "%", showOn: [0, 1] },
    ],
    scored: true,
    score: (val) => {
      const scores = { 0: 5, 1: 3, 2: 1 };
      return scores[val] ?? 0;
    },
    leakId: "conversion_tracking",
    benchmark: {
      label: "Conversion tracking",
      best: "Tracked weekly",
      answers: ["Tracked regularly", "Rough sense", "Not tracked"],
    },
  },
  {
    id: "deal_falloff",
    section: "Conversion & Tracking",
    question: "Where do most deals fall apart?",
    type: "multiselect",
    options: [
      "They go silent after first contact",
      "They get a quote but never close",
      "They say \"I'll think about it\" and disappear",
      "We lose to competitors",
      "I'm not sure",
    ],
    scored: true,
    score: (val) => {
      if (!val || val.length === 0) return 0;
      if (val.includes("I'm not sure") && val.length === 1) return 1;
      return 3;
    },
    leakId: "deal_falloff",
  },
  {
    id: "crm",
    section: "Conversion & Tracking",
    question: "Are you using a CRM or any system to track your pipeline?",
    type: "single",
    options: [
      "Yes, actively — it's part of our daily workflow",
      "Yes, but barely — it's not really maintained",
      "No",
    ],
    scored: true,
    score: (val) => {
      const scores = { 0: 5, 1: 2, 2: 1 };
      return scores[val] ?? 0;
    },
    leakId: "crm_usage",
  },
  // Section 5: Business Context
  {
    id: "business_type",
    section: "About Your Business",
    sectionDesc: "A few quick details to personalize your results",
    question: "What does your business do?",
    type: "shorttext",
    placeholder: "e.g., IT consulting, HVAC services, insurance agency...",
    scored: false,
  },
  {
    id: "years",
    section: "About Your Business",
    question: "How long have you been in business?",
    type: "single",
    options: ["Less than 1 year", "1–3 years", "3–5 years", "5+ years"],
    scored: false,
  },
  {
    id: "revenue",
    section: "About Your Business",
    question: "What's your approximate annual revenue?",
    type: "single",
    options: ["Under $500K", "$500K – $1M", "$1M – $3M", "$3M – $5M", "$5M+"],
    scored: false,
  },
  {
    id: "deal_size",
    section: "About Your Business",
    question: "What's your average deal size or customer value?",
    type: "single",
    options: ["Under $500", "$500 – $2,000", "$2,000 – $10,000", "$10,000 – $50,000", "$50,000+", "I'm not sure"],
    scored: false,
  },
];

// ============================================================
// LEAK DEFINITIONS
// ============================================================
const LEAK_DEFS = {
  lead_diversity: {
    title: "Single-source lead generation",
    desc: "Relying on one channel (especially referrals) makes your revenue fragile and unpredictable.",
    fix: "Diversify lead sources to reduce dependency on any single channel.",
  },
  lead_volume: {
    title: "Insufficient or inconsistent lead flow",
    desc: "Without a steady stream of leads, revenue swings month to month and growth stalls.",
    fix: "Build a predictable lead generation system tied to your revenue goals.",
  },
  cost_awareness: {
    title: "No visibility into acquisition costs",
    desc: "Without knowing your CPL and CAC, you can't tell which channels are profitable and which are burning money.",
    fix: "Track cost per lead and cost to acquire for each channel to optimize spend.",
  },
  follow_up_speed: {
    title: "Slow or inconsistent follow-up",
    desc: "Leads contacted within 5 minutes are 21x more likely to convert. Every hour of delay costs you deals.",
    fix: "Implement a response protocol to contact every new lead within 15 minutes.",
  },
  sales_process: {
    title: "No defined sales process",
    desc: "Without a repeatable process, every deal is handled differently. Nothing is optimizable or trainable.",
    fix: "Document your sales process step by step so it's repeatable and scalable.",
  },
  conversion_tracking: {
    title: "Limited visibility into conversion metrics",
    desc: "Without tracking your conversion rate, it's impossible to know what's working or where deals are dying.",
    fix: "Track conversion rates at every pipeline stage — weekly at minimum.",
  },
  deal_falloff: {
    title: "Deals stalling or dying mid-pipeline",
    desc: "Prospects are entering your pipeline but not making it to close. The leak is in the middle, not the top.",
    fix: "Identify the exact stage where deals stall and address the root cause.",
  },
  crm_usage: {
    title: "No CRM or pipeline tracking system",
    desc: "Without a system, deals live in someone's head. Follow-ups get missed and there's no data to optimize.",
    fix: "Implement and actively maintain a CRM to track every deal through your pipeline.",
  },
};

// ============================================================
// REVENUE CALCULATOR
// ============================================================
function calcRevenueLeak(answers) {
  // Estimate monthly leads
  const volAnswer = answers.lead_volume;
  let leads = 30;
  if (volAnswer === 0) leads = 80;
  else if (volAnswer === 1) leads = 50;
  else if (volAnswer === 2) leads = 20;
  else leads = 20;

  // Estimate current conversion
  const convAnswer = answers.conversion_rate;
  let currentConv = 0.10;
  if (convAnswer === 0) currentConv = 0.20;
  else if (convAnswer === 1) currentConv = 0.15;
  else currentConv = 0.10;

  // Check for user-provided conversion
  const convInput = answers.conversion_rate_input_0;
  if (convInput && !isNaN(parseFloat(convInput))) {
    currentConv = parseFloat(convInput) / 100;
  }

  // Estimate improvement based on weaknesses
  let improvement = 0;
  const speedScore = QUESTIONS.find(q => q.id === "follow_up_speed")?.score(answers.follow_up_speed) ?? 5;
  const processScore = QUESTIONS.find(q => q.id === "sales_process")?.score(answers.sales_process) ?? 5;
  const trackingScore = QUESTIONS.find(q => q.id === "conversion_rate")?.score(answers.conversion_rate) ?? 5;
  const crmScore = QUESTIONS.find(q => q.id === "crm")?.score(answers.crm) ?? 5;

  if (speedScore <= 3) improvement += 0.07;
  if (processScore <= 3) improvement += 0.06;
  if (trackingScore <= 3) improvement += 0.04;
  if (crmScore <= 2) improvement += 0.03;

  improvement = Math.min(improvement, 0.20);
  const potentialConv = currentConv + improvement;

  // Estimate deal size
  const dealAnswer = answers.deal_size;
  const dealSizes = [350, 1250, 6000, 30000, 75000, 2000];
  let dealSize = dealSizes[dealAnswer] ?? 2000;

  // Calculate
  const gap = potentialConv - currentConv;
  const lostRevLow = Math.round(leads * gap * dealSize * 0.7);
  const lostRevHigh = Math.round(leads * gap * dealSize * 1.3);

  return {
    low: Math.max(lostRevLow, 500),
    high: Math.max(lostRevHigh, 2000),
    leads,
    currentConv: Math.round(currentConv * 100),
    potentialConv: Math.round(potentialConv * 100),
    dealSize,
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
      <Section title="Company Profile" rows={[
        ["Name", ra.name],
        ["Email", ra.email],
        ["Company", ra.company],
        ["Business", ra.businessType],
        ["Years in Business", ra.years],
        ["Annual Revenue", ra.revenue],
        ["Avg Deal Size", ra.dealSize],
        ["Primary Challenge", ra.challenge],
      ]} />
      <Section title="Pipeline & Leads" rows={[
        ["Lead Sources", ra.leadSources],
        ["Monthly Lead Volume", ra.leadVolume],
        ["CPL / CAC Awareness", ra.cplCac],
        ["Cost per Lead", ra.cplValue ? `$${ra.cplValue}` : ""],
        ["Cost to Acquire (CAC)", ra.cacValue ? `$${ra.cacValue}` : ""],
      ]} />
      <Section title="Sales Process" rows={[
        ["Who Sells", ra.whoSells],
        ["Follow-up Speed", ra.followUpSpeed],
        ["Sales Process", ra.salesProcess],
        ["Conversion Rate", ra.conversionRate + (ra.conversionValue ? ` — ${ra.conversionValue}` : "")],
        ["Deals Stalling At", ra.dealFalloff],
        ["CRM / Pipeline Tool", ra.crm],
      ]} />
    </div>
  );
}

// Results screen
function Results({ score, maxScore, revenue, leaks, answers, benchmarks, reportAnswers }) {
  const displayScore = Math.round((score / maxScore) * 100);
  const activeLeaks = leaks.filter(l => l.score < l.maxPts).slice(0, 3);
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
  if (displayScore <= 40) { diagnosis = "Critical — Your pipeline has major leaks. You're leaving significant revenue on the table."; diagColor = C.red; }
  else if (displayScore <= 60) { diagnosis = "Needs Work — Your pipeline has clear gaps. Fixing them could unlock meaningful growth."; diagColor = C.orange; }
  else if (displayScore <= 80) { diagnosis = "Solid Foundation — Your pipeline is functional but there's room to optimize and scale."; diagColor = "#D97706"; }
  else { diagnosis = "Strong — Your pipeline is in good shape. Fine-tuning could take you to the next level."; diagColor = C.green; }

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

          {/* Reframe */}
          {(() => {
            if (activeLeaks.length === 0) return null;
            const reframeMap = {
              0: "Your pipeline isn't a volume problem — it's a conversion problem. The leads are there. The opportunity is in how effectively you turn them into revenue.",
              1: "You don't necessarily need more leads — you need to convert the ones you already have more consistently. Fixing the pipeline makes your existing lead flow more predictable.",
              2: "Lead volume is part of your challenge — but even with more leads, a leaky pipeline will keep conversion low. Fixing the system first means every new lead works harder for you.",
              3: "Before investing in more leads, it's worth knowing what your pipeline can actually handle. Getting clear on your conversion rate tells you exactly how many leads you need.",
            };
            const reframe = reframeMap[answers.lead_volume];
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
            let ctaHeading, ctaBody;
            if (displayScore <= 40) {
              ctaHeading = "Your pipeline needs immediate attention.";
              ctaBody = "Book a free 30-minute Revenue Review. We'll prioritise the 2–3 fixes that will move the needle fastest and stop the bleeding.";
            } else if (displayScore <= 60) {
              ctaHeading = "Want to see exactly how to fix these leaks?";
              ctaBody = "Book a free 30-minute Revenue Review. We'll walk through your score and map out a clear action plan tailored to your pipeline.";
            } else if (displayScore <= 80) {
              ctaHeading = "Ready to take your pipeline to the next level?";
              ctaBody = "Book a free 30-minute Revenue Review. We'll identify the optimisations that turn a solid pipeline into a predictable growth engine.";
            } else {
              ctaHeading = "Your pipeline is strong — let's keep it that way.";
              ctaBody = "Book a free 30-minute call. We'll look at edge-case optimisations and build on what's already working to protect and extend your lead.";
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
              href="https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ0ONNJdKWfkWoWrRYEttK7meFcLhDiO7goNRsEdPBeRBdXmBd3MIdOuAuYCz8IXKNNoZDT5muAB?gv=true"
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
              {activeLeaks.length > 0 ? "Book Your Free Revenue Review" : "Book Your Free Strategy Call"}
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
          The Pipeline Scorecard
        </div>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif", fontWeight: 400,
          fontSize: "clamp(2.5rem, 5.5vw, 3.5rem)", lineHeight: 1.15,
          color: C.navy, marginBottom: 20, letterSpacing: "-0.01em",
        }}>
          Let's find where your<br />revenue is <em style={{ fontStyle: "italic", color: C.orange }}>leaking</em>
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
            { title: "Pipeline Health Score", desc: "a single number showing your overall pipeline strength at a glance" },
            { title: "Revenue Left on the Table", desc: "see exactly where deals are slipping away and how much it's costing you" },
            { title: "Benchmark Comparison", desc: "understand how your pipeline stacks up against top-performing businesses" },
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
// MAIN APP
// ============================================================
export default function App() {
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
    return {
      score: parseInt(p.get('score') || '0'),
      maxScore: 100,
      leaks: [
        { title: p.get('l1') || '', desc: p.get('d1') || '' },
        { title: p.get('l2') || '', desc: p.get('d2') || '' },
        { title: p.get('l3') || '', desc: p.get('d3') || '' },
      ].filter(l => l.title),
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
        businessType: p.get('biz') || '',
        years: p.get('yrs') || '',
        revenue: p.get('rev') || '',
        dealSize: p.get('ds') || '',
        challenge: p.get('ch') || '',
        leadSources: p.get('lsrc') || '',
        leadVolume: p.get('lvol') || '',
        cplCac: p.get('cpl') || '',
        cplValue: p.get('cplv') || '',
        cacValue: p.get('cacv') || '',
        whoSells: p.get('ws') || '',
        followUpSpeed: p.get('fup') || '',
        salesProcess: p.get('sp') || '',
        conversionRate: p.get('cr') || '',
        conversionValue: p.get('crv') || '',
        dealFalloff: p.get('df') || '',
        crm: p.get('crm') || '',
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

    // Add all answered questions
    if (answers.challenge) payload.q1_challenge = answers.challenge;
    if (answers.tried) payload.q2_tried = answers.tried;
    if (answers.lead_sources) payload.q3_lead_sources = Array.isArray(answers.lead_sources) ? answers.lead_sources.join(", ") : answers.lead_sources;
    if (answers.lead_volume !== undefined) payload.q4_lead_volume = QUESTIONS.find(q => q.id === "lead_volume")?.options[answers.lead_volume] || "";
    if (answers.cpl_cac !== undefined) payload.q5_cpl_cac = QUESTIONS.find(q => q.id === "cpl_cac")?.options[answers.cpl_cac] || "";
    if (answers.cpl_cac_input_0) payload.q5_cpl_value = answers.cpl_cac_input_0;
    if (answers.cpl_cac_input_1) payload.q5_cac_value = answers.cpl_cac_input_1;
    if (answers.who_sells !== undefined) payload.q6_who_sells = QUESTIONS.find(q => q.id === "who_sells")?.options[answers.who_sells] || "";
    if (answers.follow_up_speed !== undefined) payload.q7_follow_up_speed = QUESTIONS.find(q => q.id === "follow_up_speed")?.options[answers.follow_up_speed] || "";
    if (answers.sales_process !== undefined) payload.q8_sales_process = QUESTIONS.find(q => q.id === "sales_process")?.options[answers.sales_process] || "";
    if (answers.conversion_rate !== undefined) payload.q9_conversion_rate = QUESTIONS.find(q => q.id === "conversion_rate")?.options[answers.conversion_rate] || "";
    if (answers.conversion_rate_input_0) payload.q9_conversion_value = answers.conversion_rate_input_0;
    if (answers.deal_falloff) payload.q10_deal_falloff = Array.isArray(answers.deal_falloff) ? answers.deal_falloff.join(", ") : answers.deal_falloff;
    if (answers.crm !== undefined) payload.q11_crm = QUESTIONS.find(q => q.id === "crm")?.options[answers.crm] || "";
    if (answers.business_type) payload.q12_business_type = answers.business_type;
    if (answers.years !== undefined) payload.q13_years = QUESTIONS.find(q => q.id === "years")?.options[answers.years] || "";
    if (answers.revenue !== undefined) payload.q14_revenue = QUESTIONS.find(q => q.id === "revenue")?.options[answers.revenue] || "";
    if (answers.deal_size !== undefined) payload.q15_deal_size = QUESTIONS.find(q => q.id === "deal_size")?.options[answers.deal_size] || "";

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

    QUESTIONS.forEach(q => {
      if (q.scored && q.score) {
        const val = answers[q.id];
        const pts = q.score(val);
        const maxPts = q.id === "lead_sources" ? 4 : q.id === "deal_falloff" ? 3 : 5;
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
    if (leakScores[0]) { reportUrl.searchParams.set('l1', leakScores[0].title); reportUrl.searchParams.set('d1', leakScores[0].desc); }
    if (leakScores[1]) { reportUrl.searchParams.set('l2', leakScores[1].title); reportUrl.searchParams.set('d2', leakScores[1].desc); }
    if (leakScores[2]) { reportUrl.searchParams.set('l3', leakScores[2].title); reportUrl.searchParams.set('d3', leakScores[2].desc); }
    // Revenue
    if (revenue?.low) reportUrl.searchParams.set('rlo', revenue.low);
    if (revenue?.high) reportUrl.searchParams.set('rhi', revenue.high);
    // Company
    if (answers.business_type) reportUrl.searchParams.set('biz', answers.business_type.slice(0, 120));
    if (readable('years')) reportUrl.searchParams.set('yrs', readable('years'));
    if (readable('revenue')) reportUrl.searchParams.set('rev', readable('revenue'));
    if (readable('deal_size')) reportUrl.searchParams.set('ds', readable('deal_size'));
    if (answers.challenge) reportUrl.searchParams.set('ch', answers.challenge.slice(0, 200));
    // Leads
    if (answers.lead_sources) reportUrl.searchParams.set('lsrc', Array.isArray(answers.lead_sources) ? answers.lead_sources.join(', ') : answers.lead_sources);
    if (readable('lead_volume')) reportUrl.searchParams.set('lvol', readable('lead_volume'));
    if (readable('cpl_cac')) reportUrl.searchParams.set('cpl', readable('cpl_cac'));
    if (answers.cpl_cac_input_0) reportUrl.searchParams.set('cplv', answers.cpl_cac_input_0);
    if (answers.cpl_cac_input_1) reportUrl.searchParams.set('cacv', answers.cpl_cac_input_1);
    // Sales
    if (readable('who_sells')) reportUrl.searchParams.set('ws', readable('who_sells'));
    if (readable('follow_up_speed')) reportUrl.searchParams.set('fup', readable('follow_up_speed'));
    if (readable('sales_process')) reportUrl.searchParams.set('sp', readable('sales_process'));
    if (readable('conversion_rate')) reportUrl.searchParams.set('cr', readable('conversion_rate'));
    if (answers.conversion_rate_input_0) reportUrl.searchParams.set('crv', answers.conversion_rate_input_0 + '%');
    if (answers.deal_falloff) reportUrl.searchParams.set('df', Array.isArray(answers.deal_falloff) ? answers.deal_falloff.join(', ') : answers.deal_falloff);
    if (readable('crm')) reportUrl.searchParams.set('crm', readable('crm'));
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
    if (displayScore <= 40) { diagnosisText = "Critical — Your pipeline has major leaks. You're leaving significant revenue on the table."; diagColor = "#ef4444"; }
    else if (displayScore <= 60) { diagnosisText = "Needs Work — Your pipeline has clear gaps. Fixing them could unlock meaningful growth."; diagColor = "#f97316"; }
    else if (displayScore <= 80) { diagnosisText = "Solid Foundation — Your pipeline is functional but there's room to optimize and scale."; diagColor = "#D97706"; }
    else { diagnosisText = "Strong — Your pipeline is in good shape. Fine-tuning could take you to the next level."; diagColor = "#22c55e"; }

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
    fetch("https://api.hsforms.com/submissions/v3/integration/submit/245806817/62f93bdb-38db-418b-a40a-c8a807f75949", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: [{ name: "email", value: emailData.email }],
        context: { pageUri: "https://scorecard.parkridgeadvisory.com", pageName: "Pipeline Scorecard" },
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

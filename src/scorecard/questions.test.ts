import { describe, expect, it } from 'vitest';
import spec from '../../docs/specs/scorecard-v2-handoff.md?raw';
import { OTHER_OPTION_ID, QUESTIONS } from './questions';

interface SpecQuestion {
  number: number;
  prompt: string;
  options: { label: string; help?: string }[];
  help?: string;
}

// Parses "## Final 11 questions" in the handoff spec. Format per question:
// "N. Prompt? (pick ...): Opt · Opt · Opt (trailing note)", or, for Q10, one "- Label: help" sub-bullet per option.
function parseSpec(markdown: string): SpecQuestion[] {
  const start = markdown.indexOf('## Final 11 questions');
  const end = markdown.indexOf('Contact step:', start);
  const lines = markdown.slice(start, end).split('\n');
  const questions: SpecQuestion[] = [];

  for (const line of lines) {
    const q = line.match(/^(\d+)\. ([^?]+\?)(.*)$/);
    if (q) {
      let rest = q[3].trim();
      const help = rest.match(/help text: "([^"]+)"/)?.[1];
      rest = rest.replace(/^\((pick up to 3|pick all|each option has help text)\):?\s*/, '');
      rest = rest.replace(/\s*\([^)]*\)$/, '');
      const options = rest
        ? rest.split(' · ').map((label) => ({ label: label.replace(/\s*\([^)]*\)$/, '') }))
        : [];
      questions.push({ number: Number(q[1]), prompt: q[2], options, help });
      continue;
    }
    const sub = line.match(/^\s+- (.+?): (.+)$/);
    if (sub) questions[questions.length - 1].options.push({ label: sub[1], help: sub[2] });
  }
  return questions;
}

const specQuestions = parseSpec(spec);

describe('question config', () => {
  it('has the 11 questions, numbered 1 to 11, in section order', () => {
    expect(QUESTIONS.map((q) => q.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(QUESTIONS.map((q) => q.section)).toEqual([
      'Your challenge',
      ...Array(7).fill('Your pipeline'),
      ...Array(3).fill('Your tools and AI'),
    ]);
  });

  it('marks the first question of each section, and only those', () => {
    const firsts = QUESTIONS.filter((q) => q.sectionDesc !== undefined).map((q) => q.number);
    expect(firsts).toEqual([1, 2, 9]);
  });

  it('uses unique question ids and unique option ids within each question', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(new Set(q.options.map((o) => o.id)).size, q.id).toBe(q.options.length);
    }
  });

  it('sets the pick limits', () => {
    const byNumber = (n: number) => QUESTIONS[n - 1];
    expect(byNumber(1)).toMatchObject({ type: 'multi', maxPicks: 3 });
    expect(byNumber(2).type).toBe('multi');
    expect(byNumber(2).maxPicks).toBeUndefined();
    expect(byNumber(11)).toMatchObject({ type: 'multi', maxPicks: 3 });
    for (const n of [3, 4, 5, 6, 7, 8, 9, 10]) expect(byNumber(n).type).toBe('single');
  });

  it('has help text on Q7 and on every Q10 option', () => {
    expect(QUESTIONS[6].help).toBeTruthy();
    for (const o of QUESTIONS[9].options) expect(o.help, o.id).toBeTruthy();
  });

  it('gives Q1 an Other option', () => {
    expect(QUESTIONS[0].options.map((o) => o.id)).toContain(OTHER_OPTION_ID);
  });

  it('leaves the insurance labels empty for now', () => {
    for (const q of QUESTIONS) {
      expect(q.insuranceLabel ?? '').toBe('');
      for (const o of q.options) expect(o.insuranceLabel ?? '').toBe('');
    }
  });

  it('contains no em-dashes in any copy', () => {
    expect(JSON.stringify(QUESTIONS)).not.toContain('—');
  });
});

describe('question copy matches docs/specs/scorecard-v2-handoff.md', () => {
  it('parses 11 questions from the spec', () => {
    expect(specQuestions.map((q) => q.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  for (const q of QUESTIONS) {
    it(`Q${q.number} prompt, options and help text`, () => {
      const s = specQuestions[q.number - 1];
      expect(q.prompt).toBe(s.prompt);
      expect(q.help).toBe(s.help);
      expect(q.options.map((o) => o.label)).toEqual(s.options.map((o) => o.label));
      expect(q.options.map((o) => o.help)).toEqual(s.options.map((o) => o.help));
    });
  }
});

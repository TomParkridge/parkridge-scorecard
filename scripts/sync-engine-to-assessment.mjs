// The scorecard-submit Edge Function lives in ~/parkridge-assessment and recomputes every score
// server-side, so it needs these files. This repo is the source of truth; the copies are exact.
//   node scripts/sync-engine-to-assessment.mjs           copy the files across
//   node scripts/sync-engine-to-assessment.mjs --check   fail if the two repos differ
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../src/scorecard');
const TARGET = join(homedir(), 'parkridge-assessment/supabase/functions/_shared/scorecard');
const FILES = ['questions.ts', 'submission.ts', 'engine/engine.ts', 'engine/index.ts', 'engine/rounding.ts', 'engine/tables.ts'];

if (process.argv.includes('--check')) {
  const stale = FILES.filter((f) => {
    const target = join(TARGET, f);
    return !existsSync(target) || !readFileSync(join(SOURCE, f)).equals(readFileSync(target));
  });
  if (stale.length) {
    console.error(`Out of sync: ${stale.join(', ')}. Run without --check, then redeploy scorecard-submit.`);
    process.exit(1);
  }
  console.log(`${FILES.length} files in sync.`);
} else {
  for (const f of FILES) {
    mkdirSync(dirname(join(TARGET, f)), { recursive: true });
    copyFileSync(join(SOURCE, f), join(TARGET, f));
  }
  console.log(`Copied ${FILES.length} files to ${TARGET}.`);
}

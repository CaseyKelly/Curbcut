// Validates the eval dataset: every case.json against EvalCase, its files
// against the case, and manifest.json against the case folders.
//
// Run with `npm run evals:validate`.
import { fileURLToPath } from 'node:url';
import { countBy, validateDataset } from './dataset.ts';

const root = fileURLToPath(new URL('../../dataset/', import.meta.url));
const { manifest, cases, errors } = validateDataset(root);

const format = (counts: [string, number][]) => counts.map(([k, n]) => `${k} ${n}`).join(', ');
console.log(`Dataset v${manifest?.datasetVersion ?? '?'}: ${cases.length} cases`);
console.log(`  categories: ${format(countBy(cases, 'category'))}`);
console.log(`  outcomes:   ${format(countBy(cases, 'expectedOutcome'))}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('\nAll cases valid.');

/**
 * Table export: which value a column contributes, and CSV correctness.
 *
 * Run with: npm run verify:export
 */
const SP = require('path').join(__dirname, '..', 'node_modules', '.cache', 'realx8-verify');

// Capture what would be downloaded instead of touching a real DOM.
let captured = null;
global.Blob = class { constructor(parts, opts) { this.parts = parts; this.type = opts?.type; } };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.document = {
  createElement: () => ({ click() {}, remove() {}, set href(v) {}, set download(v) { captured = { ...captured, filename: v }; } }),
  body: { appendChild(el) {} },
};

// The real module, bundled to CJS on the fly so this needs no test runner and
// no browser — the logic under test (which value a column exports, and CSV
// escaping) is pure, and those are the two places a silent corruption hides.
const fs = require('fs');
const path = require('path');
fs.mkdirSync(SP, { recursive: true });
const bundle = path.join(SP, 'tableExport.cjs');
require('child_process').execFileSync('npx', [
  'esbuild', path.join(__dirname, '..', 'src', 'utils', 'tableExport.js'),
  '--bundle', '--format=cjs', '--platform=node', `--outfile=${bundle}`,
  '--external:exceljs', '--external:jspdf', '--external:jspdf-autotable',
], { stdio: 'ignore' });

const { exportCsv, cellValue, exportableColumns } = require(bundle);

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${label}${detail ? `\n        ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

// Intercept the CSV text by replacing Blob.
let csvText = '';
global.Blob = class { constructor(parts) { csvText = parts.join(''); } };

console.log('\n── What gets exported ───────────────────────────────────────────');

const columns = [
  { header: 'Ref', accessor: 'ref' },
  { header: 'Client', accessor: 'client' },
  { header: 'Status', accessor: 'status', render: (r) => ({ jsx: r.status }) },
  { header: 'Amount', accessor: 'amount', exportValue: (r) => r.amount.toFixed(2) },
  { header: 'Actions', accessor: 'actions', exportable: false },
  { header: 'Badge', render: (r) => ({ jsx: 'x' }) },
];

check('Columns marked exportable:false are dropped',
  !exportableColumns(columns).some((c) => c.header === 'Actions'));
check('A render-only column with no accessor is dropped',
  !exportableColumns(columns).some((c) => c.header === 'Badge'),
  'nothing sensible to write for a column that is purely JSX');
check('exportValue wins over the raw field',
  cellValue({ amount: 1234.5 }, columns[3]) === '1234.50');
check('A JSX render is never used as a value',
  cellValue({ status: 'PAID' }, columns[2]) === 'PAID',
  'the accessor is read, not the element render() would return');

console.log('\n── CSV correctness ──────────────────────────────────────────────');

exportCsv({
  rows: [
    { ref: 'INV-0001', client: 'Adeyemi, Chinonso', status: 'PAID', amount: 1500 },
    { ref: 'INV-0002', client: 'He said "yes"', status: 'DRAFT', amount: 20 },
    { ref: 'INV-0003', client: 'Line one\nLine two', status: 'SENT', amount: 0 },
    { ref: 'INV-0004', client: 'Ìbàdàn ₦', status: 'SENT', amount: 9.5 },
  ],
  columns,
  filename: 'test',
});

const lines = csvText.replace(/^﻿/, '').split('\r\n');
check('Header row lists only exportable columns',
  lines[0] === 'Ref,Client,Status,Amount', lines[0]);
check('A comma inside a value is quoted, not left to shift the columns',
  lines[1] === 'INV-0001,"Adeyemi, Chinonso",PAID,1500.00', lines[1]);
check('Embedded quotes are doubled',
  lines[2] === 'INV-0002,"He said ""yes""",DRAFT,20.00', lines[2]);
check('A newline inside a value is quoted so the row stays one row',
  lines[3].startsWith('INV-0003,"Line one'), JSON.stringify(lines[3]));
check('The file starts with a UTF-8 BOM so Excel reads ₦ correctly',
  csvText.charCodeAt(0) === 0xFEFF, 'without it, currency and accents arrive mangled');
check('Unicode survives', csvText.includes('Ìbàdàn ₦'));

console.log('\n── Stale-build detection ────────────────────────────────────────');

const staleBundle = path.join(SP, 'lazyImport.cjs');
require('child_process').execFileSync('npx', [
  'esbuild', path.join(__dirname, '..', 'src', 'utils', 'lazyImport.js'),
  '--bundle', '--format=cjs', '--platform=node', `--outfile=${staleBundle}`,
], { stdio: 'ignore' });
const { isStaleBuildError, lazyImport, STALE_BUILD } = require(staleBundle);

// The exact strings browsers produce when a hashed chunk has been removed.
const BROWSER_MESSAGES = [
  'Failed to fetch dynamically imported module: https://x/assets/exceljs.min-C1oitp1v.js',
  'error loading dynamically imported module',
  "Expected a JavaScript module script but the server responded with a MIME type of 'text/html'. "
    + "Strict MIME type checking is enforced for module scripts per HTML spec.",
  'Importing a module script failed.',
];
check('Every browser phrasing of a missing chunk is recognised',
  BROWSER_MESSAGES.every((m) => isStaleBuildError(new Error(m))),
  BROWSER_MESSAGES.map((m) => isStaleBuildError(new Error(m))).join(', '));

check('A real error inside the module is NOT treated as a stale build',
  !isStaleBuildError(new TypeError("Cannot read properties of undefined (reading 'x')")),
  'reporting a genuine bug as "reload the page" would send someone chasing nothing');

(async () => {
  let translated = null;
  try {
    await lazyImport(async () => { throw new Error('Failed to fetch dynamically imported module: /assets/a.js'); });
  } catch (error) { translated = error; }
  check('A stale chunk becomes an actionable error, not the browser string',
    translated?.code === STALE_BUILD && /new version of the app/i.test(translated.message),
    translated?.message);

  let passedThrough = null;
  try {
    await lazyImport(async () => { throw new RangeError('maximum call stack size exceeded'); });
  } catch (error) { passedThrough = error; }
  check('A genuine error is rethrown untouched',
    passedThrough instanceof RangeError && passedThrough.code !== STALE_BUILD);

  console.log('\n── Export progress ─────────────────────────────────────────────');

  const seen = [];
  exportCsv({
    rows: [{ ref: 'INV-0001', client: 'A', status: 'PAID', amount: 1 }],
    columns,
    filename: 'test',
    onProgress: (p) => seen.push(p),
  });
  check('CSV export reports progress and finishes at 100%',
    seen.length >= 2 && seen[seen.length - 1].percent === 100,
    seen.map((p) => `${p.percent}% ${p.stage}`).join(' -> '));
  check('Progress never goes backwards',
    seen.every((p, i) => i === 0 || p.percent >= seen[i - 1].percent),
    'a bar that jumps back reads as a fault');
  check('Each stage is named, so the slow part is identifiable',
    seen.every((p) => typeof p.stage === 'string' && p.stage.length > 0));

  console.log(`\n  ${pass}/${pass + fail} passed.\n`);
  process.exit(fail ? 1 : 0);
})();

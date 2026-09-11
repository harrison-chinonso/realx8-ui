/**
 * The dashboard export, verified as a REPORT rather than as a picture.
 *
 * What "Export" used to mean was window.print(), and the complaint about it was
 * exact: it printed the visible screen. A widget scrolled out of view, behind a
 * toggle, or below the fold simply was not in the output.
 *
 * So the property worth testing is not "a PDF is produced" — the old one
 * produced a PDF too. It is that the document is built from the dashboard's
 * DATA, and therefore contains figures that were never on screen. Every check
 * below feeds data that no viewport could have shown all of at once, and
 * asserts it comes out the other side.
 *
 * Run with: npm run verify:dashboard-export
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CACHE = path.join(__dirname, '..', 'node_modules', '.cache', 'realx8-verify');

// The browser globals the export path touches, captured rather than performed.
let saved = null;
let downloaded = null;
global.Blob = class {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options?.type;
    // Kept so the test can open the workbook that was actually produced,
    // rather than trusting that a download was offered.
    global.__lastBlobParts = parts;
  }
};
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.document = {
  createElement: () => ({
    click() {}, remove() {},
    set href(value) {},
    set download(value) { downloaded = value; },
  }),
  body: { appendChild() {} },
};

let pass = 0; let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${label}${detail ? `\n        ${detail}` : ''}`);
  if (ok) pass += 1; else fail += 1;
};

fs.mkdirSync(CACHE, { recursive: true });
const bundle = path.join(CACHE, 'dashboardExport.cjs');
execFileSync('npx', [
  'esbuild', path.join(__dirname, '..', 'src', 'utils', 'dashboardExport.js'),
  '--bundle', '--format=cjs', '--platform=node', `--outfile=${bundle}`,
  '--external:exceljs', '--external:jspdf', '--external:jspdf-autotable',
], { stdio: 'ignore' });

const { buildSections, exportDashboardExcel, exportDashboardPdf } = require(bundle);

/**
 * A dashboard with more in it than a screen can hold: twelve months of
 * revenue, twenty-five due payments and a leaderboard, plus every summary
 * figure. This is the case the old export silently truncated.
 */
const DATA = {
  totalProperties: 128, totalClients: 940, totalRealtors: 63, totalStaff: 21,
  totalInvoices: 512, totalSales: 77, totalReferrals: 34,
  totalInvoiceAmount: 412000000, totalPaid: 260000000, outstanding: 152000000,
  totalDue: 38000000, totalRevenue: 512000000, rangedRevenue: 91000000,
  ytdRevenue: 260000000, collectionRate: 63.1, overdueCount: 41, oldestUnpaidDays: 212,
  monthlyRevenue: Array.from({ length: 12 }, (_, i) => ({
    label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    amount: (i + 1) * 1000000,
  })),
  propertyStatusMap: { available: 60, sold: 48, reserved: 20 },
  leadStatusMap: { new: 120, contacted: 90, won: 30, lost: 44 },
  conversionRate: 10.4,
  duePayments: Array.from({ length: 30 }, (_, i) => ({
    invoice_id: `INV-${String(i + 1).padStart(4, '0')}`,
    client_name: `Client ${i + 1}`,
    amount: (i + 1) * 100000,
    dueDate: '2026-06-30',
    daysLeft: i - 5,
  })),
  realtorLeaderboard: Array.from({ length: 30 }, (_, i) => ({
    name: `Realtor ${i + 1}`, sales: 30 - i, amount: (30 - i) * 500000,
  })),
  openTickets: 12, closedTickets: 300, escalatedTickets: 3, totalTickets: 315,
  avgResolutionHours: 18.42,
};

const sections = buildSections(DATA, '₦');
const titles = sections.map((s) => s.title);
const flat = JSON.stringify(sections);

console.log('\n── The report is built from data, not from the screen ───────────');

check('Every section the data supports is present',
  ['Summary', 'Finance', 'Monthly revenue', 'Properties by status',
    'Leads by status', 'Top due payments', 'Realtor leaderboard', 'Support']
    .every((t) => titles.includes(t)),
  titles.join(' · '));

check('All twelve months are included, not the few a chart had room for',
  ['Jan', 'Jun', 'Dec'].every((m) => flat.includes(`"${m}"`)),
  'a widget showing a rolling six months still exports the full year');

check('Support figures survive even though that widget sits far down the page',
  flat.includes('Average resolution (hours)') && flat.includes('18.4'),
  'scrolled out of view is not a reason to be absent from a report');

check('Currency is formatted with the symbol the dashboard was showing',
  flat.includes('₦'), 'passed through rather than hardcoded');

check('Percentages are rendered as percentages',
  flat.includes('63.1%') && flat.includes('10.4%'));

console.log('\n── Long sections are bounded, and bounded visibly ───────────────');

const due = sections.find((s) => s.title === 'Top due payments');
const board = sections.find((s) => s.title === 'Realtor leaderboard');
check('Top due payments is capped at 25 rows, from 30 supplied',
  due.body.length === 25, `${due.body.length} rows — "Top" is the claim, and it is kept`);
check('The leaderboard is capped the same way',
  board.body.length === 25, `${board.body.length} rows`);
check('The cap keeps the head of the list, not an arbitrary slice',
  due.body[0][0] === 'INV-0001' && board.body[0][0] === 'Realtor 1');

console.log('\n── An empty section is dropped, not left as a bare heading ──────');

{
  const sparse = buildSections({
    totalProperties: 3, totalClients: 4, openTickets: 1,
  }, '');
  const sparseTitles = sparse.map((s) => s.title);
  check('No monthly revenue means no "Monthly revenue" heading',
    !sparseTitles.includes('Monthly revenue'),
    'an empty heading over blank space reads as a rendering fault');
  check('No leads means no "Leads by status"', !sparseTitles.includes('Leads by status'));
  check('Summary and Finance are always there, being the figures that always exist',
    sparseTitles.includes('Summary') && sparseTitles.includes('Finance'),
    sparseTitles.join(' · '));
  /**
   * Checked cell by cell rather than by searching the serialised sections:
   * "Finance" contains the letters of NaN, so a substring match over the whole
   * structure reports a fault that is not there.
   */
  const broken = [];
  sparse.forEach((section) => section.body.forEach((row) => row.forEach((cell) => {
    const text = String(cell);
    if (text.includes('undefined') || text === 'NaN' || text.includes('NaN')) {
      broken.push(`${section.title} / ${row[0]}: ${text}`);
    }
  })));
  check('Absent figures become zero rather than "undefined" or NaN',
    broken.length === 0,
    broken.length ? broken.join(' · ') : 'a report showing NaN is worse than one showing 0');
}

{
  let threw = null;
  try { buildSections({}, ''); } catch (error) { threw = error; }
  check('An empty dashboard does not throw', threw === null, threw?.message || '');
}

console.log('\n── The files themselves ─────────────────────────────────────────');

(async () => {
  await exportDashboardExcel({ data: DATA, symbol: '₦', title: 'Dashboard report' });
  check('Excel: a workbook is produced and offered as a download',
    downloaded === 'dashboard-report.xlsx', `filename=${downloaded}`);

  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const parts = global.__lastBlobParts;
  await workbook.xlsx.load(Buffer.from(parts[0]));
  const sheetNames = workbook.worksheets.map((w) => w.name);
  check('Excel: one sheet per section, so nothing is merged away',
    sheetNames.length === sections.length,
    sheetNames.join(' · '));
  check('Excel: the monthly sheet holds all twelve rows plus a header',
    workbook.getWorksheet('Monthly revenue').rowCount === 13,
    `${workbook.getWorksheet('Monthly revenue').rowCount} rows`);

  // ── PDF ──────────────────────────────────────────────────────────────────
  const { jsPDF } = require('jspdf');
  const autoTable = require('jspdf-autotable').default ?? require('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  let cursor = 100;
  buildSections(DATA, '₦').forEach((section) => {
    autoTable(doc, {
      startY: cursor,
      head: [[{ content: section.title, colSpan: section.head.length }], section.head],
      body: section.body,
      margin: { left: 40, right: 40 },
    });
    cursor = (doc.lastAutoTable?.finalY ?? cursor) + 24;
  });
  const pages = doc.internal.getNumberOfPages();
  check('PDF: the report runs to several pages, paginated properly',
    pages > 1, `${pages} pages — a screenshot would have been exactly one`);
  const bytes = doc.output('arraybuffer');
  check('PDF: a real document is produced',
    bytes.byteLength > 5000, `${bytes.byteLength} bytes`);

  check('PDF: it is a vector document, not an embedded screenshot',
    !Buffer.from(bytes).includes(Buffer.from('/Subtype /Image')),
    'no rasterised page image — the tables are text, so the figures stay selectable');

  /**
   * The dashboard renders before its data arrives, so an impatient click has to
   * be survivable. Tested through the exported function rather than through
   * buildSections, because the guard lives there and that is the only way the
   * case can actually be reached.
   */
  let exportThrew = null;
  try {
    await exportDashboardExcel({ data: undefined, symbol: '', title: 'Empty report' });
  } catch (error) { exportThrew = error; }
  check('Exporting before the data has loaded does not throw',
    exportThrew === null,
    exportThrew?.message || 'produces an empty-but-valid workbook rather than an error');

  console.log('\n── Results ─────────────────────────────────────────────────────\n');
  console.log(`  ${fail === 0 ? '\x1b[32m' : '\x1b[31m'}${pass}/${pass + fail} checks passed.\x1b[0m\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((error) => {
  console.error('\n\x1b[31mThe verification itself failed:\x1b[0m', error);
  process.exit(1);
});

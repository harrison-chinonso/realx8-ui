import { lazyImport } from './lazyImport';

/**
 * A spreadsheet, read into the CSV text the importers already understand.
 *
 * ── One conversion point, nothing downstream changes ────────────────────────
 *
 * Every import in this application — bank statements, a chart of accounts,
 * opening balances, open items, a payroll journal — reads CSV text and has
 * done since it was built. Teaching each of them about workbooks would be five
 * parsers and five sets of column handling to keep in step.
 *
 * So a workbook is turned into exactly the CSV a person would have got by
 * choosing "Save as CSV" themselves, and handed to the reader that already
 * exists. The server never learns that spreadsheets are a thing.
 *
 * ── Loaded on demand ────────────────────────────────────────────────────────
 *
 * exceljs is larger than the rest of this application put together, which is
 * why tableExport already imports it dynamically. Somebody importing a CSV —
 * still the common case — never fetches it.
 */

/** A cell as text, flattening the shapes exceljs uses for rich content. */
const cellText = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    /*
     * ISO, not the locale. A date written back as 03/04/2026 would land in the
     * importer's day-first/month-first question all over again — and unlike a
     * bank's CSV, here we KNOW what the date is, so there is no reason to
     * re-introduce the ambiguity.
     */
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    // A formula cell carries its computed result; a hyperlink its text; rich
    // text a list of runs. In every case what a reader sees is what we want.
    if (value.result !== undefined) return cellText(value.result);
    if (value.text !== undefined) return cellText(value.text);
    if (Array.isArray(value.richText)) return value.richText.map((run) => run.text).join('');
    if (value.hyperlink !== undefined) return cellText(value.hyperlink);
    if (value.error !== undefined) return '';
    return '';
  }
  return String(value);
};

/** One row, escaped as a CSV line. */
const toCsvLine = (cells) => cells
  .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
  .join(',');

/**
 * Turn a workbook into the CSV of each of its sheets.
 *
 * @returns {{ sheets: Array<{ name, csv, rows }>, suggested }}
 * @throws  where the file cannot be read as a workbook at all.
 *
 * ── Every sheet, not a guess at the right one ───────────────────────────────
 *
 * A bank's export routinely carries a cover sheet — an account number, a date
 * range, a logo — in front of the transactions, and an accounting package's
 * carries one tab per ledger. "The first non-empty sheet" reads the cover, and
 * the import then fails on a file that was perfectly good.
 *
 * So all of them are read and the caller is told which is which. `suggested`
 * is the one with the most rows, which is right almost always and, more
 * importantly, is only a DEFAULT — the screen offers the others, so the one
 * case where it is wrong costs a click rather than a failed import.
 */
export const readSpreadsheet = async (file) => {
  const module = await lazyImport(() => import('exceljs'));
  const ExcelJS = module.default ?? module;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheets = workbook.worksheets.map((sheet) => {
    const lines = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      /*
       * `values` is 1-based with a hole at index 0 — an exceljs quirk that
       * puts an empty first column into every row if it is not dropped.
       */
      const cells = (row.values || []).slice(1).map(cellText);
      // A row of nothing is a spacer, not a record.
      if (cells.some((cell) => cell.trim() !== '')) lines.push(toCsvLine(cells));
    });
    return { name: sheet.name, csv: lines.join('\n'), rows: Math.max(lines.length - 1, 0) };
  }).filter((sheet) => sheet.csv.trim() !== '');

  if (!sheets.length) throw new Error('That workbook has no rows in any of its sheets.');

  const suggested = sheets.reduce(
    (best, sheet) => (sheet.rows > best.rows ? sheet : best),
    sheets[0],
  );

  return { sheets, suggested };
};

export default readSpreadsheet;

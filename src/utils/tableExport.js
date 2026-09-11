/**
 * Exporting a table to CSV, Excel or PDF.
 *
 * ── Why not just serialise what is on screen ────────────────────────────────
 *
 * A column's `render` returns JSX — a badge, a button, a formatted amount
 * wrapped in a span. Feeding that to a spreadsheet gives "[object Object]", so
 * export never reads `render`. It reads, in order:
 *
 *   1. `column.exportValue(row)` — for columns that exist only as a render,
 *      or whose rendered form differs from the value worth exporting
 *   2. the raw field named by `column.accessor` / `column.key`
 *
 * A column can opt out entirely with `exportable: false`, which is what the
 * actions column and thumbnails want.
 *
 * ── The libraries are loaded on demand ──────────────────────────────────────
 *
 * exceljs and jspdf together are larger than the rest of this application.
 * They are dynamically imported inside the functions that need them, so they
 * are fetched the first time somebody exports and never by anyone who does
 * not. CSV needs no library at all and stays instant.
 */

/** Columns worth putting in a file, in display order. */
export const exportableColumns = (columns = []) => columns.filter(
  (column) => column.exportable !== false && (column.accessor || column.key || column.exportValue),
);

const headerOf = (column) => String(column.label ?? column.header ?? column.accessor ?? column.key ?? '');

/**
 * One cell, as a primitive.
 *
 * Dates become ISO strings and objects become JSON rather than
 * "[object Object]": a nested value is rare in these tables, and showing it is
 * more useful than hiding a bug behind a placeholder.
 */
export const cellValue = (row, column) => {
  if (typeof column.exportValue === 'function') return column.exportValue(row);

  const value = row?.[column.accessor ?? column.key];
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
};

const matrix = (rows, columns) => rows.map((row) => columns.map((column) => cellValue(row, column)));

/** Triggers the browser download for a generated file. */
const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: revoking synchronously can cancel the download
  // in some browsers before it has started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * CSV escaping.
 *
 * A value containing a comma, a quote or a newline has to be quoted with its
 * quotes doubled, or one address field with a comma in it silently shifts
 * every following column — the kind of corruption nobody notices until the
 * figures are already in a report.
 */
const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const exportCsv = ({ rows, columns, filename }) => {
  const cols = exportableColumns(columns);
  const lines = [
    cols.map((c) => csvCell(headerOf(c))).join(','),
    ...matrix(rows, cols).map((line) => line.map(csvCell).join(',')),
  ];
  /**
   * The BOM is not decoration.
   *
   * Without it Excel reads a UTF-8 CSV as the local 8-bit codepage, and every
   * ₦ and every accented name arrives mangled.
   */
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  download(blob, `${filename}.csv`);
};

export const exportExcel = async ({ rows, columns, filename, title }) => {
  const ExcelJS = (await import('exceljs')).default ?? (await import('exceljs'));
  const cols = exportableColumns(columns);

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  // Sheet names cannot exceed 31 characters or contain []:*?/\ — Excel refuses
  // to open the file rather than correcting it.
  const sheet = workbook.addWorksheet(String(title || 'Report').replace(/[[\]:*?/\\]/g, ' ').slice(0, 31));

  sheet.columns = cols.map((column) => ({
    header: headerOf(column),
    key: String(column.accessor ?? column.key ?? headerOf(column)),
    width: Math.min(40, Math.max(12, headerOf(column).length + 4)),
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: 'middle' };

  matrix(rows, cols).forEach((line) => sheet.addRow(line));
  // Header stays visible while scrolling a long report.
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length || 1 } };

  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  );
};

export const exportPdf = async ({ rows, columns, filename, title, subtitle }) => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const cols = exportableColumns(columns);

  // Landscape: these tables are wider than they are tall, and portrait forces
  // a font size nobody can read.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(14);
  doc.text(String(title || 'Report'), 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(subtitle || `Generated ${new Date().toLocaleString()}`, 40, 56);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 72,
    head: [cols.map(headerOf)],
    body: matrix(rows, cols).map((line) => line.map((v) => String(v ?? ''))),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
    // Page numbers, so a printed report cannot be silently reordered.
    didDrawPage: (data) => {
      const page = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text(
        `Page ${page}`,
        data.settings.margin.left,
        doc.internal.pageSize.getHeight() - 20,
      );
    },
  });

  doc.save(`${filename}.pdf`);
};

/** Dispatches to the right exporter. Unknown formats are a programming error. */
export const exportTable = async ({ format, ...options }) => {
  if (format === 'csv') return exportCsv(options);
  if (format === 'excel' || format === 'xlsx') return exportExcel(options);
  if (format === 'pdf') return exportPdf(options);
  throw new Error(`Unknown export format: ${format}`);
};

export default exportTable;

import { lazyImport } from './lazyImport';
/**
 * Exporting the dashboard as a real report.
 *
 * ── What was wrong with the old one ─────────────────────────────────────────
 *
 * "Export" called window.print(), which prints the VISIBLE SCREEN. Whatever
 * was scrolled out of view, collapsed, or hidden behind a widget toggle simply
 * was not in the output; charts came out as whatever the screen renderer
 * produced at screen resolution; and the page furniture — sidebar, buttons,
 * the search box — came with it. It produced a picture of a web page, not a
 * report someone can file or send to an accountant.
 *
 * This builds the document from the dashboard's DATA instead. Every figure the
 * dashboard computed is included whether or not its widget happens to be
 * visible, laid out as tables, paginated properly, and carrying the period it
 * covers so the numbers can be interpreted months later.
 *
 * The libraries are imported dynamically — see tableExport.js for why.
 */

const money = (value, symbol = '') => {
  const n = Number(value) || 0;
  return `${symbol}${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const percent = (value) => `${(Number(value) || 0).toFixed(1)}%`;
const count = (value) => String(Number(value) || 0);

/** Turns { label: count } into rows, biggest first. */
const fromMap = (map) => Object.entries(map || {})
  .map(([label, value]) => [String(label).toUpperCase(), count(value)])
  .sort((a, b) => Number(b[1]) - Number(a[1]));

/**
 * The report's sections.
 *
 * Data-driven rather than a sequence of draw calls so that a section with
 * nothing in it can be dropped cleanly — an empty "Top Due Payments" heading
 * above a blank space reads like a rendering fault rather than good news.
 */
export const buildSections = (data, symbol) => {
  const sections = [];

  sections.push({
    title: 'Summary',
    head: ['Measure', 'Value'],
    body: [
      ['Properties', count(data.totalProperties)],
      ['Clients', count(data.totalClients)],
      ['Realtors', count(data.totalRealtors)],
      ['Staff', count(data.totalStaff)],
      ['Invoices', count(data.totalInvoices)],
      ['Sales in period', count(data.totalSales)],
      ['Referrals', count(data.totalReferrals)],
    ],
  });

  sections.push({
    title: 'Finance',
    head: ['Measure', 'Amount'],
    body: [
      ['Total invoiced', money(data.totalInvoiceAmount, symbol)],
      ['Collected', money(data.totalPaid, symbol)],
      ['Outstanding', money(data.outstanding, symbol)],
      ['Overdue', money(data.totalDue, symbol)],
      ['Revenue (all time)', money(data.totalRevenue, symbol)],
      ['Revenue (period)', money(data.rangedRevenue, symbol)],
      ['Revenue (year to date)', money(data.ytdRevenue, symbol)],
      ['Collection rate', percent(data.collectionRate)],
      ['Overdue invoices', count(data.overdueCount)],
      ['Oldest unpaid (days)', count(data.oldestUnpaidDays)],
    ],
  });

  if (data.weekComparison?.days?.length) {
    sections.push({
      title: 'This week vs last week',
      head: ['Day', 'Last week', 'This week'],
      /*
       * A day that has not happened is left blank rather than written as zero.
       * A spreadsheet outlives the screen it came from, and a reader months
       * later cannot tell "no sales on Thursday" from "Thursday had not
       * happened when this was exported".
       */
      body: data.weekComparison.days.map((d) => [
        d.label,
        money(d.previous, symbol),
        d.future ? '—' : money(d.current, symbol),
      ]),
    });
  }

  const propertyRows = fromMap(data.propertyStatusMap);
  if (propertyRows.length) {
    sections.push({ title: 'Properties by status', head: ['Status', 'Count'], body: propertyRows });
  }

  const leadRows = fromMap(data.leadStatusMap);
  if (leadRows.length) {
    sections.push({
      title: 'Leads by status',
      head: ['Status', 'Count'],
      body: [
        ...leadRows,
        ['CONVERSION RATE', percent(data.conversionRate)],
      ],
    });
  }

  if (data.duePayments?.length) {
    sections.push({
      title: 'Top due payments',
      head: ['Invoice', 'Client', 'Amount', 'Due date', 'Days left'],
      body: data.duePayments.slice(0, 25).map((row) => [
        row.invoice_id ?? row.reference ?? '',
        row.client_name ?? row.client ?? '',
        money(row.amount ?? row.balance, symbol),
        row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '',
        row.daysLeft === undefined || row.daysLeft === null ? '' : String(row.daysLeft),
      ]),
    });
  }

  if (data.realtorLeaderboard?.length) {
    sections.push({
      title: 'Realtor leaderboard',
      head: ['Realtor', 'Sales', 'Value'],
      body: data.realtorLeaderboard.slice(0, 25).map((row) => [
        row.name ?? row.realtor_name ?? '',
        count(row.sales ?? row.deals ?? row.count),
        money(row.amount ?? row.value ?? row.total, symbol),
      ]),
    });
  }

  sections.push({
    title: 'Support',
    head: ['Measure', 'Value'],
    body: [
      ['Open tickets', count(data.openTickets)],
      ['Closed tickets', count(data.closedTickets)],
      ['Escalated tickets', count(data.escalatedTickets)],
      ['Total tickets', count(data.totalTickets)],
      ['Average resolution (hours)', String(Number(data.avgResolutionHours || 0).toFixed(1))],
    ],
  });

  return sections;
};

export const exportDashboardPdf = async ({
  data, symbol = '', title = 'Dashboard report', period = '', onProgress = () => {},
}) => {
  onProgress({ stage: 'Loading the PDF engine', percent: 10 });
  const { jsPDF } = await lazyImport(() => import('jspdf'));
  const autoTable = (await lazyImport(() => import('jspdf-autotable'))).default;
  onProgress({ stage: 'Laying out the report', percent: 55 });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text(title, 40, 50);
  doc.setFontSize(10);
  doc.setTextColor(110);
  if (period) doc.text(`Period: ${period}`, 40, 68);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, period ? 82 : 68);
  doc.setTextColor(0);

  let cursor = period ? 100 : 86;

  buildSections(data || {}, symbol).forEach((section) => {
    autoTable(doc, {
      startY: cursor,
      /**
       * Two header rows: a full-width banner carrying the section name, then
       * the column labels.
       *
       * The name is part of the TABLE rather than text drawn above it, so a
       * section cannot end up with its heading at the foot of one page and its
       * figures at the top of the next — and the banner repeats when a long
       * section runs over, which is what makes page three of a report
       * readable on its own.
       */
      head: [
        [{
          content: section.title,
          colSpan: section.head.length,
          styles: { halign: 'left', fillColor: [15, 23, 42], textColor: 255, fontSize: 11 },
        }],
        section.head,
      ],
      body: section.body,
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 40, right: 40 },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.text(
          `Page ${doc.internal.getNumberOfPages()}`,
          pageWidth - 40,
          doc.internal.pageSize.getHeight() - 20,
          { align: 'right' },
        );
        doc.setTextColor(0);
      },
    });
    cursor = (doc.lastAutoTable?.finalY ?? cursor) + 24;
  });

  onProgress({ stage: 'Saving', percent: 100 });
  doc.save(`${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
};

/** The same report as a spreadsheet, one sheet per section. */
export const exportDashboardExcel = async ({
  data, symbol = '', title = 'Dashboard report', onProgress = () => {},
}) => {
  onProgress({ stage: 'Loading the spreadsheet engine', percent: 10 });
  const module = await lazyImport(() => import('exceljs'));
  const ExcelJS = module.default ?? module;
  onProgress({ stage: 'Building the workbook', percent: 55 });
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  buildSections(data || {}, symbol).forEach((section) => {
    const sheet = workbook.addWorksheet(section.title.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31));
    sheet.addRow(section.head).font = { bold: true };
    section.body.forEach((row) => sheet.addRow(row));
    sheet.columns.forEach((column) => { column.width = 26; });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  });

  onProgress({ stage: 'Writing the file', percent: 85 });
  const buffer = await workbook.xlsx.writeBuffer();
  onProgress({ stage: 'Saving', percent: 100 });
  const url = URL.createObjectURL(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default exportDashboardPdf;

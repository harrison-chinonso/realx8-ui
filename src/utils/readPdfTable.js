import { lazyImport } from './lazyImport';

/**
 * A table out of a PDF statement.
 *
 * ── What this can and cannot do, stated up front ────────────────────────────
 *
 * A PDF is a page layout, not a table. There are no rows and no columns in the
 * file — only glyphs at coordinates. Everything below is the reconstruction of
 * a table that a human eye does instantly and software does by inference:
 * items on roughly the same baseline are a row, items in roughly the same
 * vertical band are a column.
 *
 * That inference is good but it is not certain, and it is not certain in a way
 * that MATTERS, because a misread statement balances and is wrong. So:
 *
 *   - nothing here writes anything. It produces CSV text, which goes through
 *     the same preview, the same column mapping and the same duplicate check
 *     as a file the bank exported, and a person confirms it before it posts.
 *   - where the page has no table shape at all, it says so rather than
 *     returning three rows of page furniture.
 *
 * It will read most Nigerian bank statements. It will not read all of them,
 * and the ones it reads badly are worth sending to us so the inference can be
 * taught about that template.
 *
 * ── Passwords ───────────────────────────────────────────────────────────────
 *
 * Statements are routinely emailed encrypted. pdf.js asks for the password by
 * throwing, which is caught and surfaced so the caller can ask and retry. The
 * password is used to open the document and is never sent anywhere: the whole
 * of this runs in the browser.
 */

/** Thrown when the document needs a password, or the one given was wrong. */
export class PdfPasswordRequired extends Error {
  constructor(wrong = false) {
    super(wrong ? 'That password did not open the file.' : 'This PDF needs a password.');
    this.name = 'PdfPasswordRequired';
    this.wrong = wrong;
  }
}

/** How far apart two items can sit vertically and still be the same line. */
const LINE_TOLERANCE = 3;

const loadPdfJs = async () => {
  const pdfjs = await lazyImport(() => import('pdfjs-dist'));
  /*
   * The worker is fetched as a URL rather than bundled: pdf.js runs its
   * parser off the main thread, and without this it silently falls back to
   * doing it ON the main thread, which locks the tab for seconds on a long
   * statement.
   */
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
};

/** Every text item on every page, with where it sits. */
const itemsOf = async (pdf) => {
  const items = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
     
    const page = await pdf.getPage(pageNumber);
     
    const content = await page.getTextContent();
    content.items.forEach((item) => {
      const text = String(item.str || '').trim();
      if (!text) return;
      const [, , , , x, y] = item.transform;
      items.push({
        text,
        x,
        /*
         * Pages stack downwards but PDF y grows upwards, so the page number is
         * folded in to keep a document-wide ordering. Without it page two's
         * first line sorts above page one's last.
         */
        y: pageNumber * 100000 - y,
        width: item.width || 0,
        page: pageNumber,
      });
    });
  }
  return items;
};

/** Items grouped into lines by their baseline. */
const linesOf = (items) => {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  let current = null;

  sorted.forEach((item) => {
    if (!current || Math.abs(item.y - current.y) > LINE_TOLERANCE) {
      current = { y: item.y, page: item.page, items: [item] };
      lines.push(current);
    } else {
      current.items.push(item);
    }
  });

  lines.forEach((line) => line.items.sort((a, b) => a.x - b.x));
  return lines;
};
/**
 * One item per word, with where each word sits.
 *
 * ── Why an item is not a cell ───────────────────────────────────────────────
 *
 * pdf.js hands back runs of text, and where two columns are set close
 * together it hands back BOTH of them as one run: "- 1,244,873.08" is the
 * outflow column's dash and the inflow column's amount, and
 * "03 Aug 2026 03 Aug 2026 110059260803..." is two date columns and the start
 * of a description. No amount of clustering can separate what arrives glued
 * together, which is how an inflow and a running balance came to sit in one
 * cell — "1,244,873.08 5,532,276.48" — with the row then reading as no
 * movement at all and the totals coming out as the bank charges alone.
 *
 * So every run is cut back into words and each word placed on its own. Where
 * the pieces land in the same column they are joined up again, so cutting too
 * finely costs nothing.
 *
 * The two edges that are MEASURED rather than estimated — the start of the
 * first piece and the end of the last — are marked, because a column is only
 * defined from edges we actually know. The pieces in between are apportioned
 * by character count, which is close enough to place them and not close
 * enough to define anything.
 */
const splitItems = (items) => items.flatMap((item) => {
  const text = String(item.text);
  if (!/\s/.test(text.trim()) || !item.width) {
    return [{ ...item, exactLeft: true, exactRight: true }];
  }
  const pieces = [];
  let offset = 0;
  text.split(/(\s+)/).forEach((chunk) => {
    if (chunk && !/^\s+$/.test(chunk)) {
      pieces.push({ text: chunk, start: offset, end: offset + chunk.length });
    }
    offset += chunk.length;
  });
  if (pieces.length <= 1) return [{ ...item, exactLeft: true, exactRight: true }];

  const total = text.length;
  return pieces.map((piece, index) => {
    const from = index === 0 ? item.x : item.x + (item.width * piece.start) / total;
    const to = index === pieces.length - 1
      ? item.x + item.width
      : item.x + (item.width * piece.end) / total;
    return {
      ...item,
      text: piece.text,
      x: from,
      width: Math.max(to - from, 0.5),
      exactLeft: index === 0,
      exactRight: index === pieces.length - 1,
    };
  });
});

/** Header words gathered back into headings by the gaps between them. */
const headerCells = (line) => {
  const cells = [];
  line.items.forEach((item) => {
    const last = cells[cells.length - 1];
    const gap = last ? item.x - (last.x + last.width) : Infinity;
    if (last && gap <= 8) {
      last.width = item.x + item.width - last.x;
      last.text = `${last.text} ${item.text}`;
    } else {
      cells.push({ ...item });
    }
  });
  return cells;
};

/**
 * The foot of a statement: the totals line, the closing balance, the page
 * footer. Not transactions, and — the part that matters here — not evidence
 * of where the columns are either. A totals line is set in its own way, and
 * letting it vote opened a seventh column that every real row left empty.
 */
const SUMMARY_WORDS = /\b(total|totals|summary|closing balance|opening balance|end of statement|generated|printed|page \d|continued)\b/i;

const isSummaryLine = (line) => SUMMARY_WORDS.test(line.items.map((item) => item.text).join(' '));

/**
 * A figure printed as money: grouped in thousands, or carrying kobo.
 *
 * Stricter than isFigure, and used only where a loose answer does damage —
 * deciding where the columns ARE. Once the words are cut apart, "2026" out of
 * a date and "03" out of a day are figures by any loose test, and they
 * cluster into columns of their own that swallow the real ones.
 */
const isMoney = (text) => {
  const bare = String(text).replace(/[()₦$£€]|\b(NGN|USD|GBP|EUR|CR|DR)\b/gi, '').trim();
  if (!/^[-\u2212]?[\d,.']+[-\u2212]?$/.test(bare)) return false;
  if (!/[,.]/.test(bare)) return false;
  return /\d/.test(bare);
};

/**
 * A cell that is an AMOUNT — not merely a cell with digits in it.
 *
 * ── Why this cannot be "does it contain numbers" ────────────────────────────
 *
 * Text is set from the left and figures from the right, and everything below
 * turns on telling the two apart. But a bank's narration OPENS with a
 * thirty-digit transaction reference — "110059260803172345612201921111 3LINE
 * FINANCE EXPENSE OKOTA" — and an account number in the middle of one is ten
 * digits. Counted as figures, those references join the clustering that
 * decides where the money columns are, and they drag it about: on a statement
 * of theirs an inflow column and a balance column were read as a single
 * column, and every inflow vanished.
 *
 * So: grouped or decimal is money however long it is; a bare run of digits is
 * money only while it is short enough to be an amount rather than a reference.
 */
const isFigure = (text) => {
  const bare = String(text).replace(/[()₦$£€]|\b(NGN|USD|GBP|EUR|CR|DR)\b/gi, '').trim();
  if (!/^[-\u2212]?[\d,.']+[-\u2212]?$/.test(bare)) return false;
  const digits = bare.replace(/\D/g, '');
  if (!digits) return false;
  return /[,.]/.test(bare) ? digits.length <= 15 : digits.length <= 7;
};

/**
 * How far apart two RIGHT edges can sit and still be the same column of
 * figures. Tight, because right alignment is exact: a column of amounts ends
 * on the same point to within a rounding error.
 */
const RIGHT_TOLERANCE = 6;
/** The same for LEFT edges, where a little more drift is normal. */
const LEFT_TOLERANCE = 12;

const clusterOf = (edges, tolerance) => {
  const clusters = [];
  [...edges].sort((a, b) => a.at - b.at).forEach((edge) => {
    const last = clusters[clusters.length - 1];
    if (last && edge.at - last.at <= tolerance) {
      last.at = (last.at * last.count + edge.at) / (last.count + 1);
      last.count += 1;
      last.from = Math.min(last.from, edge.from);
      last.to = Math.max(last.to, edge.to);
    } else {
      clusters.push({ at: edge.at, count: 1, from: edge.from, to: edge.to });
    }
  });
  return clusters;
};

/**
 * Where the columns are.
 *
 * ── Money from the figures, words from the heading ──────────────────────────
 *
 * The two halves of a statement need different evidence.
 *
 * A money column is found from its figures, clustered on their RIGHT edge:
 * amounts are right-aligned, so their right edges agree to a rounding error
 * while their left edges are scattered across forty points by the width of
 * each number. Clustering left edges — the first version — dropped those
 * columns entirely, and their figures fell into the column before them: an
 * inflow cell holding "1,244,873.08 5,532,276.48", an amount and the running
 * balance run together.
 *
 * A column of words cannot be found that way at all. Every word of a narration
 * is a separate item with its own left edge, so clustering them invents a
 * column wherever narrations happen to break — and a phantom column sitting
 * over the money is what later swallowed real columns whole. The headings say
 * where those columns are; the rows below are then used only to CONFIRM each
 * one, so a heading that describes nothing is dropped.
 */
const columnsOf = (body, headerLine) => {
  const figureEdges = [];
  let moneyLines = 0;
  body.forEach((line) => {
    let carries = false;
    line.items.forEach((item) => {
      if (!isMoney(item.text)) return;
      carries = true;
      /* Only an edge we measured. See splitItems. */
      if (item.exactRight !== false) {
        figureEdges.push({ at: item.x + item.width, from: item.x, to: item.x + item.width });
      }
    });
    if (carries) moneyLines += 1;
  });
  /*
   * A share of the ROWS carrying money, not of the lines: a wrapped narration
   * puts three lines on the page for one transaction, and counting those made
   * the bar high enough to lose an inflow column with four entries in it.
   */
  const threshold = Math.max(2, Math.floor(moneyLines * 0.15));

  const figureColumns = clusterOf(figureEdges, RIGHT_TOLERANCE)
    .filter((cluster) => cluster.count >= threshold)
    .map((cluster) => ({ ...cluster, figure: true }));

  /*
   * ── A column that never once stands alone ─────────────────────────────────
   *
   * Columns are defined from measured edges, because an estimated one is only
   * good to a few points. But a deposit column set tight against the balance
   * is handed back GLUED to it on every row — "1,244,873.08 5,532,276.48" as
   * one run — so it has no measured edge anywhere in the file and simply does
   * not exist, and its money falls into the narration.
   *
   * So the money that landed on no column at all gets a second, coarser pass
   * of its own. It costs nothing where the first pass already worked: there
   * is nothing left over to cluster.
   */
  const settled = (at, columns) => {
    let nearest = Infinity;
    let anchor = null;
    columns.forEach((column) => {
      const distance = Math.abs(at - column.at);
      if (distance < nearest) { nearest = distance; anchor = column.at; }
    });
    let neighbour = Infinity;
    columns.forEach((column) => {
      if (column.at !== anchor) neighbour = Math.min(neighbour, Math.abs(column.at - anchor));
    });
    return nearest <= Math.min(Math.max(RIGHT_TOLERANCE, neighbour * 0.4), 40);
  };
  const stranded = [];
  body.forEach((line) => line.items.forEach((item) => {
    if (!isMoney(item.text) || item.exactRight !== false) return;
    const at = item.x + item.width;
    if (!figureColumns.length || !settled(at, figureColumns)) {
      stranded.push({ at, from: item.x, to: at });
    }
  }));
  clusterOf(stranded, RIGHT_TOLERANCE * 2)
    .filter((cluster) => cluster.count >= threshold)
    .forEach((cluster) => figureColumns.push({ ...cluster, figure: true }));
  figureColumns.sort((a, b) => a.at - b.at);

  const firstFigure = figureColumns.length
    ? Math.min(...figureColumns.map((column) => column.from))
    : Infinity;

  const starts = [];
  body.forEach((line) => line.items.forEach((item) => starts.push(item.x)));
  const confirmed = (at) => starts.filter(
    (x) => Math.abs(x - at) <= LEFT_TOLERANCE,
  ).length >= threshold;

  let textColumns = [];
  if (headerLine) {
    textColumns = headerCells(headerLine)
      .filter((item) => item.x + item.width <= firstFigure - 2)
      .map((item) => ({
        at: item.x, from: item.x, to: item.x + item.width, count: 0, figure: false,
      }))
      .filter((column) => confirmed(column.at));
  }
  /* No heading to go on: fall back to clustering the words after all. */
  if (!textColumns.length) {
    textColumns = clusterOf(
      starts.filter((x) => x < firstFigure).map((x) => ({ at: x, from: x, to: x })),
      LEFT_TOLERANCE,
    ).filter((cluster) => cluster.count >= threshold)
      .map((cluster) => ({ ...cluster, figure: false }));
  }

  return [...textColumns, ...figureColumns].sort((a, b) => a.from - b.from);
};

/**
 * Which column an item belongs to.
 *
 * Figures go to the money column they END nearest; words go to the column of
 * words they START in. A word that genuinely sits over a money column — the
 * heading "OUTFLOW", or "B/F" written in the inflow column — belongs to that
 * column; a narration merely brushing its edge does not, which is the
 * difference between a heading and a long description.
 */
const columnAt = (item, columns) => {
  const figureColumns = columns.filter((column) => column.figure);
  if (!figureColumns.length) return 0;

  /*
   * `byEdge` for figures, overlap for words — and for figures it has to be
   * the edge ALONE. A wide amount in a narrow column reaches back across the
   * column before it, so scoring by overlap hands "2,000,000.00" to the
   * outflow column when its right edge is plainly on the inflow's.
   */
  const nearestFigure = (byEdge) => {
    let best = columns.indexOf(figureColumns[0]);
    let bestScore = -Infinity;
    figureColumns.forEach((column) => {
      const overlap = Math.min(item.x + item.width, column.to) - Math.max(item.x, column.from);
      const score = byEdge
        ? -Math.abs((item.x + item.width) - column.at)
        : (overlap > 0 ? overlap : -Math.abs((item.x + item.width) - column.at));
      if (score > bestScore) { bestScore = score; best = columns.indexOf(column); }
    });
    return best;
  };

  /*
   * ── Figures: matched on the edge they are aligned to ──────────────────────
   *
   * A figure belongs to the money column its RIGHT EDGE lands on, because
   * that is the only edge a right-aligned column shares. Judging it by how
   * much of the item overlaps the column's span looked equivalent and is not:
   * a column's span is only as wide as the widest figure SEEN IN IT, so on a
   * statement of bank charges — 5.46, 10.92, 50.00 — the inflow column was
   * twenty points wide, and "2,000,000.00" arriving in it overlapped less
   * than half its own width and was rejected. Those figures then fell into
   * the description: "...3lineltdPH12026 1,244,873.08 5,532,276.48" in one
   * cell, the row read as no movement at all, and the totals came out as the
   * small charges alone.
   */
  const right = item.x + item.width;
  /*
   * How far from a column's edge a figure may land and still belong to it: a
   * share of the distance to the next money column, never less than the
   * measuring tolerance and never more than 40pt. A fixed tolerance was both
   * too tight and too loose — too tight for an amount wider than its own
   * column, which hangs a few points past where the small figures end, and
   * too loose to keep the last word of a narration out.
   */
  let nearestAt = null;
  let nearestGap = Infinity;
  figureColumns.forEach((column) => {
    const distance = Math.abs(right - column.at);
    if (distance < nearestGap) { nearestGap = distance; nearestAt = column.at; }
  });
  let neighbour = Infinity;
  figureColumns.forEach((column) => {
    if (column.at === nearestAt) return;
    neighbour = Math.min(neighbour, Math.abs(column.at - nearestAt));
  });
  const aligned = nearestGap <= Math.min(Math.max(RIGHT_TOLERANCE, neighbour * 0.4), 40);

  if (isFigure(item.text)) {
    /*
     * ...and a figure that lands on NO column's edge is not an amount at all:
     * it is the "072026" or "PHASE 2" a narration happens to end with.
     */
    if (aligned) return nearestFigure(true);
  } else {
    /*
     * Words go by overlap, which is what puts the heading "OUTFLOW" — set
     * left over its own figures — and a "B/F" written in the inflow column
     * where they belong, while leaving a narration that merely brushes the
     * edge of a money column in the narration.
     */
    const width = Math.max(item.width, 1);
    const sits = figureColumns.some((column) => (
      Math.min(right, column.to) - Math.max(item.x, column.from) >= width * 0.5
    ));
    if (sits || aligned) return nearestFigure(false);
  }

  let best = 0;
  let bestAt = -Infinity;
  columns.forEach((column, index) => {
    if (column.figure) return;
    if (column.at <= item.x + LEFT_TOLERANCE && column.at > bestAt) {
      bestAt = column.at; best = index;
    }
  });
  return best;
};

const toCsvCell = (text) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** The words a bank statement's column headings are made of. */
const HEADING_WORDS = [
  'date', 'value', 'posting', 'trans', 'transaction',
  'narration', 'description', 'details', 'particulars', 'remarks', 'memo',
  'reference', 'ref',
  'debit', 'credit', 'withdrawal', 'deposit', 'lodgement', 'amount',
  'money', 'balance', 'dr', 'cr', 'inflow', 'outflow',
];

/**
 * Which line is the header.
 *
 * ── Why this cannot be "the first line with enough cells" ───────────────────
 *
 * That was the first version, and it is wrong on real statements. A bank's
 * letterhead — account name, account number, branch, the statement period —
 * sits in its own little grid at the top of page one and clusters into three
 * or four columns exactly like a table does. Taking it as the header means
 * every heading is nonsense, every column maps to nothing, and every data row
 * afterwards fails for the same reason. Which is precisely what "no amount on
 * this row", thirteen times, looks like.
 *
 * So the candidate lines are SCORED on how many of their cells read like
 * column headings, and the best one wins. Everything above it is preamble and
 * is dropped.
 */
/** How much a line reads like a row of column headings. */
const headingScore = (line) => line.items.reduce((total, item) => {
  const text = item.text.toLowerCase();
  return total + (HEADING_WORDS.some((word) => text.includes(word)) ? 1 : 0);
}, 0);

/** A line that reads like a transaction: a date on it, and an amount. */
const DATE_SHAPES = [
  /\b\d{1,2}[-/ ][A-Za-z]{3,9}[-/ ]\d{2,4}\b/,
  /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/,
  /\b\d{4}-\d{2}-\d{2}\b/,
];

const looksLikeTransaction = (line) => {
  const text = line.items.map((item) => item.text).join(' ');
  return DATE_SHAPES.some((shape) => shape.test(text))
    && line.items.some((item) => isMoney(item.text));
};

const headerIndexOf = (lines) => {
  const score = headingScore;

  /*
   * ── Which TABLE, not merely which line ────────────────────────────────────
   *
   * A statement often opens with a table that is not the transactions: a
   * summary of every account held — "Account No, Product Name, Opening
   * Balance, Debits, Credits, Closing Balance" — and after it a chart of
   * channel usage with its own headings. Those are made of the same words as
   * a real heading and score at least as well, so "the best-scoring heading
   * near the top" picked the summary: four account totals and a chart legend
   * read as the month's transactions, and the transactions themselves — 58
   * rows further down — never looked at.
   *
   * Each candidate heading is therefore judged by what lies UNDER it, as far
   * as the next candidate: how many of those lines carry both a date and an
   * amount. The transactions win that by a mile, wherever they start, and
   * there is no window to fall outside of any more.
   */
  const candidates = [];
  lines.forEach((line, index) => { if (score(line) >= 2) candidates.push(index); });
  if (!candidates.length) return -1;

  let best = -1;
  let bestRows = -1;
  candidates.forEach((at, which) => {
    const until = which + 1 < candidates.length ? candidates[which + 1] : lines.length;
    let rows = 0;
    for (let i = at + 1; i < until; i += 1) {
      if (looksLikeTransaction(lines[i])) rows += 1;
    }
    // Strictly better, so the FIRST of two equally good headings wins — which
    // is the real one rather than its repeat at the top of page two.
    if (rows > bestRows) { bestRows = rows; best = at; }
  });

  /*
   * Nothing under any heading looks like a transaction — a statement of
   * charges with no dates, say. Then the best-scoring heading near the top is
   * all there is to go on, which is where this started.
   */
  if (bestRows <= 0) {
    let fallback = -1;
    let bestScore = 0;
    lines.slice(0, 25).forEach((line, index) => {
      const value = score(line);
      if (value >= 2 && value > bestScore) { bestScore = value; fallback = index; }
    });
    return fallback;
  }
  return best;
};

/**
 * Read a PDF into CSV text.
 *
 * @returns {{ csv, rows, columns, pages, confidence }}
 * @throws  PdfPasswordRequired where it is encrypted.
 */
export const readPdfTable = async (file, { password } = {}) => {
  const pdfjs = await loadPdfJs();

  let pdf;
  try {
    pdf = await pdfjs.getDocument({
      data: await file.arrayBuffer(),
      password: password || undefined,
    }).promise;
  } catch (error) {
    if (error?.name === 'PasswordException') {
      // code 1 is "needs one", 2 is "the one given was wrong".
      throw new PdfPasswordRequired(error.code === 2);
    }
    throw new Error('That PDF could not be opened. It may be damaged.');
  }

  const items = await itemsOf(pdf);
  if (!items.length) {
    throw new Error(
      'That PDF has no text in it — it is probably a scan. A scanned statement cannot be read; '
      + 'download the CSV or Excel version from your bank instead.',
    );
  }

  /* Runs cut back into words before anything is inferred — see splitItems. */
  const lines = linesOf(splitItems(items));

  /*
   * A table needs lines with several cells on them. One- and two-item lines
   * are the letterhead, the address, the page footer — and a document made
   * only of those has no table in it, which is worth saying rather than
   * returning the address as data.
   */
  const tabular = lines.filter((line) => line.items.length >= 3);
  if (tabular.length < 2) {
    throw new Error(
      'No table could be found in that PDF. It may be a summary rather than a list of '
      + 'transactions — the CSV or Excel export from your bank will import cleanly.',
    );
  }

  /*
   * Drop the letterhead above the header row. Where no line reads like a
   * header, everything is kept and the screen's preview shows what came out —
   * better than guessing which line to throw away.
   */
  const headerAt = headerIndexOf(tabular);
  const headerLine = headerAt >= 0 ? tabular[headerAt] : null;

  /*
   * The columns are worked out from the TRANSACTIONS, not from the header.
   *
   * A heading is one line and is not aligned to the figures under it — banks
   * set "OUTFLOW" flush left over a column of right-aligned amounts as often
   * as not. Letting it vote on where the column is drags the column sideways;
   * the rows below agree with each other far more than the heading agrees
   * with them.
   */
  const after = headerLine ? lines.slice(lines.indexOf(headerLine) + 1) : tabular;
  /*
   * ── What the columns are worked out FROM ──────────────────────────────────
   *
   * The transaction rows, and nothing else. A personal statement is not one
   * table: between each account's transactions sit a disclaimer, a phone
   * number, a page footer and then the next account's letterhead — "Account
   * Number:", "Product Name:", "Opening Balance:" — and every one of those
   * lines has words at its own x positions. Letting them vote invented a
   * column out of the "Debits" HEADING (which sits left of its own figures)
   * and shifted every amount one column across, so a charge was read as a
   * credit.
   *
   * A line with a date and an amount on it is a transaction. Where too few
   * lines look like that to be sure, everything but the statement's foot is
   * used, which is where this started.
   */
  const dated = after.filter((line) => line.items.length >= 3 && looksLikeTransaction(line));
  const columns = columnsOf(
    dated.length >= 3
      ? dated
      : after.filter((line) => line.items.length >= 3 && !isSummaryLine(line)),
    headerLine,
  );
  if (columns.length < 3) {
    throw new Error('That PDF does not have columns this can read. Use the CSV or Excel export.');
  }

  const cellsOf = (line) => {
    const cells = new Array(columns.length).fill('');
    line.items.forEach((item) => {
      const index = columnAt(item, columns);
      // Text that wraps inside a cell is joined rather than overwriting.
      cells[index] = cells[index] ? `${cells[index]} ${item.text}` : item.text;
    });
    return cells;
  };

  /*
   * How far apart two consecutive lines normally sit. Used to tell a wrapped
   * narration from a page footer: the first is one line below its row, the
   * second is at the bottom of the page.
   */
  const gaps = after.slice(1)
    .map((line, index) => line.y - after[index].y)
    .filter((gap) => gap > 0)
    .sort((a, b) => a - b);
  const spacing = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 12;

  /*
   * ── Rows, and the second half of a long narration ──────────────────────────
   *
   * A narration too long for its column wraps onto the line below, and that
   * line has one item on it: no date, no amount. The first version required
   * three items to count as a row, so those lines were dropped — silently
   * throwing away half of "TRF TO BUILDWELL CONSTRUCTION LTD | FOR SITE WORKS
   * PHASE 2" on a screen whose whole job is matching payments by narration.
   *
   * A line that does not start in the first column, sits directly under the
   * row above, and is not the header printed again on page two, belongs to
   * the row above.
   */
  const rows = [];
  let previous = null;
  /* The last line that became, or joined, a row — see below. */
  let lastKept = null;
  let dropped = 0;

  after.forEach((line) => {
    if (headingScore(line) >= 3) { previous = line; return; } // the header, again
    const cells = cellsOf(line);
    const startsRow = line.items.some((item) => columnAt(item, columns) === 0);
    const carriesMoney = line.items.some(
      (item) => isMoney(item.text) && columns[columnAt(item, columns)]?.figure,
    );
    const underneath = previous && line.y - previous.y <= spacing * 1.8;
    /*
     * A wrapped narration sits under its row, starts nowhere near the date
     * column, and stays INSIDE one column of words — a cell that ran on. The
     * last two conditions are what separate it from a disclaimer paragraph
     * set across the whole page, which was otherwise being folded into the
     * transaction above it: "...KELVIN OBI RENT PAYMENT discrepancies Access".
     * And it has to follow the row directly: a line two below, with page
     * furniture in between, belongs to neither.
     */
    const within = new Set(line.items.map((item) => columnAt(item, columns)));
    const oneCellWide = within.size === 1 && !columns[[...within][0]]?.figure;

    if (carriesMoney) {
      rows.push(cells);
      lastKept = line;
    } else if (!startsRow && oneCellWide && underneath && previous === lastKept && rows.length) {
      const into = rows[rows.length - 1];
      cells.forEach((cell, index) => {
        if (cell) into[index] = into[index] ? `${into[index]} ${cell}` : cell;
      });
      lastKept = line;
    } else {
      /* Page furniture. Counted, and reported, so nothing vanishes quietly. */
      dropped += 1;
    }
    previous = line;
  });

  if (headerLine) {
    /*
     * The headings, placed by COUNT where the count agrees.
     *
     * A heading is set left over figures that are set right, so "OUTFLOW"
     * need not sit over its own column at all — and placed by geometry it
     * lands in the description, leaving the money column with no name for the
     * import to recognise. Where there are as many headings as columns, the
     * fourth heading names the fourth column and no inference is needed.
     */
    const headings = headerCells(headerLine);
    rows.unshift(headings.length === columns.length
      ? headings.map((cell) => cell.text)
      : cellsOf(headerLine));
  }

  /*
   * Two figures in one cell means two columns were read as one — the fault
   * this reader had, and the one worth naming if it ever happens again rather
   * than leaving somebody to work it out from a refusal further down.
   */
  const doubled = rows.reduce((total, cells) => total + cells.filter(
    (cell) => /\d[\d,.]*\s+[\d,.]*\d/.test(cell) && isFigure(cell.replace(/\s+/g, ' ')),
  ).length, 0);

  const csv = rows.map((cells) => cells.map(toCsvCell).join(',')).join('\n');

  /*
   * How much of the grid actually got filled. A clean statement fills most of
   * it; a page of prose that happened to cluster into columns fills very
   * little. Reported so the screen can warn rather than pretend.
   */
  const filled = rows.reduce(
    (total, cells) => total + cells.filter((cell) => cell !== '').length, 0,
  );
  const confidence = filled / Math.max(rows.length * columns.length, 1);

  return {
    csv,
    rows: Math.max(rows.length - 1, 0),
    /* Cells that look like two columns run together — see above. */
    doubled,
    /* Lines that were not part of the table: disclaimers, footers, the next
       account's letterhead. Reported so the screen can say how many. */
    dropped,
    columns: columns.length,
    pages: pdf.numPages,
    confidence,
    /* Whether a header was recognised, so the screen can say if it was not. */
    headerFound: headerAt >= 0,
    /* What was thrown away above it, for the same reason. */
    skipped: headerAt > 0 ? headerAt : 0,
  };
};

export default readPdfTable;

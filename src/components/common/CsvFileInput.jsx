import { useId, useRef, useState } from 'react';
import Button from '../ui/Button';
import FieldMark from '../ui/FieldMark';
import { readSpreadsheet } from '../../utils/readSpreadsheet';

/**
 * A CSV or a spreadsheet, chosen as a file.
 *
 * ── Read in the browser, never uploaded ─────────────────────────────────────
 *
 * The file's text is posted; the file itself goes nowhere. A bank statement is
 * a list of somebody's transactions and a trial balance is what a company is
 * worth — parking either in a media bucket so a server can fetch it back would
 * leave a copy somewhere it was never needed, for the sake of a few hundred
 * numbers we extract and discard the rest of.
 *
 * This is the opposite decision from DocumentUpload beside it, and deliberately
 * so: an acknowledgement or an attestation IS the evidence, has to be stored,
 * and has to be shown again years later. A CSV is a delivery mechanism.
 *
 * ── Why there is no longer a box to paste into ──────────────────────────────
 *
 * There was, and it was wrong in the way that is hard to see. A textarea makes
 * a header row somebody's problem to preserve: text pasted out of a mail client
 * arrives with wrapped lines and smart quotes, and the import then fails on row
 * fourteen for reasons nobody can act on. Every one of these files exists as a
 * file — exported from a bank, from Sage, from a payroll bureau — so asking for
 * the file is asking for the thing that already exists.
 *
 * ── A workbook is read, not refused ─────────────────────────────────────────
 *
 * People reach for the .xlsx, because that is what the bank's website gave
 * them. It is converted to exactly the CSV they would have got by choosing
 * "Save as CSV", and handed to the same reader — so nothing downstream, on
 * either side of the network, learns that spreadsheets exist.
 *
 * The legacy binary .xls is the exception and is refused by name. It is a
 * different format wearing a similar extension, exceljs does not read it, and
 * a clear refusal beats a screen of errors from parsing it as text.
 *
 * ── What it shows back ──────────────────────────────────────────────────────
 *
 * The name, the size, the number of rows and the first lines of the file.
 * Without a textarea there is otherwise nothing to confirm the right file was
 * picked, and "it imported the wrong month" is a far more expensive mistake to
 * find later than to prevent here.
 */

/** Roughly how big, for somebody deciding whether this is the right file. */
const readableSize = (bytes) => {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Modern Office files are zips; the older .xls and .doc are OLE2 documents. */
const signatureOf = (text) => {
  const code = (index) => text.charCodeAt(index);
  if (code(0) === 0x50 && code(1) === 0x4B && code(2) === 0x03 && code(3) === 0x04) return 'zip';
  if (code(0) === 0xD0 && code(1) === 0xCF && code(2) === 0x11 && code(3) === 0xE0) return 'ole2';
  if (text.startsWith('%PDF')) return 'pdf';
  return 'text';
};

/**
 * What to do with a chosen file, by what it actually IS.
 *
 * By signature first and extension second, because a workbook saved as
 * "statement.csv" is a thing that happens and reading it as text produces a
 * screen of binary followed by an error for every row.
 */
const kindOf = (name, text) => {
  const signature = signatureOf(text);

  /*
   * A .docx and an .xlsx are BOTH zips, and so is a .pptx — the signature
   * says "Office file" and nothing more. So for a zip the extension decides,
   * and only for a zip: everywhere else the signature wins, because that is
   * what catches a workbook somebody renamed to .csv.
   *
   * The first version had this the other way round and read Word documents as
   * workbooks, failing with "could not be read" instead of saying what the
   * file was.
   */
  if (signature === 'zip') {
    if (/\.docx$/i.test(name)) return 'word';
    if (/\.pptx$/i.test(name)) return 'word';
    return 'workbook';
  }
  if (signature === 'ole2') return /\.docx?$/i.test(name) ? 'word' : 'legacy-excel';
  if (signature === 'pdf') return 'pdf';

  if (/\.(xlsx|numbers|ods)$/i.test(name)) return 'workbook';
  if (/\.xls$/i.test(name)) return 'legacy-excel';
  if (/\.pdf$/i.test(name)) return 'pdf';
  if (/\.docx?$/i.test(name)) return 'word';
  return 'text';
};

/**
 * What the picker will let somebody choose.
 *
 * Wider than what can be READ, deliberately — see the input below. The types
 * here are the ones the refusals speak about; anything else still lands on the
 * generic message rather than on a greyed-out row in a dialog.
 */
const ACCEPTED = [
  '.csv', '.txt', 'text/csv', 'text/plain',
  '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls', 'application/vnd.ms-excel',
  '.pdf', 'application/pdf',
  '.doc', '.docx',
  '.ods', '.numbers',
];

const REFUSALS = {
  'legacy-excel': (name) => `${name} is in the older Excel format, which cannot be read here. `
    + 'Open it and use "Save as" to produce an .xlsx or a CSV.',
  pdf: (name) => `${name} is a PDF, which cannot be read here yet. Whatever produced it — `
    + 'a bank, an accounting package — almost always offers the same thing as CSV or Excel '
    + 'beside the PDF. Choose that and it will import.',
  word: (name) => `${name} is a Word document. Use the CSV or Excel your bank or accounting `
    + 'package exports instead — a table pasted into Word loses the columns this needs.',
};

export default function CsvFileInput({
  value,
  onChange,
  label = 'The file',
  hint = '',
  required = true,
  onError,
}) {
  const input = useRef(null);
  const inputId = useId();
  const [file, setFile] = useState(null);
  const [problem, setProblem] = useState('');
  const [dragging, setDragging] = useState(false);
  // A large workbook takes a moment to parse; a drop zone that looks inert
  // while it does gets clicked again.
  const [reading, setReading] = useState(false);

  const take = async (chosen) => {
    if (!chosen) return;
    setProblem('');
    setReading(true);
    try {
      // Only the first bytes are needed to tell what this is, and a 40MB
      // workbook read as text before being recognised is a frozen tab.
      const signature = await chosen.slice(0, 8).text();
      const kind = kindOf(chosen.name, signature);

      if (REFUSALS[kind]) {
        const message = REFUSALS[kind](chosen.name);
        setProblem(message);
        onError?.(message);
        return;
      }

      let text;
      let workbook = null;
      if (kind === 'workbook') {
        workbook = await readSpreadsheet(chosen);
        text = workbook.suggested.csv;
      } else {
        text = await chosen.text();
      }

      if (!text.trim()) {
        const message = `${chosen.name} is empty.`;
        setProblem(message);
        onError?.(message);
        return;
      }

      setFile({
        name: chosen.name,
        size: chosen.size,
        /* Kept so the sheet can be swapped without re-reading the file. */
        sheets: workbook?.sheets ?? null,
        sheet: workbook?.suggested.name ?? null,
      });
      onChange(text);
    } catch (error) {
      const message = /workbook|sheet/i.test(error?.message || '')
        ? error.message
        : `${chosen.name} could not be read.`;
      setProblem(message);
      onError?.(message);
    } finally {
      setReading(false);
    }
  };

  /*
   * Read off `value`, not off what the file held when it was chosen — so
   * switching sheet updates the row count and the preview together rather
   * than leaving them describing the sheet before.
   */
  const lines = String(value || '').trim().split(/\r?\n/).filter(Boolean);
  const rowCount = Math.max(lines.length - 1, 0);
  const head = lines.slice(0, 3);

  const clear = () => {
    setFile(null);
    setProblem('');
    onChange('');
    // So re-picking the same file fires change again.
    if (input.current) input.current.value = '';
  };

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-slate-700">
        {label}
        <FieldMark required={required} />
      </span>

      <input
        ref={input}
        id={inputId}
        type="file"
        /*
          Everything we have an ANSWER for, not only what we can read.

          Narrowing this to CSV and Excel made the file picker grey a PDF out,
          so somebody with a PDF statement could not select it — and therefore
          never saw the message explaining where to get the CSV instead. A
          file that cannot be chosen teaches nothing; a file that is chosen and
          then explained teaches exactly one thing, once.

          Dropping a file has always bypassed `accept` and shown the message,
          so the two paths disagreed as well.
        */
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          // A cancelled dialog fires change with NO file. Treating that as a
          // selection would clear a file already chosen.
          if (chosen) take(chosen);
          event.target.value = '';
        }}
      />

      {!value && (
        /*
          Drag and drop as well as click, because a statement is usually
          already sitting in a downloads folder beside the browser window.
        */
        <div
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              input.current?.click();
            }
          }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            take(event.dataTransfer.files?.[0]);
          }}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors ${
            dragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
          }`}
        >
          <span className="text-sm font-medium text-slate-700">
            {reading ? 'Reading…' : 'Drop a CSV or Excel file here, or click to choose one'}
          </span>
          <span className="text-xs text-slate-500">
            {hint || 'Exported from your bank or accounting package'}
          </span>
        </div>
      )}

      {value && file && (
        /*
          What was actually read, not just that something was. Nothing else on
          the screen can tell somebody they picked last month's statement.
        */
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">
                {readableSize(file.size)} · {rowCount} row{rowCount === 1 ? '' : 's'} beneath the header
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => input.current?.click()}>
                Choose another
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={clear}>Remove</Button>
            </div>
          </div>
          {/*
            A workbook with more than one sheet is offered rather than guessed
            at. The default is the sheet with the most rows, which is right
            almost always — and where it is not, a cover sheet in front of the
            transactions costs a click instead of a failed import.
          */}
          {file.sheets && file.sheets.length > 1 && (
            <label className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-medium">Sheet</span>
              <select
                value={file.sheet}
                onChange={(event) => {
                  const picked = file.sheets.find((sheet) => sheet.name === event.target.value);
                  if (!picked) return;
                  setFile((current) => ({ ...current, sheet: picked.name }));
                  onChange(picked.csv);
                }}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                {file.sheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name} — {sheet.rows} row{sheet.rows === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>
          )}

          <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
            {head.join('\n')}
            {rowCount > 3 ? `\n… and ${rowCount - 3} more` : ''}
          </pre>
        </div>
      )}

      {problem && <p className="text-xs text-danger">{problem}</p>}
    </div>
  );
}

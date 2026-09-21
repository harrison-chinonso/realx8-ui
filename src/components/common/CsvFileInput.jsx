import { useRef, useState } from 'react';
import Button from '../ui/Button';
import FieldMark from '../ui/FieldMark';

/**
 * A CSV, from a file or pasted, as text.
 *
 * ── Read in the browser, never uploaded ─────────────────────────────────────
 *
 * The file's text is posted; the file itself goes nowhere. A bank statement is
 * a list of somebody's transactions and a trial balance is what a company is
 * worth — parking either in a media bucket so the server can fetch it back
 * would leave a copy sitting somewhere it was never needed, for the sake of
 * two hundred numbers we extract and discard the rest of.
 *
 * This is the opposite decision from DocumentUpload beside it, and
 * deliberately so: an acknowledgement or an attestation IS the evidence and
 * has to be stored and shown again. A CSV is a delivery mechanism.
 *
 * ── Pasting stays ───────────────────────────────────────────────────────────
 *
 * Half the time a statement arrives as a fragment in an email rather than as a
 * file, and a picker that forced somebody to save that fragment to disk first
 * would be a worse tool than the textarea it replaced.
 */
export default function CsvFileInput({
  value,
  onChange,
  label = 'The file',
  placeholder = '',
  rows = 8,
  required = true,
  onError,
}) {
  const input = useRef(null);
  const [name, setName] = useState('');

  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-slate-700">
        {label}
        <FieldMark required={required} />
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            // A cancelled dialog fires change with NO file. Treating that as a
            // selection would wipe what is already in the box.
            if (!file) return;
            try {
              const text = await file.text();
              setName(file.name);
              onChange(text);
            } catch {
              onError?.('That file could not be read.');
            } finally {
              // So re-picking the same file after a failure fires change again.
              event.target.value = '';
            }
          }}
        />
        <Button type="button" size="sm" variant="secondary" onClick={() => input.current?.click()}>
          Choose a CSV
        </Button>
        {name && <span className="truncate text-xs text-slate-500">{name}</span>}
        <span className="text-xs text-slate-400">or paste it below</span>
      </div>

      <textarea
        rows={rows}
        value={value}
        onChange={(event) => { setName(''); onChange(event.target.value); }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

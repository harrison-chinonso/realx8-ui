import { useCallback, useEffect, useMemo, useState } from 'react';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';
import DocumentUpload from '../../components/common/DocumentUpload';
import CsvFileInput from '../../components/common/CsvFileInput';
import { useCurrency } from '../../context/useAppearance';
import { extractError } from '../../utils/extractError';
import {
  migrationStatus, migrationTypes, importChart, importOpeningBalances, importOpenItems,
} from '../../api/accountingApi';

/**
 * Bringing a company's existing books in.
 *
 * ── Three steps, and the order is not a suggestion ──────────────────────────
 *
 * The chart, then the balances, then the open items. Done out of order the
 * errors read like file problems — "account code not found" when the real
 * answer is "import the chart first" — so the steps are numbered and each one
 * says whether the one before it is done.
 *
 * ── Check before import, every time ─────────────────────────────────────────
 *
 * Nobody gets a migration file right the first time. Every step reads the file
 * and says what WOULD happen before anything is written, because a
 * half-committed import leaves a company working out which rows went in
 * against a ledger that is neither their old books nor their new ones.
 *
 * ── The sign-off is a person, not a checkbox ────────────────────────────────
 *
 * Opening balances decide what the company is worth on the day it arrives.
 * Their own finance lead or outgoing accountant confirms them in writing and
 * that document is attached here — an admin here attesting alone would put the
 * liability on Realx8 for figures nobody here can verify.
 */

const STEPS = [
  ['chart', '1. Their chart of accounts'],
  ['balances', '2. What they closed with'],
  ['items', '3. The invoices and bills behind it'],
];

export default function MigrationPage() {
  const fmt = useCurrency();
  const show = useMemo(() => (minor) => fmt(Number(minor || 0) / 100), [fmt]);

  const [step, setStep] = useState('chart');
  const [status, setStatus] = useState(null);
  const [types, setTypes] = useState([]);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState(null);
  const [problems, setProblems] = useState([]);
  const [typeMap, setTypeMap] = useState({});
  const [source, setSource] = useState('');

  const [asAt, setAsAt] = useState('');
  const [attestedBy, setAttestedBy] = useState('');
  const [attestationUrl, setAttestationUrl] = useState('');

  const [side, setSide] = useState('receivable');
  const [dayFirst, setDayFirst] = useState('true');

  const load = useCallback(async () => {
    try {
      setStatus(await migrationStatus());
    } catch (error) {
      setFailed(extractError(error, 'Could not read where this company has got to.'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    migrationTypes().then((data) => setTypes(data?.types || [])).catch(() => setTypes([]));
  }, []);

  /* Moving between steps must not carry the last file's state with it. */
  const goTo = (next) => {
    setStep(next);
    setCsv('');
    setPreview(null);
    setProblems([]);
    setFailed('');
    setMessage('');
  };

  const call = async (fn, { preview: isPreview } = {}) => {
    setBusy(true);
    setFailed('');
    setProblems([]);
    if (!isPreview) setMessage('');
    try {
      const result = await fn();
      if (isPreview) setPreview(result.data);
      else {
        setMessage(result.message || 'Done.');
        setPreview(null);
        setCsv('');
        await load();
      }
      return result;
    } catch (error) {
      setProblems(error?.response?.data?.errors || []);
      /*
       * A refusal often carries its own preview — the unclassified accounts,
       * the codes that are not in the chart. Keeping it is what lets somebody
       * fix the thing the message is complaining about.
       */
      if (error?.response?.data?.data) setPreview(error.response.data.data);
      setFailed(extractError(error, 'That could not be done.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const body = () => ({
    csv,
    source: source || undefined,
    type_map: Object.keys(typeMap).length ? typeMap : undefined,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Bring the books in</h1>
        <p className="text-sm text-slate-500">
          A company moving its statutory books here arrives with balances and open items. This is
          where they go. Historical transactions are deliberately not imported — a year of
          comparatives goes in as one summary journal per month.
        </p>
      </div>

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}
      {message && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}

      {status && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">Accounts in the chart</div>
            <div className="font-semibold text-slate-800">{status.accounts}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">Opening balances</div>
            <div className="font-semibold text-slate-800">
              {status.opening_balances
                ? `${status.opening_balances.reference} at ${status.opening_balances.entry_date}`
                : 'Not yet'}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">Open invoices brought in</div>
            <div className="font-semibold text-slate-800">{status.migrated_invoices}</div>
          </div>
          <div className={`rounded-lg px-3 py-2 ${status.suspense_minor ? 'bg-danger-surface' : 'bg-slate-50'}`}>
            <div className="text-xs text-slate-500">In suspense</div>
            <div className={`font-semibold ${status.suspense_minor ? 'text-danger' : 'text-slate-800'}`}>
              {show(status.suspense_minor)}
            </div>
          </div>
        </div>
      )}

      {/* Loaded AND non-zero. NaN !== 0 is true, so the figure alone is not a guard. */}
      {status && Number(status.suspense_minor) !== 0 && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          The trial balance that came in did not balance, and the difference is sitting in
          suspense. No period can close until somebody says where it belongs.
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {STEPS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => goTo(key)}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              step === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        {step === 'chart' && (
          <p className="text-sm text-slate-600">
            Four columns is all that is needed: code, name, type and parent. Every package on the
            market exports them. Anything whose type is not recognisable is listed back for you to
            classify rather than guessed at — a liability filed under assets produces a balance
            sheet that balances and describes a different company.
          </p>
        )}
        {step === 'balances' && (
          <p className="text-sm text-slate-600">
            Their closing trial balance: account code, debit, credit. It posts as ONE journal
            against opening balance equity, so nothing here ever masquerades as this year&apos;s
            trading. If it does not balance the difference goes to suspense, and no month can
            close until that is cleared.
          </p>
        )}
        {step === 'items' && (
          <p className="text-sm text-slate-600">
            The invoices and bills behind the control accounts — the file everybody forgets. A
            trial balance gives a receivables total; it does not say who owes it or since when.
            Without these, aged receivables is wrong from the first day and the control account
            never reconciles.
          </p>
        )}

        {step === 'chart' && (
          <Input
            label="Which package this came from (so next time is easier)"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Sage 50"
          />
        )}

        {step === 'balances' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="These were the balances on" type="date" required
              value={asAt} onChange={(e) => setAsAt(e.target.value)}
            />
          </div>
        )}

        {step === 'items' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">These are<FieldMark required /></span>
              <Select value={side} onChange={(e) => setSide(e.target.value)}>
                <option value="receivable">Invoices customers still owe</option>
                <option value="payable">Bills the company still owes</option>
              </Select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Dates are written<FieldMark /></span>
              <Select value={dayFirst} onChange={(e) => setDayFirst(e.target.value)}>
                <option value="true">day first — 03/04 is the third of April</option>
                <option value="false">month first — 03/04 is the fourth of March</option>
              </Select>
            </label>
          </div>
        )}

        <CsvFileInput
          value={csv}
          onChange={(text) => { setCsv(text); setPreview(null); setProblems([]); }}
          onError={setFailed}
          rows={10}
          label={step === 'chart'
            ? 'Their chart, exported'
            : step === 'balances'
              ? 'Their closing trial balance'
              : 'The open items'}
          placeholder={step === 'chart'
            ? 'Code,Name,Type,Parent'
            : step === 'balances'
              ? 'Account,Name,Debit,Credit'
              : 'Customer,Invoice No,Date,Due Date,Amount,Paid'}
        />

        {problems.length > 0 && (
          <div className="rounded-lg bg-danger-surface px-3 py-2 text-xs text-danger">
            <p className="font-medium">Nothing was imported. Every problem in the file:</p>
            <ul className="mt-1 list-disc pl-4">
              {problems.slice(0, 25).map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          </div>
        )}

        {/* ── What would happen ─────────────────────────────────────────── */}
        {preview && step === 'chart' && (
          <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <p>
              <strong>{preview.to_create}</strong> account(s) would be created
              {preview.already_present > 0 && `, ${preview.already_present} already here`}.
            </p>
            {preview.unclassified?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-800">
                  These have a type nobody here can be sure of. Say what each one means:
                </p>
                {preview.unclassified.map((row) => (
                  <div key={row.code} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-40 truncate">{row.code} {row.name}</span>
                    <span className="text-slate-500">&ldquo;{row.source_type}&rdquo;</span>
                    <Select
                      className="h-8 w-auto"
                      value={typeMap[String(row.source_type).toLowerCase()] || ''}
                      onChange={(e) => setTypeMap((current) => ({
                        ...current, [String(row.source_type).toLowerCase()]: e.target.value,
                      }))}
                    >
                      <option value="">Choose…</option>
                      {types.map((type) => <option key={type} value={type}>{type}</option>)}
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {preview && step === 'balances' && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <p>
              {preview.read} balance(s). Debits {show(preview.debit_minor)}, credits{' '}
              {show(preview.credit_minor)}.{' '}
              {preview.balanced
                ? <Badge value="it balances" tone="success" />
                : <span className="text-danger">
                  Out by {show(Math.abs(preview.difference_minor))} — that would go to suspense.
                </span>}
            </p>
            {preview.unknown_codes?.length > 0 && (
              <p className="mt-1 text-xs text-danger">
                Not in the chart: {preview.unknown_codes.join(', ')}. Import the chart first.
              </p>
            )}
          </div>
        )}

        {preview && step === 'items' && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <p>
              {preview.read} open item(s) across {preview.parties} {side === 'payable' ? 'supplier' : 'customer'}(s),
              totalling {show(preview.total_minor)}.
            </p>
            <p className={`mt-1 text-xs ${preview.reconciles ? 'text-green-700' : 'text-danger'}`}>
              {preview.reconciles
                ? 'They add up to the control account exactly, which is what makes the subledger trustworthy.'
                : `The control account says ${show(preview.control_balance_minor)} — a difference of `
                  + `${show(Math.abs(preview.difference_minor))}. Aged reporting will be wrong until that is fixed.`}
            </p>
            {preview.unknown?.length > 0 && (
              <p className="mt-1 text-xs text-danger">
                Not on the system: {preview.unknown.join(', ')}.
              </p>
            )}
          </div>
        )}

        {/* ── The sign-off ──────────────────────────────────────────────── */}
        {step === 'balances' && (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-900">
              These figures decide what the company is worth on the day it arrives, and every
              later dispute comes back to them. Their own finance lead or outgoing accountant has
              to confirm them in writing — an admin here confirming alone would put the liability
              on us for figures nobody here can verify.
            </p>
            <Input
              label="Who at the company confirms these" required
              value={attestedBy}
              onChange={(e) => setAttestedBy(e.target.value)}
              placeholder="Mrs Adeleke, FCA — outgoing accountant"
            />
            <div className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Their written confirmation<FieldMark required />
              </span>
              <DocumentUpload
                value={attestationUrl}
                onChange={setAttestationUrl}
                label="Attach the signed confirmation"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button
            type="button" variant="secondary" disabled={busy || !csv.trim()}
            onClick={() => {
              if (step === 'chart') return call(() => importChart(body(), { preview: true }), { preview: true });
              if (step === 'balances') {
                return call(
                  () => importOpeningBalances({ csv, as_at: asAt || undefined }, { preview: true }),
                  { preview: true },
                );
              }
              return call(
                () => importOpenItems(
                  { csv, side, day_first: dayFirst === 'true' },
                  { preview: true },
                ),
                { preview: true },
              );
            }}
          >
            Check it
          </Button>
          <Button
            type="button"
            disabled={busy || !csv.trim()
              || (step === 'balances' && (!asAt || !attestedBy.trim() || !attestationUrl))}
            onClick={() => {
              if (step === 'chart') return call(() => importChart(body()));
              if (step === 'balances') {
                return call(() => importOpeningBalances({
                  csv,
                  as_at: asAt,
                  attested_by: attestedBy.trim(),
                  attestation_url: attestationUrl,
                }));
              }
              return call(() => importOpenItems({ csv, side, day_first: dayFirst === 'true' }));
            }}
          >
            {busy ? 'Working…' : 'Import it'}
          </Button>
        </div>
      </div>
    </div>
  );
}

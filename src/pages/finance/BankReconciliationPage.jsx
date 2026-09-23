import { useCallback, useEffect, useMemo, useState } from 'react';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';
import CsvFileInput from '../../components/common/CsvFileInput';
import { bankOptions, isKnownBank } from '../../data/nigerianBanks';
import { useCurrency } from '../../context/useAppearance';
import { extractError } from '../../utils/extractError';
import {
  bankRecAccounts, bankMappings, importStatement, bankSuggestions, bankSummary,
  bankLines, matchBankLine, unmatchBankLine, postBankLine, ignoreBankLine,
  lockReconciliation, listReconciliations, listLedgerAccounts,
} from '../../api/accountingApi';

/**
 * Agreeing with the bank.
 *
 * ── Suggestions, never decisions ────────────────────────────────────────────
 *
 * Nothing on this screen matches anything by itself. A wrong automatic match
 * is invisible — the reconciliation balances, both sides are used up, and the
 * two transactions that were actually swapped are never looked at again. A
 * wrong suggestion costs a glance, so every one of them waits for somebody to
 * accept it.
 *
 * ── The gap runs in two directions ──────────────────────────────────────────
 *
 * A statement line the books have never heard of, and a payment the books
 * recorded that the bank has not shown. Most reconciliation screens report the
 * first and quietly omit the second, which describes half the difference and
 * makes the other half look like an error.
 *
 * ── Locking is the point of all of it ───────────────────────────────────────
 *
 * Period close will not close a month whose bank account was last reconciled
 * before the month ended. That is what makes this screen part of the accounts
 * rather than a monthly chore beside them.
 */

const TONE = {
  unmatched: 'warning', matched: 'success', posted: 'info', ignored: 'muted',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The two dates an ambiguous cell could be, written out.
 *
 * "03/08/2026 is either 3 August 2026 or 8 March 2026" is a question somebody
 * can answer. The first version of this built the sentence from the raw parts
 * and produced "the 3th of month 8", which is a question about arithmetic.
 */
const bothReadings = (raw) => {
  const parts = String(raw || '').match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!parts) return null;
  const [, first, second, rawYear] = parts;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const asDate = (day, month) => `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
  return { dayFirst: asDate(first, second), monthFirst: asDate(second, first) };
};

export default function BankReconciliationPage() {
  const fmt = useCurrency();
  const show = useMemo(() => (minor) => fmt(Number(minor || 0) / 100), [fmt]);

  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [asAt, setAsAt] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [certain, setCertain] = useState(0);
  const [settled, setSettled] = useState([]);
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState('');
  const [source, setSource] = useState('');
  const [dayFirst, setDayFirst] = useState('true');
  const [preview, setPreview] = useState(null);
  const [problems, setProblems] = useState([]);
  const [sources, setSources] = useState([]);
  const [otherBank, setOtherBank] = useState(false);
  const { alive, gone } = useMemo(() => bankOptions(), []);

  const [posting, setPosting] = useState(null);
  const [postAccount, setPostAccount] = useState('');
  const [chart, setChart] = useState([]);
  const [ignoring, setIgnoring] = useState(null);
  const [ignoreReason, setIgnoreReason] = useState('');
  const [locking, setLocking] = useState(false);
  const [statementBalance, setStatementBalance] = useState('');

  useEffect(() => {
    bankRecAccounts().then((list) => {
      setAccounts(list);
      if (list.length && !accountId) setAccountId(String(list[0].id));
    }).catch(() => setAccounts([]));
    bankMappings().then((list) => setSources([...new Set(list.map((m) => m.source))])).catch(() => {});
    listReconciliations().then(setLocks).catch(() => {});
  // Only on mount: re-running it would fight the user's account choice.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setFailed('');
    try {
      const [s, suggested, done] = await Promise.all([
        bankSummary({ account_id: accountId, as_at: asAt }),
        bankSuggestions({ account_id: accountId }),
        bankLines({ account_id: accountId, to: asAt }),
      ]);
      setSummary(s);
      setRows(suggested.data || []);
      setCertain(suggested.certain || 0);
      setSettled((done || []).filter((row) => row.status !== 'unmatched'));
    } catch (error) {
      setFailed(extractError(error, 'Could not read the account.'));
    } finally {
      setLoading(false);
    }
  }, [accountId, asAt]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, fallback) => {
    setBusy(true);
    setMessage('');
    setFailed('');
    try {
      const result = await fn();
      setMessage(result?.message || fallback);
      await load();
      setLocks(await listReconciliations());
      return result;
    } catch (error) {
      setFailed(extractError(error, 'That could not be done.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const lastLock = locks.find((row) => String(row.account_id) === String(accountId));
  const readings = preview?.ambiguous_example ? bothReadings(preview.ambiguous_example) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Bank reconciliation</h1>
          <p className="text-sm text-slate-500">
            What the bank says against what the books say. Nothing here matches by itself —
            a wrong automatic match balances the account and hides the two entries that were
            actually swapped.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setImporting(true); setPreview(null); setProblems([]); }}>
            Import a statement
          </Button>
          <Button
            disabled={!summary || summary.unmatched_lines > 0}
            onClick={() => {
              setLocking(true);
              setStatementBalance(summary
                ? String((summary.expected_statement_balance_minor || 0) / 100)
                : '');
            }}
          >
            Reconcile to {asAt}
          </Button>
        </div>
      </div>

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}
      {message && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Account<FieldMark required /></span>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.code} — {account.name}</option>
            ))}
          </Select>
        </label>
        <Input label="Reconcile to" type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)} />
        <Button variant="secondary" onClick={load} disabled={loading}>
          {loading ? 'Reading…' : 'Refresh'}
        </Button>
        {lastLock && (
          <p className="pb-2 text-xs text-slate-500">
            Last reconciled {lastLock.statement_date}
          </p>
        )}
      </div>

      {summary && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">The books say</div>
            <div className="font-semibold text-slate-800">{show(summary.ledger_balance_minor)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">On the statement, not in the books</div>
            <div className="font-semibold text-slate-800">{show(summary.on_statement_not_in_books_minor)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">In the books, not on the statement</div>
            <div className="font-semibold text-slate-800">{show(summary.in_books_not_on_statement_minor)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">So the bank should say</div>
            <div className="font-semibold text-slate-800">{show(summary.expected_statement_balance_minor)}</div>
          </div>
        </div>
      )}

      {certain > 0 && (
        <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">
          {certain} line{certain === 1 ? ' has' : 's have'} a match on the same amount, within a
          few days, with the reference on both. They still need accepting.
        </div>
      )}

      {!loading && !rows.length && (
        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          {summary?.statement_lines
            ? 'Every statement line up to this date has been dealt with.'
            : 'No statement has been imported for this account yet.'}
        </div>
      )}

      <div className="space-y-2">
        {rows.map(({ line, suggestions }) => (
          <div key={line.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold tabular-nums ${line.amount_minor < 0 ? 'text-danger' : 'text-slate-800'}`}>
                    {show(line.amount_minor)}
                  </span>
                  <span className="text-xs text-slate-500">{line.statement_date}</span>
                  <Badge value={line.status} tone={TONE[line.status]} />
                </div>
                <p className="truncate text-sm text-slate-600">{line.description || line.reference || '—'}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm" variant="secondary" disabled={busy}
                  onClick={() => { setPosting(line); setPostAccount(''); if (!chart.length) listLedgerAccounts({ active: 'true' }).then(setChart).catch(() => {}); }}
                >
                  Post it
                </Button>
                <Button
                  size="sm" variant="secondary" disabled={busy}
                  onClick={() => { setIgnoring(line); setIgnoreReason(''); }}
                >
                  Set aside
                </Button>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.candidate.entry_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-slate-700">{suggestion.candidate.reference}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {suggestion.candidate.entry_date} · {suggestion.reasons.join(', ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        value={suggestion.certainty}
                        tone={suggestion.certainty === 'certain' ? 'success' : 'muted'}
                      />
                      <Button
                        size="sm" disabled={busy}
                        onClick={() => act(
                          () => matchBankLine(line.id, suggestion.candidate.entry_id),
                          'Matched.',
                        )}
                      >
                        This is it
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {suggestions.length === 0 && (
              <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
                Nothing in the books matches this. If it is a bank charge or interest, post it
                straight to an account — the bank is the only document there is.
              </p>
            )}
          </div>
        ))}
      </div>

      {/*
        Everything already dealt with, and a way back out of it.

        A match accepted in error with no undo is a match that stays wrong for
        ever — and the two entries it consumed never appear in front of anybody
        again. A posted line is different: the journal is the record, so it has
        to be reversed rather than unpicked here.
      */}
      {settled.length > 0 && (
        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            {settled.length} line{settled.length === 1 ? '' : 's'} already dealt with
          </summary>
          <div className="mt-2 space-y-1">
            {settled.map((line) => (
              <div key={line.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-1.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium tabular-nums text-slate-700">{show(line.amount_minor)}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {line.statement_date} · {line.entry_reference || line.description || line.reference}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={line.status} tone={TONE[line.status]} />
                  {line.status === 'matched' && !line.reconciliation_id && (
                    <Button
                      size="sm" variant="secondary" disabled={busy}
                      onClick={() => act(() => unmatchBankLine(line.id), 'Unmatched.')}
                    >
                      Not that one
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── Import ───────────────────────────────────────────────────────── */}
      <Modal open={importing} onClose={() => !busy && setImporting(false)} title="Import a statement" size="lg">
        <div className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Which bank<FieldMark required /></span>
              <Select
                value={otherBank ? '__other__' : source}
                onChange={(e) => {
                  if (e.target.value === '__other__') { setOtherBank(true); setSource(''); return; }
                  setOtherBank(false);
                  setSource(e.target.value);
                }}
              >
                <option value="">Choose…</option>
                {/*
                  Banks this company has already imported from come first: it
                  is almost always one of them again, and those are the ones
                  with a saved column mapping behind them.
                */}
                {sources.length > 0 && (
                  <optgroup label="Imported before">
                    {sources.map((name) => <option key={name} value={name}>{name}</option>)}
                  </optgroup>
                )}
                <optgroup label="Nigerian banks">
                  {alive.filter((bank) => !sources.includes(bank.name)).map((bank) => (
                    <option key={bank.name} value={bank.name}>
                      {bank.name}{bank.short ? ` (${bank.short})` : ''}
                    </option>
                  ))}
                </optgroup>
                {/*
                  Kept, because statements from those years still need
                  importing — and separated, so nobody picks one for an
                  account opened last week.
                */}
                <optgroup label="No longer trading">
                  {gone.map((bank) => (
                    <option key={bank.name} value={bank.name}>
                      {bank.name} — {bank.former}
                    </option>
                  ))}
                </optgroup>
                <option value="__other__">Another bank — type its name</option>
              </Select>
            </label>

            {otherBank && (
              <Input
                label="The bank's name"
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="As it appears on the statement"
              />
            )}
          </div>

          {otherBank && source.trim() && isKnownBank(source) && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {source.trim()} is already in the list above — picking it there keeps the name
              consistent, so next month&apos;s import finds the columns you set today.
            </p>
          )}

          <CsvFileInput
            value={csv}
            onChange={(text) => { setCsv(text); setPreview(null); setProblems([]); }}
            onError={setFailed}
            label="The statement"
            hint="The CSV or Excel file your bank gives you — date, narration, reference and the amounts"
          />

          {problems.length > 0 && (
            <div className="rounded-lg bg-danger-surface px-3 py-2 text-xs text-danger">
              <p className="font-medium">Nothing was imported. Every problem in the file:</p>
              <ul className="mt-1 list-disc pl-4">
                {problems.slice(0, 20).map((problem) => <li key={problem}>{problem}</li>)}
              </ul>
            </div>
          )}

          {preview && (
            <div className="space-y-2">
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <p>
                  <strong>{preview.to_import}</strong> line(s) to import
                  {preview.already_imported > 0 && `, ${preview.already_imported} already seen`}
                  {preview.from && `, ${preview.from} to ${preview.to}`}.
                </p>
                <p>
                  {show(preview.money_in_minor)} in, {show(Math.abs(preview.money_out_minor))} out.
                </p>
              </div>

              {/*
                The date question, asked only where the file leaves it open.

                An all-numeric date with both parts at twelve or below is the
                only ambiguous case: "03 Aug 2026" says which it is, and so
                does 25/04. Asking everybody every time made a reader answer a
                question their file had already answered, in wording that
                described neither of the formats in front of them.
              */}
              {preview.ambiguous_dates > 0 ? (
                <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <p>
                    {preview.ambiguous_dates} date{preview.ambiguous_dates === 1 ? '' : 's'} in this
                    file could be read two ways.
                    {readings && (
                      <>
                        {' '}<strong>{preview.ambiguous_example}</strong> is either{' '}
                        <strong>{readings.dayFirst}</strong> or{' '}
                        <strong>{readings.monthFirst}</strong>. Which does this bank mean?
                      </>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      className="h-8 w-auto"
                      value={dayFirst}
                      onChange={(e) => setDayFirst(e.target.value)}
                    >
                      <option value="true">
                        {readings ? readings.dayFirst : 'Day first'}
                      </option>
                      <option value="false">
                        {readings ? readings.monthFirst : 'Month first'}
                      </option>
                    </Select>
                    <span className="text-amber-800">
                      Check it again after changing this. The answer is remembered for this bank.
                    </span>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
                  The dates in this file say which they are — nothing to choose.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={() => setImporting(false)} disabled={busy}>Cancel</Button>
            <Button
              type="button" variant="secondary" disabled={busy || !csv.trim()}
              onClick={async () => {
                setBusy(true);
                setProblems([]);
                setFailed('');
                try {
                  const result = await importStatement({
                    account_id: Number(accountId),
                    csv,
                    source: source || undefined,
                    day_first: dayFirst === 'true',
                  }, { preview: true });
                  setPreview(result.data);
                } catch (error) {
                  setProblems(error?.response?.data?.errors || []);
                  setFailed(extractError(error, 'The file could not be read.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Check it
            </Button>
            <Button
              type="button" disabled={busy || !csv.trim()}
              onClick={async () => {
                const result = await act(
                  () => importStatement({
                    account_id: Number(accountId),
                    csv,
                    source: source || undefined,
                    day_first: dayFirst === 'true',
                  }),
                  'Imported.',
                );
                if (result) { setImporting(false); setCsv(''); setPreview(null); }
              }}
            >
              {busy ? 'Importing…' : 'Import it'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Post a line ──────────────────────────────────────────────────── */}
      <Modal open={posting !== null} onClose={() => !busy && setPosting(null)} title="Post this line" size="sm">
        {posting && (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{show(posting.amount_minor)}</strong> on {posting.statement_date} —{' '}
              {posting.description || posting.reference}
            </p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Bank charges, interest, a standing order nobody recorded. These have no document in
              the platform and never will, so the journal is written from here and dated when the
              bank says it happened.
            </p>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                {posting.amount_minor < 0 ? 'Charge it to' : 'Credit it to'}<FieldMark required />
              </span>
              <Select value={postAccount} onChange={(e) => setPostAccount(e.target.value)}>
                <option value="">Choose…</option>
                {chart.map((account) => (
                  <option key={account.id} value={account.id}>{account.code} — {account.name}</option>
                ))}
              </Select>
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setPosting(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button" disabled={busy || !postAccount}
                onClick={async () => {
                  const result = await act(
                    () => postBankLine(posting.id, { account_id: Number(postAccount) }),
                    'Posted.',
                  );
                  if (result) setPosting(null);
                }}
              >
                {busy ? 'Posting…' : 'Post it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Set aside ────────────────────────────────────────────────────── */}
      <Modal open={ignoring !== null} onClose={() => !busy && setIgnoring(null)} title="Set this line aside" size="sm">
        {ignoring && (
          <div className="space-y-3 text-sm">
            <p>
              It stays on the statement either way — setting it aside only says it is not the
              company&apos;s business to record.
            </p>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Why<FieldMark required /></span>
              <textarea
                rows={3}
                value={ignoreReason}
                onChange={(e) => setIgnoreReason(e.target.value)}
                placeholder="The bank reversed it the same day."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setIgnoring(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button" disabled={busy || !ignoreReason.trim()}
                onClick={async () => {
                  const result = await act(
                    () => ignoreBankLine(ignoring.id, ignoreReason.trim()),
                    'Set aside.',
                  );
                  if (result) setIgnoring(null);
                }}
              >
                {busy ? 'Saving…' : 'Set it aside'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Lock ─────────────────────────────────────────────────────────── */}
      <Modal open={locking} onClose={() => !busy && setLocking(false)} title="Reconcile and lock" size="sm">
        <div className="space-y-3 text-sm">
          <p>
            Everything up to <strong>{asAt}</strong> has been dealt with. Locking records that the
            books and the bank agreed on that date.
          </p>
          <Input
            label="What the bank says the balance was"
            type="number" step="0.01"
            value={statementBalance}
            onChange={(e) => setStatementBalance(e.target.value)}
          />
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Period close will not close a month whose bank account was last reconciled before the
            month ended, which is what makes this part of the accounts rather than a chore beside
            them. It cannot be edited afterwards.
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={() => setLocking(false)} disabled={busy}>Cancel</Button>
            <Button
              type="button" disabled={busy}
              onClick={async () => {
                const result = await act(
                  () => lockReconciliation({
                    account_id: Number(accountId),
                    statement_date: asAt,
                    statement_balance_minor: Math.round(Number(statementBalance) * 100),
                  }),
                  'Reconciled.',
                );
                if (result) setLocking(false);
              }}
            >
              {busy ? 'Locking…' : 'Lock it'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

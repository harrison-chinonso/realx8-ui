import { useCallback, useEffect, useState } from 'react';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';
import { useCurrency } from '../../context/useAppearance';
import { extractError } from '../../utils/extractError';
import { plural } from '../../utils/plural';
import {
  listLedgerAccounts, listJournal, getJournalEntry, createManualJournal,
  reverseJournalEntry, importJournalCsv, trialBalance,
} from '../../api/accountingApi';

/**
 * The books: the accounts, the journal, and the trial balance over both.
 *
 * ── A posted journal is never edited ────────────────────────────────────────
 *
 * There is no edit button anywhere on this screen and there must never be. A
 * correction is a reversing entry that names what it reverses, which is what
 * lets a statement be reproduced exactly as it read at a past date — the thing
 * an auditor means by an audit trail. The database refuses an UPDATE too, so
 * the absence of the button is a statement of intent rather than the guarantee.
 *
 * ── Why the trial balance says whether it balances ──────────────────────────
 *
 * A reader must not have to compare two totals themselves to find out whether
 * what they are reading can be trusted. If it is ever out, the difference is
 * shown rather than hidden — the person looking needs the figures to find out
 * what is wrong, and a screen that simply refused would tell them only that
 * something is.
 */

const TABS = [
  { key: 'trial', label: 'Trial balance' },
  { key: 'journal', label: 'Journal' },
  { key: 'chart', label: 'Chart of accounts' },
];

const TYPE_TONE = {
  asset: 'info', liability: 'warning', equity: 'muted', income: 'success', expense: 'danger',
};

const EMPTY_LINE = { code: '', debit: '', credit: '', memo: '' };

export default function LedgerPage() {
  const fmt = useCurrency();
  const money = (minor) => fmt(Number(minor || 0) / 100);

  const [tab, setTab] = useState('trial');
  const [accounts, setAccounts] = useState([]);
  const [journal, setJournal] = useState([]);
  const [tb, setTb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });

  const [open, setOpen] = useState(null);      // the entry being read
  const [reversing, setReversing] = useState(null);
  const [reason, setReason] = useState('');

  const [showJournal, setShowJournal] = useState(false);
  const [entryDate, setEntryDate] = useState('');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);

  const [showImport, setShowImport] = useState(false);
  const [csv, setCsv] = useState('');
  const [importErrors, setImportErrors] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      const [a, j, t] = await Promise.all([
        listLedgerAccounts(),
        listJournal({ limit: 100, ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) }),
        trialBalance({ ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) }),
      ]);
      setAccounts(a);
      setJournal(j);
      setTb(t);
    } catch (error) {
      setFailed(extractError(error, 'Could not load the books.'));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, success) => {
    setBusy(true);
    setMessage('');
    setFailed('');
    try {
      const out = await fn();
      setMessage(success);
      await load();
      return out ?? true;
    } catch (error) {
      setFailed(extractError(error, 'That could not be done.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const toMinor = (value) => Math.round((Number(value) || 0) * 100);
  const draftTotals = lines.reduce(
    (acc, line) => ({ dr: acc.dr + toMinor(line.debit), cr: acc.cr + toMinor(line.credit) }),
    { dr: 0, cr: 0 },
  );
  const draftBalanced = draftTotals.dr > 0 && draftTotals.dr === draftTotals.cr;

  const submitJournal = async (event) => {
    event.preventDefault();
    const payload = {
      entry_date: entryDate,
      memo,
      lines: lines
        .filter((l) => l.code && (toMinor(l.debit) || toMinor(l.credit)))
        .map((l) => ({
          code: l.code.trim(),
          debit_minor: toMinor(l.debit),
          credit_minor: toMinor(l.credit),
          memo: l.memo || null,
        })),
    };
    const out = await act(() => createManualJournal(payload), 'Journal posted.');
    if (out) {
      setShowJournal(false);
      setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
      setMemo('');
    }
  };

  const runImport = async (preview) => {
    setBusy(true);
    setImportErrors([]);
    setFailed('');
    setMessage('');
    try {
      const out = await importJournalCsv({ csv, entry_date: entryDate || undefined, memo }, { preview });
      if (preview) {
        setMessage(out?.data?.balanced
          ? `Checks out — ${plural(out.data.lines.length, 'line')}, ${money(out.data.debit_minor)} each side.`
          : 'The file does not balance.');
      } else {
        setMessage(out?.message || `Posted as ${out?.data?.reference}.`);
        setShowImport(false);
        setCsv('');
        await load();
      }
    } catch (error) {
      // Every problem at once — the API returns the whole list, and a
      // four-hundred-row payroll journal needs all of them, not the first.
      setImportErrors(error?.response?.data?.errors || []);
      setFailed(extractError(error, 'The file was not imported.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">The Ledger</h1>
          <p className="text-sm text-slate-500">
            Every figure here comes from a journal, and every journal from something that happened.
            A posted entry is corrected by reversing it, never by editing it.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => setShowImport(true)}>Import a journal</Button>
          <Button onClick={() => setShowJournal(true)}>Write a journal</Button>
        </div>
      </div>

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}
      {message && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}

      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <Input label="From" type="date" value={range.from}
          onChange={(e) => setRange((c) => ({ ...c, from: e.target.value }))} />
        <Input label="To" type="date" value={range.to}
          onChange={(e) => setRange((c) => ({ ...c, to: e.target.value }))} />
        {(range.from || range.to) && (
          <Button variant="secondary" onClick={() => setRange({ from: '', to: '' })}>Whole ledger</Button>
        )}
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {TABS.map((item) => (
          <button
            key={item.key} type="button" onClick={() => setTab(item.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'trial' && (
        <div className="space-y-3">
          {tb && (
            <div className={`rounded-xl px-4 py-3 text-sm ring-1 ${tb.balanced
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
              : 'bg-rose-50 text-rose-800 ring-rose-200'}`}
            >
              {tb.balanced
                ? `Balanced — ${money(tb.debit_minor)} on each side.`
                : `OUT BY ${money(Math.abs(tb.difference_minor))}. Debits ${money(tb.debit_minor)},`
                  + ` credits ${money(tb.credit_minor)}. Something posted wrongly; the journal below is where to look.`}
            </div>
          )}
          <Table
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'name', label: 'Account' },
              { key: 'type', label: 'Type', render: (r) => <Badge value={r.type} tone={TYPE_TONE[r.type]} /> },
              { key: 'debit_minor', label: 'Debits', render: (r) => money(r.debit_minor) },
              { key: 'credit_minor', label: 'Credits', render: (r) => money(r.credit_minor) },
              {
                key: 'balance_minor',
                label: 'Balance',
                render: (r) => (
                  <span className="font-semibold" title={`${r.normal_balance}-normal account`}>
                    {money(r.balance_minor)}
                  </span>
                ),
              },
            ]}
            data={tb?.accounts ?? []}
            loading={loading}
            exportName="trial-balance"
            emptyMessage="Nothing has been posted in this period."
          />
        </div>
      )}

      {tab === 'journal' && (
        <Table
          columns={[
            { key: 'reference', label: 'Entry' },
            {
              key: 'entry_date',
              label: 'Date',
              render: (r) => (r.entry_date ? new Date(r.entry_date).toLocaleDateString() : '—'),
            },
            { key: 'source', label: 'Caused by', render: (r) => String(r.source || '').replace(/_/g, ' ') },
            {
              key: 'memo',
              label: 'What it was',
              render: (r) => (
                <span className="block max-w-[22rem] truncate" title={r.memo || ''}>
                  {r.memo || '—'}
                  {r.reverses_entry_id && <span className="ml-1 text-xs text-amber-700">(a reversal)</span>}
                </span>
              ),
            },
            { key: 'debit_minor', label: 'Amount', render: (r) => money(r.debit_minor) },
            {
              key: 'created_by_name',
              label: 'Posted by',
              render: (r) => r.created_by_name || <span className="text-slate-400">the system</span>,
            },
          ]}
          data={journal}
          loading={loading}
          exportName="journal"
          emptyMessage="Nothing posted yet."
          renderActions={(row) => (
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary"
                onClick={async () => setOpen(await getJournalEntry(row.id))}>
                View
              </Button>
              {!row.reverses_entry_id && (
                <Button size="sm" variant="secondary" disabled={busy}
                  onClick={() => { setReversing(row); setReason(''); }}>
                  Reverse
                </Button>
              )}
            </div>
          )}
        />
      )}

      {tab === 'chart' && (
        <Table
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Account' },
            { key: 'type', label: 'Type', render: (r) => <Badge value={r.type} tone={TYPE_TONE[r.type]} /> },
            {
              key: 'role',
              label: 'Used for',
              render: (r) => (r.role
                ? <span className="font-mono text-xs text-slate-600" title="Posting rules address this account by this name">{r.role}</span>
                : <span className="text-slate-400">—</span>),
            },
            {
              key: 'is_active',
              label: 'Active',
              render: (r) => (r.is_active ? 'Yes' : <span className="text-slate-400">Deactivated</span>),
            },
          ]}
          data={accounts}
          loading={loading}
          exportName="chart-of-accounts"
          emptyMessage="No chart yet."
        />
      )}

      {/* ── One entry, drilled into ──────────────────────────────────────── */}
      <Modal open={open !== null} onClose={() => setOpen(null)} title={open ? `Entry ${open.reference}` : ''} size="lg">
        {open && (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div><span className="text-slate-500">Date</span><div>{new Date(open.entry_date).toLocaleDateString()}</div></div>
              <div><span className="text-slate-500">Caused by</span><div>{String(open.source).replace(/_/g, ' ')} {open.source_id || ''}</div></div>
              <div><span className="text-slate-500">Posted by</span><div>{open.created_by_name || 'the system'}</div></div>
              <div>
                <span className="text-slate-500">Written</span>
                <div title="The wall clock, which is not the accounting date">
                  {open.created_at ? new Date(open.created_at).toLocaleString() : '—'}
                </div>
              </div>
            </div>
            {open.memo && <p className="rounded-lg bg-slate-50 px-3 py-2">{open.memo}</p>}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-1 text-left">Account</th>
                  <th className="pb-1 text-right">Debit</th>
                  <th className="pb-1 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {(open.lines || []).map((line) => (
                  <tr key={line.id} className="border-t border-slate-100">
                    <td className="py-1">
                      {line.account_code} {line.account_name}
                      {line.account_role && line.account_role !== line.account_code && (
                        <span className="ml-1 font-mono text-xs text-slate-400">{line.account_role}</span>
                      )}
                    </td>
                    <td className="py-1 text-right tabular-nums">{line.debit_minor > 0 ? money(line.debit_minor) : ''}</td>
                    <td className="py-1 text-right tabular-nums">{line.credit_minor > 0 ? money(line.credit_minor) : ''}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-semibold">
                  <td className="py-1">Total</td>
                  <td className="py-1 text-right tabular-nums">{money(open.debit_minor)}</td>
                  <td className="py-1 text-right tabular-nums">{money(open.credit_minor)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* ── Reverse ──────────────────────────────────────────────────────── */}
      <Modal open={reversing !== null} onClose={() => !busy && setReversing(null)} title="Reverse this entry" size="sm">
        {reversing && (
          <div className="space-y-3 text-sm">
            <p>
              {reversing.reference} is not changed. A new entry is written with the sides swapped,
              naming this one — so a statement produced before the correction still reproduces.
            </p>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Why<FieldMark required /></span>
              <textarea
                rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="It stays on the record beside the entry."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setReversing(null)} disabled={busy}>Cancel</Button>
              <Button type="button" disabled={busy || !reason.trim()}
                onClick={async () => {
                  const ok = await act(() => reverseJournalEntry(reversing.id, reason.trim()), 'Reversed.');
                  if (ok) setReversing(null);
                }}
              >
                {busy ? 'Reversing…' : 'Reverse it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Write a journal ──────────────────────────────────────────────── */}
      <Modal open={showJournal} onClose={() => !busy && setShowJournal(false)} title="Write a journal" size="lg">
        <form onSubmit={submitJournal} className="space-y-3">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            For the things the system cannot know — an opening balance, an accrual, a depreciation
            charge worked out elsewhere. Everything else posts itself from the event that caused it.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Date it belongs to" type="date" required value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)} />
            <Input label="What it is" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>

          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_1fr]">
                <Select
                  value={line.code}
                  onChange={(e) => setLines((c) => c.map((l, i) => (i === index ? { ...l, code: e.target.value } : l)))}
                >
                  <option value="">Account…</option>
                  {accounts.filter((a) => a.is_active).map((a) => (
                    <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
                  ))}
                </Select>
                <Input type="number" step="0.01" min="0" placeholder="Debit" value={line.debit}
                  onChange={(e) => setLines((c) => c.map((l, i) => (i === index ? { ...l, debit: e.target.value, credit: '' } : l)))} />
                <Input type="number" step="0.01" min="0" placeholder="Credit" value={line.credit}
                  onChange={(e) => setLines((c) => c.map((l, i) => (i === index ? { ...l, credit: e.target.value, debit: '' } : l)))} />
                <Input placeholder="Note" value={line.memo}
                  onChange={(e) => setLines((c) => c.map((l, i) => (i === index ? { ...l, memo: e.target.value } : l)))} />
              </div>
            ))}
            <Button type="button" size="sm" variant="secondary"
              onClick={() => setLines((c) => [...c, { ...EMPTY_LINE }])}>
              Another line
            </Button>
          </div>

          {/*
            Said before it is submitted rather than as a refusal afterwards. The
            API refuses an unbalanced journal outright, which is correct there
            and unhelpful here.
          */}
          <div className={`rounded-lg px-3 py-2 text-sm ${draftBalanced
            ? 'bg-emerald-50 text-emerald-800'
            : 'bg-slate-50 text-slate-600'}`}
          >
            Debits {money(draftTotals.dr)} · Credits {money(draftTotals.cr)}
            {draftTotals.dr !== draftTotals.cr && (
              <strong> — out by {money(Math.abs(draftTotals.dr - draftTotals.cr))}</strong>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={() => setShowJournal(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !draftBalanced}>{busy ? 'Posting…' : 'Post it'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Import ───────────────────────────────────────────────────────── */}
      <Modal open={showImport} onClose={() => !busy && setShowImport(false)} title="Import a journal" size="lg">
        <div className="space-y-3">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Paste a CSV with <strong>account, debit, credit</strong> columns — a payroll bureau&apos;s
            monthly summary, a depreciation schedule kept in a spreadsheet. A date and memo column
            are used if present. It posts through the same checks as a journal typed by hand.
          </p>
          <textarea
            rows={10} value={csv} onChange={(e) => setCsv(e.target.value)}
            placeholder={'account,debit,credit,date,memo\n5210,1250000,,2026-09-30,September payroll\n2330,,150000,2026-09-30,PAYE\n1020,,1100000,2026-09-30,Net pay'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
          />
          <Input label="Date (if the file has no date column)" type="date" value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)} />

          {importErrors.length > 0 && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <p className="font-semibold">{plural(importErrors.length, 'problem')} — nothing was posted:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                {importErrors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={() => setShowImport(false)} disabled={busy}>Cancel</Button>
            <Button type="button" variant="secondary" disabled={busy || !csv.trim()} onClick={() => runImport(true)}>
              Check it
            </Button>
            <Button type="button" disabled={busy || !csv.trim()} onClick={() => runImport(false)}>
              {busy ? 'Posting…' : 'Post it'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

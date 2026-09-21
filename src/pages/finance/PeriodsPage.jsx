import { useCallback, useEffect, useMemo, useState } from 'react';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';
import { useCurrency } from '../../context/useAppearance';
import { extractError } from '../../utils/extractError';
import {
  listPeriods, createPeriods, checkPeriod, closePeriod, reopenPeriod, auditPack,
} from '../../api/accountingApi';

/**
 * Closing the books.
 *
 * ── What the button actually claims ─────────────────────────────────────────
 *
 * That the figures for a month are final. The screen is built around making
 * that claim honestly: the checklist is shown in full before anything can be
 * closed, a failing check blocks rather than warns, and reopening asks for a
 * reason because figures somebody may already have reported are about to
 * change.
 *
 * ── The checklist is the screen ─────────────────────────────────────────────
 *
 * Not a confirmation dialog with a list behind it. Each check names two
 * figures that must agree and the difference between them, because "receivables
 * look wrong" is not something anybody can act on and "the control account says
 * one thing and the invoices say another, by this much" is.
 *
 * ── Warnings are not failures, and look different ───────────────────────────
 *
 * A company that has not adopted bank reconciliation should still be able to
 * close a month. Colouring an unadopted feature red teaches people to ignore
 * the list, which costs more than the check was worth.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TONE = { ok: 'success', failed: 'danger', warning: 'warning' };

export default function PeriodsPage() {
  const fmt = useCurrency();
  const show = useMemo(() => (minor) => fmt(Number(minor || 0) / 100), [fmt]);

  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [yearEndMonth, setYearEndMonth] = useState('12');

  const [open, setOpen] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [reopening, setReopening] = useState(null);
  const [reason, setReason] = useState('');
  const [pack, setPack] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      setPeriods(await listPeriods());
    } catch (error) {
      setFailed(extractError(error, 'Could not load the periods.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const inspect = async (period) => {
    setOpen(period);
    setChecklist(null);
    setFailed('');
    try {
      setChecklist(await checkPeriod(period.id));
    } catch (error) {
      setFailed(extractError(error, 'The checklist could not be run.'));
    }
  };

  const act = async (fn, fallback) => {
    setBusy(true);
    setMessage('');
    setFailed('');
    try {
      const result = await fn();
      setMessage(result?.message || fallback);
      await load();
      return result;
    } catch (error) {
      setFailed(extractError(error, 'That could not be done.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const openCount = periods.filter((p) => p.status === 'open').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Accounting periods</h1>
          <p className="text-sm text-slate-500">
            Closing a month says its figures are final. Nothing can be posted into a closed month
            — including the automatic postings — until somebody reopens it and says why.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setGenerating(true)}>Add periods</Button>
      </div>

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}
      {message && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}

      {!loading && !periods.length && (
        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          No periods yet. Until one exists nothing is ever closed, so every statement stays
          provisional and anything behind it can still change.
        </div>
      )}

      {openCount > 1 && (
        <div className="rounded-lg bg-slate-50 px-4 py-2 text-xs text-slate-600">
          {openCount} months are open. Close them oldest first — a closed month resting on an open
          one can still change underneath it.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-left">From</th>
              <th className="px-3 py-2 text-left">To</th>
              <th className="px-3 py-2 text-left">State</th>
              <th className="px-3 py-2 text-left">Closed</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  {period.name}
                  {period.is_year_end && (
                    <span className="ml-2 text-xs text-slate-500">year end</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">{period.starts_on}</td>
                <td className="px-3 py-2 text-slate-500">{period.ends_on}</td>
                <td className="px-3 py-2">
                  <Badge value={period.status} tone={period.status === 'closed' ? 'muted' : 'success'} />
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {period.closed_at ? new Date(period.closed_at).toLocaleDateString() : '—'}
                  {period.reopen_reason && (
                    <span className="block text-amber-700" title={period.reopen_reason}>
                      reopened
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    {period.status === 'open' && (
                      <Button size="sm" variant="secondary" onClick={() => inspect(period)}>
                        Check and close
                      </Button>
                    )}
                    {period.status === 'closed' && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            setFailed('');
                            try {
                              setPack(await auditPack(period.id));
                            } catch (error) {
                              setFailed(extractError(error, 'The pack could not be produced.'));
                            }
                          }}
                        >
                          Audit pack
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => { setReopening(period); setReason(''); }}
                        >
                          Reopen
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── The checklist ────────────────────────────────────────────────── */}
      <Modal
        open={open !== null}
        onClose={() => !busy && setOpen(null)}
        title={open ? `Close ${open.name}` : 'Close'}
        size="lg"
      >
        {open && (
          <div className="space-y-3 text-sm">
            {!checklist && <p className="py-6 text-center text-slate-500">Running the checks…</p>}
            {checklist && (
              <>
                <div className="space-y-2">
                  {checklist.checks.map((item) => (
                    <div
                      key={item.key}
                      className={`rounded-lg px-3 py-2 ${
                        item.status === 'failed' ? 'bg-danger-surface'
                          : item.status === 'warning' ? 'bg-amber-50' : 'bg-green-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-slate-800">{item.label}</span>
                        <Badge value={item.status} tone={TONE[item.status]} />
                      </div>
                      <p className={`text-xs ${
                        item.status === 'failed' ? 'text-danger'
                          : item.status === 'warning' ? 'text-amber-800' : 'text-slate-600'
                      }`}
                      >
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>

                {open.is_year_end && checklist.can_close && (
                  <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    This is the last month of the financial year. Closing it also posts the
                    year&apos;s result to retained earnings, as a dated journal like any other. The
                    balance sheet does not change — the figure simply moves out of the profit and
                    loss and into the account.
                  </p>
                )}

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <Button type="button" variant="secondary" onClick={() => setOpen(null)} disabled={busy}>
                    Not yet
                  </Button>
                  <Button
                    type="button"
                    disabled={busy || !checklist.can_close}
                    onClick={async () => {
                      const result = await act(() => closePeriod(open.id), 'Closed.');
                      if (result) setOpen(null);
                    }}
                  >
                    {busy ? 'Closing…' : `Close ${open.name}`}
                  </Button>
                </div>
                {!checklist.can_close && (
                  <p className="text-right text-xs text-slate-500">
                    {checklist.failed} check{checklist.failed === 1 ? '' : 's'} must pass first.
                    A close that could be forced would claim nothing.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Reopen ───────────────────────────────────────────────────────── */}
      <Modal open={reopening !== null} onClose={() => !busy && setReopening(null)} title="Reopen this period" size="sm">
        {reopening && (
          <div className="space-y-3 text-sm">
            <p>
              {reopening.name} was closed
              {reopening.closed_at ? ` on ${new Date(reopening.closed_at).toLocaleDateString()}` : ''}.
              Anything posted into it from now on changes figures that were final.
            </p>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Why<FieldMark required /></span>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="A supplier invoice for that month arrived late."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setReopening(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={async () => {
                  const result = await act(() => reopenPeriod(reopening.id, reason.trim()), 'Reopened.');
                  if (result) setReopening(null);
                }}
              >
                {busy ? 'Reopening…' : 'Reopen it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add periods ──────────────────────────────────────────────────── */}
      <Modal open={generating} onClose={() => !busy && setGenerating(false)} title="Add periods" size="sm">
        <div className="space-y-3 text-sm">
          <Input label="Year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Your financial year ends in<FieldMark /></span>
            <Select value={yearEndMonth} onChange={(e) => setYearEndMonth(e.target.value)}>
              {MONTHS.map((month, index) => (
                <option key={month} value={String(index + 1)}>{month}</option>
              ))}
            </Select>
          </label>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Twelve months are created, and the one you name above is marked as the year end —
            closing it is what moves the year&apos;s result to retained earnings. Asked for rather
            than assumed, because a year ending in June is ordinary.
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={() => setGenerating(false)} disabled={busy}>Cancel</Button>
            <Button
              type="button"
              disabled={busy || !year}
              onClick={async () => {
                const result = await act(
                  () => createPeriods({ year: Number(year), year_end_month: Number(yearEndMonth) }),
                  'Created.',
                );
                if (result) setGenerating(false);
              }}
            >
              {busy ? 'Creating…' : 'Create them'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── The audit pack ───────────────────────────────────────────────── */}
      <Modal open={pack !== null} onClose={() => setPack(null)} title={pack ? `${pack.period.name} — audit pack` : ''} size="lg">
        {pack && (
          <div className="space-y-3 text-sm">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Closed
              {pack.closed_at ? ` on ${new Date(pack.closed_at).toLocaleString()}` : ''}. The
              checklist below is what was recorded at the close, not an answer about today.
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Revenue', pack.profit_and_loss.revenue_minor],
                ['Net profit', pack.profit_and_loss.net_profit_minor],
                ['Assets', pack.balance_sheet.assets_minor],
                ['Journals', pack.journals.length],
              ].map(([label, value], index) => (
                <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="font-semibold text-slate-800">
                    {index === 3 ? value : show(value)}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              {(pack.checklist_at_close || []).map((item) => (
                <div key={item.key} className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-slate-600">{item.label}</span>
                  <Badge value={item.status} tone={TONE[item.status]} />
                </div>
              ))}
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Journal</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">What caused it</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.journals.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">{entry.reference}</td>
                      <td className="px-3 py-1.5 text-slate-500">{entry.entry_date}</td>
                      <td className="px-3 py-1.5">{entry.memo || entry.source}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{show(entry.debit_minor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

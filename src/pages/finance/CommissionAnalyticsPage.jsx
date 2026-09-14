import { useCallback, useEffect, useState } from 'react';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/common/Badge';
import {
  commissionSummary, commissionBreakage, commissionCostOfSale,
  commissionLeaderboard, commissionLiability, commissionGlExport,
  listCommissionFlags, reviewCommissionFlag,
} from '../../api/commissionApi';

/**
 * What commission has cost, and what it still owes.
 *
 * ── Why the two liability figures are never added together ──────────────────
 *
 * Accrued liability is recognised and not yet vested — an obligation that
 * exists but is not payable this month. Payable is vested and not yet
 * transferred: the cheque that has to be written. One combined total overstates
 * what is due now and understates the exposure, and a finance officer reading
 * it would plan against a number that describes neither.
 *
 * ── Breakage is shown by cause, and that is the point of the panel ──────────
 *
 * "Forty million went unallocated" is not something a company can act on.
 * "Sixty percent of it was uplines who were suspended at release" is — it says
 * to look at the suspension process, or at the release schedule.
 */

const money = (minor) => (Number(minor || 0) / 100)
  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Figure({ label, value, note, tone = 'text-slate-800' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
    </div>
  );
}

export default function CommissionAnalyticsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [summary, setSummary] = useState(null);
  const [breakage, setBreakage] = useState(null);
  const [cost, setCost] = useState(null);
  const [board, setBoard] = useState([]);
  const [liability, setLiability] = useState(null);
  const [gl, setGl] = useState(null);
  const [flags, setFlags] = useState([]);
  /**
   * Which panels actually loaded.
   *
   * Without this, a failed fetch leaves the panel's state null and it renders
   * its empty copy — "Nothing has been forfeited in this period" when the truth
   * is that we could not find out. On a screen about money that is not a
   * cosmetic difference: it is a reassuring sentence with no evidence behind it.
   */
  const [loaded, setLoaded] = useState({});

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    const params = { ...(from ? { from } : {}), ...(to ? { to } : {}) };
    try {
      /**
       * Fetched together but settled individually. One report failing — a
       * malformed trace on one deal, say — must not blank the whole screen;
       * the panels that loaded are still the answer to their own question.
       */
      const [s, b, c, l, li, g, f] = await Promise.allSettled([
        commissionSummary(params), commissionBreakage(params), commissionCostOfSale(params),
        commissionLeaderboard(params), commissionLiability(params), commissionGlExport(params),
        listCommissionFlags(),
      ]);
      setSummary(s.status === 'fulfilled' ? s.value : null);
      setBreakage(b.status === 'fulfilled' ? b.value : null);
      setCost(c.status === 'fulfilled' ? c.value : null);
      setBoard(l.status === 'fulfilled' ? l.value : []);
      setLiability(li.status === 'fulfilled' ? li.value : null);
      setGl(g.status === 'fulfilled' ? g.value : null);
      setFlags(f.status === 'fulfilled' ? f.value : []);
      setLoaded({
        summary: s.status === 'fulfilled',
        breakage: b.status === 'fulfilled',
        cost: c.status === 'fulfilled',
        leaderboard: l.status === 'fulfilled',
        liability: li.status === 'fulfilled',
        gl: g.status === 'fulfilled',
        flags: f.status === 'fulfilled',
      });

      const broken = [s, b, c, l, li, g, f].filter((r) => r.status === 'rejected');
      if (broken.length) {
        setFailed(broken[0].reason?.response?.data?.message
          || `${broken.length} report(s) could not be loaded.`);
      }
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  /**
   * A verdict removes the flag from the list immediately rather than after a
   * reload. Dismissing something and watching it sit there for a second reads
   * as the action not having worked, and invites a second click.
   */
  const review = async (flag, status) => {
    setFlags((current) => current.filter((item) => item.id !== flag.id));
    try {
      await reviewCommissionFlag(flag.id, status);
    } catch (error) {
      setFlags((current) => [flag, ...current]);
      setFailed(error?.response?.data?.message || 'That verdict could not be recorded.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Commission Analytics</h1>
          <p className="text-sm text-slate-500">
            What commission has cost, what is still owed, and what was never paid out.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Input type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button type="button" variant="secondary" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Apply'}
          </Button>
        </div>
      </div>

      {failed && <div className="rounded-lg bg-warning-surface px-4 py-2 text-sm text-warning">{failed}</div>}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            label="Entitled"
            value={money(summary.entitled_minor)}
            note={`${summary.deals} deal(s), ${summary.earners} earner(s)`}
          />
          <Figure
            label="Accrued liability"
            value={money(summary.accrued_liability_minor)}
            note="Recognised, not yet vested — owed but not payable"
          />
          <Figure
            label="Payable now"
            value={money(summary.payable_minor)}
            note="Vested and not yet transferred"
            tone="text-amber-600"
          />
          <Figure
            label="Paid"
            value={money(summary.paid_minor)}
            note={cost?.blended_rate !== null && cost?.blended_rate !== undefined
              ? `Blended cost of sale: ${cost.blended_rate}%` : undefined}
            tone="text-emerald-600"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Breakage, by cause</h2>
          <p className="mb-3 text-xs text-slate-500">
            Commission that was earned but never paid, and why.
          </p>
          {breakage?.causes?.length ? (
            <div className="space-y-1 text-sm">
              {breakage.causes.map((cause) => (
                <div key={`${cause.cause}-${cause.role}`} className="flex justify-between py-1">
                  <span className="text-slate-600">
                    {cause.cause}
                    <span className="text-slate-400"> · {cause.role} · {cause.lines} line(s)</span>
                  </span>
                  <span className="font-medium">{money(cause.amount_minor)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <span>Total</span>
                <span>{money(breakage.total_minor)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              {loaded.breakage
                ? 'Nothing has been forfeited in this period.'
                : 'Could not be loaded — this does not mean nothing was forfeited.'}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Outstanding, by age</h2>
          <p className="mb-3 text-xs text-slate-500">
            Aged from the date of each sale.
          </p>
          {liability?.aged?.length ? (
            <div className="space-y-1 text-sm">
              {liability.aged.map((bucket) => (
                <div key={bucket.label} className="flex justify-between py-1">
                  <span className="text-slate-600">{bucket.label} days <span className="text-slate-400">· {bucket.lines} line(s)</span></span>
                  <span className="font-medium">{money(bucket.amount_minor)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <span>Total outstanding</span>
                <span>{money(liability.total_minor)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              {loaded.liability
                ? 'Nothing outstanding.'
                : 'Could not be loaded — this does not mean nothing is outstanding.'}
            </p>
          )}
        </div>
      </div>

      {loaded.gl && gl && (
        <div className={`rounded-lg px-4 py-2 text-sm ${gl.balanced ? 'bg-success-surface text-success' : 'bg-danger-surface text-danger'}`}>
          {gl.balanced
            ? `General ledger export balances — ${money(gl.debits_minor)} in debits against the same in credits, over ${gl.journal.length} journal line(s).`
            : `General ledger export does NOT balance: ${money(gl.debits_minor)} in debits against ${money(gl.credits_minor)} in credits.`}
          {gl.unmapped_entry_types?.length > 0 && (
            <span> Unmapped entry types: {gl.unmapped_entry_types.join(', ')} — these post nowhere and were left out.</span>
          )}
        </div>
      )}

      {flags.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            {flags.length === 1 ? '1 pattern worth a look' : `${flags.length} patterns worth a look`}
          </h2>
          <p className="mb-3 text-xs text-amber-800">
            Nothing here stopped a payment. These are patterns worth a human look — a buyer
            earning on their own purchase, accounts sharing a phone number, a referral chain that
            loops back on itself.
          </p>
          <div className="space-y-2">
            {flags.map((flag) => (
              <div key={flag.id} className="flex items-start justify-between gap-3 rounded-lg bg-white p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge value={flag.severity} />
                    <span className="text-xs font-medium text-slate-500">{flag.code}</span>
                    {flag.deal_ref && <span className="text-xs text-slate-400">· {flag.deal_ref}</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{flag.summary}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => review(flag, 'DISMISSED')}
                  >
                    Dismiss
                  </Button>
                  <Button type="button" size="sm" onClick={() => review(flag, 'CONFIRMED')}>
                    Confirm
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Who earned what</h2>
        <Table
          columns={[
            { key: 'realtor_id', label: 'Realtor' },
            { key: 'deals', label: 'Deals' },
            { key: 'earned', label: 'Earned', render: (row) => money(row.earned) },
            { key: 'paid', label: 'Paid', render: (row) => money(row.paid) },
            {
              key: 'outstanding',
              label: 'Outstanding',
              render: (row) => money(Number(row.earned || 0) - Number(row.paid || 0)),
            },
          ]}
          data={board}
          loading={loading}
          exportName="commission-leaderboard"
          emptyMessage={loaded.leaderboard
            ? 'No commission was earned in this period.'
            : 'Could not be loaded — this list is not evidence that nobody earned.'}
        />
      </div>
    </div>
  );
}

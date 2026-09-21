import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useCurrency } from '../../context/useAppearance';
import { extractError } from '../../utils/extractError';
import { statementPack, exportJournalCsv } from '../../api/accountingApi';
import { listProperties, listBranches } from '../../api/propertyApi';
import Select from '../../components/ui/Select';
import AccountDrillDown from '../../components/finance/AccountDrillDown';

/**
 * The statements a company files from.
 *
 * ── Whether it can be relied on comes first ─────────────────────────────────
 *
 * Four reconciliations sit above the numbers rather than in a footnote: does
 * the trial balance balance, does the balance sheet balance, does the cash
 * flow reconcile to the bank, does the aged receivables agree with its control
 * account. A statement that fails one of them is not a statement with a small
 * problem — it is a statement that cannot be used, and a reader should not
 * have to scroll to find that out.
 *
 * ── One read, not six ───────────────────────────────────────────────────────
 *
 * Every figure here comes from a single request. Six requests can straddle a
 * posting, and a balance sheet that includes a journal the profit and loss
 * above it does not is the kind of inconsistency nobody ever traces.
 *
 * ── The export is not a convenience ─────────────────────────────────────────
 *
 * It is the answer to "what happens if we leave", which is a fair question to
 * ask of a system being trusted with statutory books. It is also the first
 * thing an external auditor asks for, and it reads back in through the same
 * import it came out of.
 */

const TABS = [
  ['pl', 'Profit and loss'],
  ['bs', 'Balance sheet'],
  ['cf', 'Cash flow'],
  ['tb', 'Trial balance'],
  ['tax', 'VAT and withholding'],
  ['ar', 'Aged receivables'],
];

const startOfYear = () => `${new Date().getFullYear()}-01-01`;
const todayIso = () => new Date().toISOString().slice(0, 10);

/** A reconciliation, stated plainly. */
function Check({ ok, label, detail }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
      ok ? 'bg-green-50 text-green-800' : 'bg-danger-surface text-danger'
    }`}
    >
      <span aria-hidden="true">{ok ? '✓' : '✕'}</span>
      <span>
        {label}
        {!ok && detail ? <span className="block font-medium">{detail}</span> : null}
      </span>
    </div>
  );
}

export default function StatementsPage() {
  const fmt = useCurrency();
  const show = useMemo(() => (minor) => fmt(Number(minor || 0) / 100), [fmt]);

  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(todayIso());
  const [tab, setTab] = useState('pl');
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [csv, setCsv] = useState('');
  const [properties, setProperties] = useState([]);
  const [branches, setBranches] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [branchId, setBranchId] = useState('');
  /*
   * The account a reader has clicked on, which the drill-down reads from.
   * ACC-5.1: a figure nobody can trace back to a document is a report rather
   * than a set of books.
   */
  const [drilling, setDrilling] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      setPack(await statementPack({
        from,
        to,
        property_id: propertyId || undefined,
        branch_id: branchId || undefined,
      }));
    } catch (error) {
      setFailed(extractError(error, 'The statements could not be produced.'));
    } finally {
      setLoading(false);
    }
  }, [from, to, propertyId, branchId]);

  useEffect(() => { load(); }, [load]);

  /*
   * Picked from a list, never typed. An id typed by hand is an id somebody
   * gets wrong, and a profit and loss filtered to the wrong project looks
   * exactly like a profit and loss.
   */
  useEffect(() => {
    listProperties({ limit: 200 })
      .then((response) => setProperties(response?.data ?? response ?? []))
      .catch(() => setProperties([]));
    listBranches({ limit: 'all' })
      .then((response) => setBranches(Array.isArray(response) ? response : (response?.data ?? [])))
      .catch(() => setBranches([]));
  }, []);

  const checks = pack?.checks;

  /**
   * One account, as a row — and the way into the journals behind it.
   *
   * The whole row is the target rather than a separate "view" link: the figure
   * IS the question somebody wants to ask about, so it is the thing to click.
   */
  const line = (row, previous = false) => (
    <tr
      key={row.account_id}
      onClick={() => setDrilling(row)}
      title="See the journals behind this"
      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
    >
      <td className="px-3 py-1.5 text-slate-500">{row.code}</td>
      <td className="px-3 py-1.5">{row.name}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{show(row.balance_minor)}</td>
      {previous && (
        <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
          {row.previous_minor == null ? '—' : show(row.previous_minor)}
        </td>
      )}
    </tr>
  );

  const total = (label, value, { strong = false, previous = null, hasPrevious = false } = {}) => (
    <tr className={`border-t ${strong ? 'border-slate-300 font-semibold' : 'border-slate-200'}`}>
      <td className="px-3 py-1.5" colSpan={2}>{label}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{show(value)}</td>
      {hasPrevious && (
        <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
          {previous == null ? '—' : show(previous)}
        </td>
      )}
    </tr>
  );

  const table = (children, { hasPrevious = false } = {}) => (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Code</th>
            <th className="px-3 py-2 text-left">Account</th>
            <th className="px-3 py-2 text-right">This period</th>
            {hasPrevious && <th className="px-3 py-2 text-right">Last year</th>}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );

  const pl = pack?.profit_and_loss;
  const bs = pack?.balance_sheet;
  const cf = pack?.cash_flow;
  const hasPrevious = Boolean(pl?.previous);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Statements</h1>
          <p className="text-sm text-slate-500">
            Every figure is a query over the journal — there is no second copy to drift from it.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            setFailed('');
            try {
              setCsv(await exportJournalCsv({ from, to }));
            } catch (error) {
              setFailed(extractError(error, 'The journal could not be exported.'));
            }
          }}
        >
          Export the journal
        </Button>
      </div>

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Project</span>
          <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Every project</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.name}</option>
            ))}
          </Select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Branch</span>
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Every branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </Select>
        </label>
        <Button variant="secondary" onClick={load} disabled={loading}>
          {loading ? 'Reading…' : 'Refresh'}
        </Button>
      </div>

      {/*
        Said out loud, because a filtered statement looks exactly like an
        unfiltered one — and because the filter reaches ONE tab. A balance
        sheet per project would be a fiction: work in progress divides by
        project, the bank account does not. Naming the reach beats letting
        somebody assume it.
      */}
      {(propertyId || branchId) && (
        <div className="rounded-lg bg-blue-50 px-4 py-2 text-xs text-blue-800">
          The <strong>profit and loss</strong> below covers only{' '}
          {propertyId && <strong>{properties.find((p) => String(p.id) === propertyId)?.name}</strong>}
          {propertyId && branchId && ' · '}
          {branchId && <strong>{branches.find((b) => String(b.id) === branchId)?.name}</strong>}
          . Every other tab is company-wide: a balance sheet or a cash flow for one project would
          have to divide a bank account between projects, which cannot be done.
        </div>
      )}

      {checks && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Check
            ok={checks.trial_balance_balanced}
            label="Trial balance balances"
            detail={`out by ${show(pack.trial_balance.difference_minor)}`}
          />
          <Check
            ok={checks.balance_sheet_balanced}
            label="Balance sheet balances"
            detail={`out by ${show(bs.difference_minor)}`}
          />
          <Check
            ok={checks.cash_flow_reconciles}
            label="Cash flow reconciles to the bank"
            detail={`out by ${show(cf.difference_minor)}`}
          />
          <Check
            ok={checks.receivables_reconcile}
            label="Receivables agree with the ledger"
            detail={`out by ${show(pack.aged_receivables.difference_minor)}`}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="py-8 text-center text-sm text-slate-500">Reading the journal…</p>}

      {!loading && tab === 'pl' && pl && table(
        <>
          {pl.income.map((row) => line(row, hasPrevious))}
          {total('Revenue', pl.revenue_minor, {
            previous: pl.previous?.revenue_minor, hasPrevious,
          })}
          {pl.cost_of_sales.map((row) => line(row, hasPrevious))}
          {total('Cost of sales', pl.cost_of_sales_minor, {
            previous: pl.previous?.cost_of_sales_minor, hasPrevious,
          })}
          {total('Gross profit', pl.gross_profit_minor, {
            strong: true, hasPrevious, previous: pl.previous ? pl.previous.revenue_minor - pl.previous.cost_of_sales_minor : null,
          })}
          {pl.overheads.map((row) => line(row, hasPrevious))}
          {total('Overheads', pl.overheads_minor, {
            previous: pl.previous?.overheads_minor, hasPrevious,
          })}
          {total('Net profit', pl.net_profit_minor, {
            strong: true, previous: pl.previous?.net_profit_minor, hasPrevious,
          })}
        </>,
        { hasPrevious },
      )}

      {!loading && tab === 'bs' && bs && table(
        <>
          {bs.assets.map((row) => line(row))}
          {total('Assets', bs.assets_minor, { strong: true })}
          {bs.liabilities.map((row) => line(row))}
          {total('Liabilities', bs.liabilities_minor, { strong: true })}
          {bs.equity.map((row) => line(row))}
          {/*
            Shown as its own line because it is the one figure here that is not
            an account balance. Computed from the same journal the profit and
            loss was, which is why the two can never disagree.
          */}
          <tr className="border-t border-slate-100">
            <td className="px-3 py-1.5 text-slate-500">—</td>
            <td className="px-3 py-1.5">
              Earnings not yet closed to retained earnings
              <span className="block text-xs text-slate-500">
                Computed from the journal, not stored
              </span>
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums">
              {show(bs.earnings_not_yet_closed_minor)}
            </td>
          </tr>
          {total('Equity', bs.equity_minor, { strong: true })}
        </>,
      )}

      {!loading && tab === 'cf' && cf && (
        <div className="space-y-3">
          {table(
            <>
              {total('Profit for the period', cf.profit_minor, { strong: true })}
              {cf.operating.lines.map((row) => (
                <tr
                  key={row.account_id}
                  onClick={() => setDrilling(row)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-1.5 text-slate-500">{row.code}</td>
                  <td className="px-3 py-1.5">{row.name}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{show(row.cash_effect_minor)}</td>
                </tr>
              ))}
              {total('Cash from operations', cf.operating_total_minor, { strong: true })}
              {cf.investing.lines.map((row) => (
                <tr
                  key={row.account_id}
                  onClick={() => setDrilling(row)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-1.5 text-slate-500">{row.code}</td>
                  <td className="px-3 py-1.5">{row.name}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{show(row.cash_effect_minor)}</td>
                </tr>
              ))}
              {total('Investing', cf.investing.total_minor)}
              {cf.financing.lines.map((row) => (
                <tr
                  key={row.account_id}
                  onClick={() => setDrilling(row)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-1.5 text-slate-500">{row.code}</td>
                  <td className="px-3 py-1.5">{row.name}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{show(row.cash_effect_minor)}</td>
                </tr>
              ))}
              {total('Financing', cf.financing.total_minor)}
              {total('Movement in cash', cf.net_movement_minor, { strong: true })}
            </>,
          )}
          <p className="text-xs text-slate-500">
            The bank actually moved by {show(cf.cash_movement_minor)}.
            {cf.reconciles
              ? ' The two agree, which is what makes the sections above trustworthy.'
              : ` They differ by ${show(cf.difference_minor)} — an account this statement has not been taught how to classify.`}
          </p>
        </div>
      )}

      {!loading && tab === 'tb' && pack?.trial_balance && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {pack.trial_balance.accounts.map((row) => (
                <tr
                  key={row.account_id}
                  onClick={() => setDrilling(row)}
                  title="See the journals behind this"
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-1.5 text-slate-500">{row.code}</td>
                  <td className="px-3 py-1.5">{row.name}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.debit_minor ? show(row.debit_minor) : ''}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.credit_minor ? show(row.credit_minor) : ''}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <td className="px-3 py-1.5" colSpan={2}>Total</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{show(pack.trial_balance.debit_minor)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{show(pack.trial_balance.credit_minor)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'tax' && pack && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 font-semibold text-slate-800">VAT return</h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt>Output tax on sales</dt><dd className="tabular-nums">{show(pack.vat_return.output_tax_minor)}</dd></div>
              <div className="flex justify-between"><dt>Input tax on bills</dt><dd className="tabular-nums">{show(pack.vat_return.input_tax_minor)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
                <dt>Net payable</dt><dd className="tabular-nums">{show(pack.vat_return.net_payable_minor)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              Output tax follows the tax point — the invoice — not when the sale was recognised.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 font-semibold text-slate-800">Withholding to remit</h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt>Withheld</dt><dd className="tabular-nums">{show(pack.withholding.withheld_minor)}</dd></div>
              <div className="flex justify-between"><dt>Already remitted</dt><dd className="tabular-nums">{show(pack.withholding.remitted_minor)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
                <dt>Still to pay over</dt><dd className="tabular-nums">{show(pack.withholding.outstanding_minor)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              Deducted from suppliers and realtors. It is the revenue service&apos;s money from the
              moment it was withheld.
            </p>
          </div>
        </div>
      )}

      {!loading && tab === 'ar' && pack?.aged_receivables && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Buyer</th>
                {pack.aged_receivables.buckets.map((bucket) => (
                  <th key={bucket} className="px-3 py-2 text-right">
                    {bucket.replace(/_/g, ' ').replace('days ', '')}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {pack.aged_receivables.clients.map((row) => (
                <tr key={row.client_id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{row.client_name}</td>
                  {pack.aged_receivables.buckets.map((bucket) => (
                    <td key={bucket} className="px-3 py-1.5 text-right tabular-nums">
                      {row[bucket] ? show(row[bucket]) : ''}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{show(row.total_minor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AccountDrillDown
        account={drilling}
        from={from}
        to={to}
        onClose={() => setDrilling(null)}
      />

      {/*
        The CSV is shown rather than downloaded. A page cannot start its own
        download here, and offering a link that silently does nothing is worse
        than showing the text and letting somebody copy it.
      */}
      {csv && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              The journal, {from} to {to}
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigator.clipboard?.writeText(csv)}
              >
                Copy
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setCsv('')}>Close</Button>
            </div>
          </div>
          <pre className="max-h-80 overflow-auto rounded bg-slate-50 p-3 text-xs">{csv}</pre>
          <p className="text-xs text-slate-500">
            These are the columns the journal import reads, so this file goes back in where it came
            out.
          </p>
        </div>
      )}
    </div>
  );
}

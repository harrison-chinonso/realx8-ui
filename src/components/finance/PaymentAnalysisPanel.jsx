import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPaymentAnalysis } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';
import { openReceipt } from '../../utils/receiptDocument';
import Badge from '../common/Badge';
import SummaryTile from '../dashboard/SummaryTile';
import { STATE_TONE, STATE_LABEL } from '../../utils/invoiceState';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'due', label: 'Due' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Paid' },
];



const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * Invoices and payments for one user.
 *
 * Used both as the client's own "My Payments" page and as the body of the
 * Payment Analysis drill-down an admin or upline realtor opens from a client
 * list — the same figures either way, from one endpoint that authorises the
 * caller against the target.
 *
 * `linkInvoices` is off inside the drill-down: an admin looking at someone
 * else's record should not be sent into that client's invoice screen.
 *
 * `show` picks which halves render — the client's menu splits invoices and
 * payments onto separate pages, while the drill-down shows both together.
 *
 * `afterSummary` is rendered between the totals and the body. It exists because
 * the client's payments page needs its own submissions to sit UNDER the summary
 * and OVER the table, and both of those are inside this component — so ordering
 * them as siblings of the panel is not possible, and rendering the panel twice
 * would fetch the same endpoint twice.
 */
export default function PaymentAnalysisPanel({
  userId, linkInvoices = false, initialTab = 'all', show = 'both', afterSummary = null,
}) {
  const showInvoices = show === 'both' || show === 'invoices';
  const showPayments = show === 'both' || show === 'payments';
  const fmt = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(initialTab);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    getPaymentAnalysis(userId)
      .then((res) => { if (!cancelled) setData(res?.data ?? null); })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.userMessage || 'Could not load payment records.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    // Ignore a response that lands after the panel moved to another user.
    return () => { cancelled = true; };
  }, [userId]);

  const invoices = useMemo(() => {
    const rows = data?.invoices || [];
    return tab === 'all' ? rows : rows.filter((row) => row.state === tab);
  }, [data, tab]);

  if (loading) return <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading payment records…</div>;
  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!data) return null;

  const t = data.totals;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Total Invoiced" value={fmt(t.invoiced.amount)} sub={`${t.invoiced.count} invoices`} accent />
        <SummaryTile label="Paid" value={fmt(t.paid.amount)} sub={`${t.paid.count} settled`} />
        <SummaryTile label="Due" value={fmt(t.due.amount)} sub={`${t.due.count} overdue`} />
        <SummaryTile label="Pending" value={fmt(t.pending.amount)} sub={`${t.pending.count} not yet due`} />
      </div>

      {afterSummary}

      {showInvoices && (
      <div>
        <div className="mb-2 flex flex-wrap gap-1 border-b border-slate-200">
          {TABS.map((item) => {
            const isActive = item.key === tab;
            const count = item.key === 'all'
              ? (data.invoices || []).length
              : (data.invoices || []).filter((row) => row.state === item.key).length;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                style={isActive ? { borderColor: 'var(--primary, #2563eb)' } : undefined}
              >
                {item.label} <span className="text-xs text-slate-400">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Invoice</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Property</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Amount</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Paid</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Balance</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Due date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">State</th>
                {/* Only where the invoice is reachable. In the admin drill-down
                    `linkInvoices` is off, because an admin inspecting someone
                    else's record should not be sent into that client's screens. */}
                {linkInvoices && <th className="px-4 py-3 text-right font-semibold text-slate-600">&nbsp;</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {linkInvoices
                      ? <Link to={`/finance/invoices/${row.id}`} className="hover:underline" style={{ color: 'var(--primary)' }}>{row.invoice_id}</Link>
                      : row.invoice_id}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.property_name || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmt(row.amount)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{fmt(row.paid)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(row.balance)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.due_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE_TONE[row.state] || 'bg-slate-100 text-slate-600'}`}>
                      {STATE_LABEL[row.state] || row.state}
                    </span>
                  </td>
                  {/*
                    * An explicit button as well as the linked reference.
                    *
                    * The reference was already a link, but a coloured invoice
                    * number reads as a label rather than a control — nobody
                    * knew it was clickable. This says so.
                    */}
                  {linkInvoices && (
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/finance/invoices/${row.id}`}
                        className="inline-flex whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                        style={{ color: 'var(--primary)' }}
                      >
                        View details
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
              {!invoices.length && (
                <tr>
                  <td colSpan={linkInvoices ? 8 : 7} className="px-4 py-8 text-center text-slate-500">
                    {tab === 'all' ? 'No invoices yet.' : `No ${tab} invoices.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {showPayments && (
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Payments</p>
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Invoice</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Method</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Note</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.payments || []).map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.invoice_ref}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(row.amount)}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{String(row.payment_method || '').replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3"><Badge value={row.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{row.note || '—'}</td>
                  {/*
                    The company's own receipt where one was attached, and a
                    generated one carrying the property, the unit and the
                    balance where none was — see utils/receiptDocument. The
                    column is quiet only for a payment that has no receipt to
                    give, which now means one that was never approved.
                  */}
                  <td className="px-4 py-3">
                    {row.receipt_id || row.company_receipt_url ? (
                      <button
                        type="button"
                        onClick={() => openReceipt(
                          { id: row.receipt_id, company_receipt_url: row.company_receipt_url },
                        )}
                        className="text-sm font-medium hover:underline"
                        style={{ color: 'var(--primary)' }}
                      >
                        Receipt
                      </button>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
              {!(data.payments || []).length && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No payments recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

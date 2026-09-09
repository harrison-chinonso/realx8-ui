import { useEffect, useState } from 'react';
import { getReferralEarnings } from '../../api/userApi';
import { useCurrency } from '../../context/useAppearance';
import Modal from './Modal';
import Badge from './Badge';
import SummaryTile from '../dashboard/SummaryTile';

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');

/**
 * What one referral has earned this realtor, and what they bought.
 *
 * Only the id is passed in; the figures are re-fetched from the server, which
 * also decides whether this viewer may see them.
 */
export default function ReferralEarningsModal({ user, open, onClose }) {
  const fmt = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !user?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    getReferralEarnings(user.id)
      .then((res) => { if (!cancelled) setData(res?.data ?? null); })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.userMessage || 'Could not load these earnings.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    // Drop a response that lands after the modal moved to another referral.
    return () => { cancelled = true; };
  }, [open, user?.id]);

  return (
    <Modal open={open} onClose={onClose} title={user?.name ? `Earnings from ${user.name}` : 'Referral Earnings'} size="xl">
      {loading && <div className="py-10 text-center text-sm text-slate-500">Loading…</div>}
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {data && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="Commission Earned" value={fmt(data.totals.commission.total)} sub={`${data.totals.commission.count} entries`} accent />
            <SummaryTile label="Paid" value={fmt(data.totals.commission.paid)} />
            <SummaryTile label="Unpaid" value={fmt(data.totals.commission.unpaid)} />
            <SummaryTile label="They Purchased" value={fmt(data.totals.purchases.value)} sub={`${data.totals.purchases.count} purchases`} />
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Commissions from this referral</p>
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Paid on</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.commissions.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(row.amount)}</td>
                      <td className="px-4 py-3"><Badge value={row.status} /></td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(row.payment_date)}</td>
                    </tr>
                  ))}
                  {!data.commissions.length && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No commission has been recorded from this referral yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">What they purchased</p>
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Property</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Unit</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Mode</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Invoice</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.purchases.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.property_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.unit_label || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(row.amount)}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">{row.payment_mode || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.invoice_ref || '—'}</td>
                      <td className="px-4 py-3"><Badge value={row.status} /></td>
                    </tr>
                  ))}
                  {!data.purchases.length && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">This referral has not purchased anything yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

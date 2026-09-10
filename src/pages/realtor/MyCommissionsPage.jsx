import { useCallback, useEffect, useState } from 'react';
import { getMyCommissions, requestCommissionPayout } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import { enumLabel } from '../../utils/enumLabel';

const getData = (response) => response?.data ?? response ?? null;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

/**
 * What a realtor has earned, and how they ask to be paid.
 *
 * Commissions arrive here on their own — one is created when a sale they
 * introduced completes, not when anyone remembers to raise it. So this page is
 * a record rather than a form, with exactly one action on it: request payment
 * of a commission that is still CREATED.
 *
 * The request is for the whole amount. There is no field for a figure because
 * a commission is a single obligation — asking for part of one would leave a
 * remainder with no due date and nothing tracking it.
 */
const STAGE_HELP = {
  created: 'Yours to request whenever you are ready.',
  payment_requested: 'Waiting on an administrator to approve.',
  approved: 'Approved — waiting to be paid out.',
  paid: 'Paid in full.',
  cancelled: 'Cancelled.',
};

export default function MyCommissionsPage() {
  const fmt = useCurrency();
  const [commissions, setCommissions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requesting, setRequesting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getMyCommissions()
      .then((response) => {
        setCommissions(getData(response) || []);
        setSummary(response?.summary ?? null);
        setError('');
      })
      .catch((err) => setError(err?.response?.data?.message || 'Could not load your commissions.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitRequest = async () => {
    setBusy(true);
    try {
      await requestCommissionPayout(requesting.id);
      setNotice(`Payment of ${fmt(requesting.amount)} requested. An administrator will review it.`);
      setRequesting(null);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not request payment.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading your commissions…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Commissions</h1>
        <p className="text-sm text-slate-500">
          Commissions are created automatically when a sale you introduced completes.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</p>}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Available to request', value: summary.requestable, tone: 'text-slate-900' },
            { label: 'In progress', value: summary.in_progress, tone: 'text-amber-700' },
            { label: 'Paid to date', value: summary.paid, tone: 'text-emerald-700' },
          ].map((tile) => (
            <div key={tile.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{tile.label}</div>
              <div className={`mt-1 text-lg font-semibold ${tile.tone}`}>{fmt(tile.value || 0)}</div>
            </div>
          ))}
        </div>
      )}

      {!commissions.length ? (
        <p className="rounded-xl bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          You have no commissions yet. One is created for you when a sale you introduced is paid in full.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Commission</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Earned</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commissions.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.title}</div>
                      <div className="text-xs text-slate-500">
                        {enumLabel(row.type)}
                        {row.basis_amount ? ` on ${fmt(row.basis_amount)}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(row.amount || 0)}</td>
                    <td className="px-4 py-3">
                      <Badge value={row.status} />
                      <div className="mt-1 text-xs text-slate-500">{STAGE_HELP[row.status] || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.createdAt || row.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {/* The one action: only a CREATED commission is the
                          earner's to move, and only for its full amount. */}
                      {row.status === 'created' && (
                        <Button type="button" onClick={() => setRequesting(row)}>Request payment</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {requesting && (
        <Modal open onClose={() => !busy && setRequesting(null)} title="Request payment" size="sm">
          <div className="space-y-4 text-sm">
            <p className="text-slate-600">
              Request payment of <strong>{fmt(requesting.amount)}</strong> for &ldquo;{requesting.title}&rdquo;?
            </p>
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Commissions are paid in full — there is no partial payout. An administrator approves the
              request, and you will be notified when it is paid.
            </p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setRequesting(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" onClick={submitRequest} disabled={busy}>
                {busy ? 'Requesting…' : 'Request payment'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

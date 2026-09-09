import { useEffect, useMemo, useState } from 'react';
import { listMyClients } from '../../api/userApi';
import Badge from '../../components/common/Badge';
import ActionsMenu from '../../components/common/ActionsMenu';
import Input from '../../components/ui/Input';
import UserSummaryModal from '../../components/common/UserSummaryModal';
import PaymentAnalysisModal from '../../components/common/PaymentAnalysisModal';

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');

/**
 * The realtor's own clients, with the same two drill-downs an admin gets.
 *
 * Both modals re-fetch from the server, which independently checks that this
 * realtor may view that client — the list is a convenience, not the guard.
 */
export default function MyClientsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [summaryFor, setSummaryFor] = useState(null);
  const [paymentsFor, setPaymentsFor] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listMyClients()
      .then((res) => { if (!cancelled) setRows(res?.data ?? []); })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.userMessage || 'Could not load your clients.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [row.name, row.email, row.phone]
      .some((field) => String(field || '').toLowerCase().includes(term)));
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">My Clients</h1>
          <p className="text-sm text-slate-500">Clients referred to you or assigned to you.</p>
        </div>
        <div className="w-full max-w-xs">
          <Input placeholder="Search name, email or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">Loading clients…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Phone</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Joined</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3"><Badge value={row.is_active ? 'active' : 'inactive'} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <ActionsMenu
                        items={[
                          { label: '📊 Business Analysis', onClick: () => setSummaryFor(row) },
                          { label: '💳 Payment Analysis', onClick: () => setPaymentsFor(row) },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    {query ? 'No clients match your search.' : 'No clients are linked to you yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <UserSummaryModal user={summaryFor} open={!!summaryFor} onClose={() => setSummaryFor(null)} />
      <PaymentAnalysisModal user={paymentsFor} open={!!paymentsFor} onClose={() => setPaymentsFor(null)} />
    </div>
  );
}

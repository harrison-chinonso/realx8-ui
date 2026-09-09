import Badge from '../common/Badge';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

/** Most recent transactions — date, amount, status. */
export default function TransactionHistory({ title = 'Recent Transactions', rows = [], fmt, emptyText }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Description</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Amount</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{formatDate(row.date)}</td>
                <td className="max-w-xs truncate px-4 py-2.5 text-slate-700" title={row.title}>{row.title}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-slate-900">{fmt(row.amount)}</td>
                <td className="px-4 py-2.5"><Badge value={row.status} /></td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">{emptyText || 'No transactions yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

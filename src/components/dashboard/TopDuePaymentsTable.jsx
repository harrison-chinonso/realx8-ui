import { Link } from 'react-router-dom';

const fmtDate = (raw) => {
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getDateVal = (item, keys) => {
  for (const k of keys) { if (item?.[k]) return item[k]; }
  return null;
};

export default function TopDuePaymentsTable({ invoices = [], fmt }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Top Due Payments</h2>
          <p className="text-xs text-slate-400">Highest outstanding balances first</p>
        </div>
        <Link
          to="/finance/invoices?status=unpaid"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          View All Due →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">ID Ref</th>
              <th className="pb-2 pr-3">Name</th>
              <th className="pb-2 pr-3">Due Date</th>
              <th className="pb-2 text-right">Due Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoices.map((inv) => {
              const ref = inv.invoice_id || inv.invoice_number || inv.id || '—';
              const formattedRef = typeof ref === 'string' && ref.startsWith('#') ? ref : `#${ref}`;
              const customer =
                inv.client?.name || inv.customer_name || inv.client_name || '—';
              const dueDate = getDateVal(inv, ['due_date', 'dueDate']);
              const isOverdue = inv.status === 'overdue';
              return (
                <tr key={inv.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 pr-3">
                    <span className="font-mono text-xs font-semibold text-slate-500">{formattedRef}</span>
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">{customer}</td>
                  <td className={`py-2.5 pr-3 text-xs ${isOverdue ? 'font-semibold text-rose-500' : 'text-slate-500'}`}>
                    {fmtDate(dueDate)}
                    {isOverdue && <span className="ml-1 inline-block rounded bg-rose-100 px-1 py-0.5 text-[9px] font-bold text-rose-600">OVERDUE</span>}
                  </td>
                  <td className="py-2.5 text-right font-bold text-rose-600">{fmt(inv.amount || 0)}</td>
                </tr>
              );
            })}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-slate-400">No outstanding payments</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

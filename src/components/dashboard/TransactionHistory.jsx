import Badge from '../common/Badge';
import { DASHBOARD_ROWS, capRows } from './dashboardRows';
import { openReceipt } from '../../utils/receiptDocument';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

/** Most recent transactions — date, amount, status. */
export default function TransactionHistory({
  title = 'Recent Transactions', rows = [], fmt, emptyText, limit = DASHBOARD_ROWS,
}) {
  const shown = capRows(rows, limit);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Date</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-600">What for</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Amount</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Status</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{formatDate(row.date)}</td>
                {/*
                  The property and unit, not the invoice reference.
                  A buyer recognises what they bought by the estate and the
                  plot; the reference is the company's own paperwork, and
                  asking somebody to match a code they never memorised is work
                  the table should be doing for them. It is still shown
                  underneath, smaller, for anyone quoting it to support.
                */}
                <td className="max-w-xs px-4 py-2.5 text-slate-700">
                  <div className="truncate" title={row.property_name || row.title}>
                    {row.property_name
                      ? (
                        <>
                          {row.property_name}
                          {row.unit_name && <span className="text-slate-500"> · {row.unit_name}</span>}
                        </>
                      )
                      : row.title}
                  </div>
                  {(row.reference || row.invoice_ref) && (
                    <div className="truncate text-xs text-slate-400">
                      {row.reference || row.invoice_ref}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-slate-900">{fmt(row.amount)}</td>
                <td className="px-4 py-2.5"><Badge value={row.status} /></td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {/*
                    Every approved payment has a receipt, not only the ones an
                    admin attached a file to. A dash here used to mean "no
                    receipt", which a buyer reasonably read as "this payment was
                    not properly recorded" — see utils/receiptDocument.
                  */}
                  {row.status === 'verified' ? (
                    <button
                      type="button"
                      onClick={() => openReceipt(row)}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--primary)' }}
                    >
                      Receipt
                    </button>
                  ) : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{emptyText || 'No transactions yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

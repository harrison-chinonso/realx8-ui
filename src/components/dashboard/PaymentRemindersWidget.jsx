const fmtDate = (raw) => {
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

function PriorityDot({ days }) {
  if (days === null || days === undefined) return <span className="h-2 w-2 rounded-full bg-slate-300 inline-block" />;
  if (days < 0) return <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" title="Overdue" />;
  if (days <= 7) return <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" title={`${days}d left`} />;
  return <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" title={`${days}d left`} />;
}

export default function PaymentRemindersWidget({ reminders = [], fmt }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Payment Reminders</h2>
        <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> &gt;7 days</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> 1–7 days</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500 inline-block" /> Overdue</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-2 w-5" />
              <th className="pb-2 pr-3">Customer</th>
              <th className="pb-2 pr-3">Invoice Ref</th>
              <th className="pb-2 pr-3">Due Date</th>
              <th className="pb-2 pr-3">Days</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {reminders.map((r, i) => {
              const customer = r.client?.name || r.customer_name || r.client_name || '—';
              const ref = r.invoice_id || r.invoice?.invoice_number || r.reference || '—';
              const days = r.daysLeft;
              return (
                <tr key={r.id || i} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 pr-2">
                    <PriorityDot days={days} />
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-slate-800 max-w-[100px] truncate">{customer}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{ref}</td>
                  <td className="py-2.5 pr-3 text-xs text-slate-500">{fmtDate(r.dueDate)}</td>
                  <td className={`py-2.5 pr-3 text-xs font-semibold ${days === null ? 'text-slate-400' : days < 0 ? 'text-rose-500' : days <= 7 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {days === null ? '—' : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-800">{fmt(r.amount || 0)}</td>
                </tr>
              );
            })}
            {reminders.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-slate-400">No upcoming reminders</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

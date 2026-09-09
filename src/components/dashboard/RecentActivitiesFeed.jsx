import { Link } from 'react-router-dom';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export default function RecentActivitiesFeed({ activities = [], recentSales = [], fmt }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {/* Activity Timeline */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
          <Link to="/notifications" className="text-xs font-medium text-blue-600 hover:underline">View all →</Link>
        </div>
        <div className="space-y-3">
          {activities.slice(0, 8).map((a, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm">
                {a.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-700 leading-relaxed">{a.label}</p>
                <p className="text-[10px] text-slate-400">
                  {a.date ? a.date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
              </div>
            </div>
          ))}
          {activities.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">No recent activity</p>
          )}
        </div>
      </section>

      {/* Recent Sales */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Sales</h2>
          <Link to="/finance/transactions" className="text-xs font-medium text-blue-600 hover:underline">View all →</Link>
        </div>
        <div className="space-y-2">
          {recentSales.map((s, i) => {
            const title = s.title || s.property_name || s.name || `Invoice #${s.id}`;
            const client = s.client?.name || s.customer_name || s.client_name || '—';
            const date = s.createdAt || s.created_at;
            return (
              <div key={s.id || i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <span className="text-base">🏠</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate">{title}</p>
                  <p className="text-[10px] text-slate-400">{client} · {fmtDate(date)}</p>
                </div>
                {s.amount && (
                  <span className="shrink-0 text-xs font-bold text-emerald-600">{fmt(s.amount)}</span>
                )}
              </div>
            );
          })}
          {recentSales.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">No recent sales in this period</p>
          )}
        </div>
      </section>
    </div>
  );
}

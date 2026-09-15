import { Link } from 'react-router-dom';
import { DASHBOARD_ROWS, capRows } from './dashboardRows';
import { Trophy } from 'lucide-react';

const MEDALS = ['🥇', '🥈', '🥉'];

const day = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export default function RealtorLeaderboard({ realtors = [], fmt, period, range, limit = DASHBOARD_ROWS }) {
  const rows = capRows(realtors, limit);
  // "LAST WEEK" alone does not say which week. Next to a zero that is
  // indistinguishable from missing data, so the actual dates are spelled out.
  const from = day(range?.from);
  const to = day(range?.to);
  const span = from && to ? (from === to ? from : `${from} – ${to}`) : null;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-900">Sales by Realtor</h2>
          {/* Every figure here is scoped to the dashboard's date filter. Without
              saying so, a realtor who sold last week reads as having sold
              nothing at all. */}
          {period && (
            <span
              title={span ? `${period}: ${span}` : period}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              {period}{span ? ` · ${span}` : ''}
            </span>
          )}
        </div>
        <Link to="/crm/agent-performance" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          Full Leaderboard →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-2">#</th>
              <th className="pb-2 pr-3">Realtor</th>
              <th className="pb-2 pr-3">Sold</th>
              <th className="pb-2 pr-3">Revenue</th>
              <th className="pb-2 pr-3">Referrals</th>
              <th className="pb-2 text-right">Conv %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r, i) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-2.5 pr-2 text-base">{MEDALS[i] || <span className="text-xs font-bold text-slate-400">{i + 1}</span>}</td>
                <td className="py-2.5 pr-3 font-medium text-slate-800">{r.name}</td>
                <td className="py-2.5 pr-3 font-bold text-slate-900">{r.sold}</td>
                <td className="py-2.5 pr-3 text-xs text-slate-600">{fmt(r.revenue)}</td>
                <td className="py-2.5 pr-3 text-xs text-slate-500">{r.referrals}</td>
                <td className="py-2.5 text-right">
                  {/* No assigned leads means there is no ratio to show. Printing
                      0% there would read as failure for a realtor selling to
                      walk-in referrals. */}
                  {r.conversionRate === null || r.conversionRate === undefined ? (
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">—</span>
                  ) : (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${Number(r.conversionRate) >= 50 ? 'bg-emerald-100 text-emerald-700' : Number(r.conversionRate) >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {r.conversionRate}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {realtors.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-slate-400">No realtor performance data for this period</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

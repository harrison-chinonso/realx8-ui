import { Link } from 'react-router-dom';
import Badge from '../common/Badge';

const LEAD_STATUSES = ['draft', 'sent', 'open', 'declined'];
const LEAD_COLORS = { draft: '#94a3b8', sent: '#3b82f6', open: '#10b981', declined: '#ef4444' };

export default function LeadStatusPanel({ statusMap = {}, totalLeads = 0 }) {
  const max = Math.max(...Object.values(statusMap), 1);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Lead Status</h2>
          <p className="text-xs text-slate-400">{totalLeads} total leads in range</p>
        </div>
        <Link
          to="/crm/leads"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          View Report →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {LEAD_STATUSES.map((status) => {
          const count = statusMap[status] || 0;
          const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
          const barPct = (count / max) * 100;
          const color = LEAD_COLORS[status];
          return (
            <div key={status} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium capitalize text-slate-700">{status}</span>
                <Badge value={status} />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900">{pct}%</span>
                <span className="text-xs text-slate-400">({count})</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${barPct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

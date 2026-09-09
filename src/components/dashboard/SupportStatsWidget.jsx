import { Link } from 'react-router-dom';
import { HeadphonesIcon } from 'lucide-react';

export default function SupportStatsWidget({ open = 0, closed = 0, escalated = 0, total = 0, avgResolutionHours = 'N/A' }) {
  const slaRate = total > 0 ? (((closed) / total) * 100).toFixed(0) : '0';
  const csatScore = '—'; // Would require separate CSAT API

  const stats = [
    { label: 'Open Tickets',       value: open,              color: 'text-amber-600',   bg: 'bg-amber-50'  },
    { label: 'Closed Tickets',     value: closed,            color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Escalated',          value: escalated,         color: 'text-rose-600',    bg: 'bg-rose-50'   },
    { label: 'SLA Compliance',     value: `${slaRate}%`,     color: 'text-blue-600',    bg: 'bg-blue-50'   },
    { label: 'Avg Resolution',     value: avgResolutionHours === 'N/A' ? 'N/A' : `${avgResolutionHours}h`, color: 'text-slate-700', bg: 'bg-slate-50' },
    { label: 'CSAT Score',         value: csatScore,         color: 'text-slate-700',   bg: 'bg-slate-50'  },
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeadphonesIcon size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Support Performance</h2>
        </div>
        <Link to="/support" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          Open Support →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl p-3 ${s.bg}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className={`mt-1 text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

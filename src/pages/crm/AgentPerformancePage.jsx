import { useEffect, useState } from 'react';
import { getAgentPerformance } from '../../api/crmApi';
import StatsCard from '../../components/common/StatsCard';
import { useCurrency } from '../../context/useAppearance';

const riskStyles = {
  top_performer: 'bg-emerald-100 text-emerald-700',
  healthy: 'bg-slate-100 text-slate-700',
  low_performer: 'bg-amber-100 text-amber-700',
  at_risk: 'bg-rose-100 text-rose-700',
};

const trendStyles = {
  improving: { icon: '↑', className: 'text-emerald-600' },
  stable: { icon: '→', className: 'text-slate-500' },
  declining: { icon: '↓', className: 'text-rose-600' },
  inactive: { icon: '●', className: 'text-slate-400' },
};

const emptyState = { data: [], summary: { total_agents: 0, top_performers: 0, at_risk: 0, low_performers: 0, total_sold: 0, total_revenue: 0 } };

function SummaryToneCard({ title, value, subtitle, className }) {
  return (
    <div className={`rounded-xl p-5 shadow-sm ring-1 ${className}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
    </div>
  );
}

export default function AgentPerformancePage() {
  const fmt = useCurrency();
  const [payload, setPayload] = useState(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getAgentPerformance();
        setPayload({
          data: Array.isArray(response?.data) ? response.data : [],
          summary: response?.summary || emptyState.summary,
        });
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.userMessage || 'Failed to load agent performance.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <div className="rounded-xl bg-white p-8 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading agent performance...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Realtor Leaderboard</h1>
        <p className="mt-1 text-sm text-slate-500">All time, ranked by money received. The dashboard widget shows the same figures for its selected date range.</p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Revenue Received" value={fmt(payload.summary.total_revenue || 0)} subtitle={`${payload.summary.total_sold || 0} sale${(payload.summary.total_sold || 0) === 1 ? '' : 's'} from ${payload.summary.total_agents} realtor${payload.summary.total_agents === 1 ? '' : 's'}`} />
        <SummaryToneCard title="Top Performers" value={payload.summary.top_performers} subtitle="Bringing money in" className="bg-emerald-50 text-emerald-700 ring-emerald-200" />
        <SummaryToneCard title="At Risk" value={payload.summary.at_risk} subtitle="Needs immediate attention" className="bg-rose-50 text-rose-700 ring-rose-200" />
        <SummaryToneCard title="Low Performers" value={payload.summary.low_performers} subtitle="Below expected conversion" className="bg-amber-50 text-amber-700 ring-amber-200" />
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Sales by Realtor</h2>
          <p className="text-sm text-slate-500">Sales and revenue come from payments actually received, credited to the realtor who introduced the buyer.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Realtor</th>
                <th className="px-3 py-2 font-medium">Sold</th>
                <th className="px-3 py-2 font-medium">Revenue</th>
                <th className="px-3 py-2 font-medium">Referrals</th>
                <th className="px-3 py-2 font-medium">Total Leads</th>
                <th className="px-3 py-2 font-medium">Conversion</th>
                <th className="px-3 py-2 font-medium">Active Leads</th>
                <th className="px-3 py-2 font-medium">Hot Leads</th>
                <th className="px-3 py-2 font-medium">Avg Score</th>
                <th className="px-3 py-2 font-medium">Activity Trend</th>
                <th className="px-3 py-2 font-medium">Risk Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payload.data.map((agent) => {
                const trend = trendStyles[agent.activity_trend] || trendStyles.stable;
                return (
                  <tr key={agent.realtor_id}>
                    <td className="px-3 py-3 font-medium text-slate-900">{agent.name || `Realtor #${agent.realtor_id}`}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{agent.sold}</td>
                    <td className="px-3 py-3 font-semibold" style={{ color: 'var(--primary)' }}>{fmt(agent.revenue || 0)}</td>
                    <td className="px-3 py-3 text-slate-700">{agent.referrals}</td>
                    <td className="px-3 py-3 text-slate-700">{agent.total}</td>
                    {/* No assigned leads means there is no ratio to report. */}
                    <td className="px-3 py-3 text-slate-700">{agent.close_rate ?? '—'}</td>
                    <td className="px-3 py-3 text-slate-700">{agent.active}</td>
                    <td className="px-3 py-3 text-slate-700">{agent.hot_leads}</td>
                    <td className="px-3 py-3 text-slate-700">{agent.avg_score}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 font-medium ${trend.className}`}>
                        <span>{trend.icon}</span>
                        <span className="capitalize">{String(agent.activity_trend || 'stable').replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span title={agent.risk_reason || ''} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${riskStyles[agent.risk] || riskStyles.healthy}`}>
                        {String(agent.risk || 'healthy').replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!payload.data.length && (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-slate-500">No realtors yet. Once a realtor is added and their client pays, they appear here.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

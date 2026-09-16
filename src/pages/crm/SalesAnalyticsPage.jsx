import { useEffect, useMemo, useState } from 'react';
import { getSalesAnalytics } from '../../api/crmApi';
import StatsCard from '../../components/common/StatsCard';
import { useCurrency } from '../../context/useAppearance';

const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-cyan-500'];
const emptyAnalytics = {
  total_leads: 0,
  hot_leads: 0,
  warm_leads: 0,
  cold_leads: 0,
  closed_won: 0,
  conversion_rate: '0.0%',
  avg_deal_value: 0,
  objection_frequency: [],
  pipeline_stages: [],
  budget_distribution: [],
  realtor_conversion: [],
};

const normalizeList = (rows) => (Array.isArray(rows) ? rows : []);

export default function SalesAnalyticsPage() {
  const fmt = useCurrency();
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getSalesAnalytics();
        setAnalytics({
          ...emptyAnalytics,
          ...response,
          objection_frequency: normalizeList(response?.objection_frequency),
          pipeline_stages: normalizeList(response?.pipeline_stages),
          budget_distribution: normalizeList(response?.budget_distribution),
          realtor_conversion: normalizeList(response?.realtor_conversion),
        });
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.userMessage);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const maxObjectionCount = useMemo(
    () => Math.max(...analytics.objection_frequency.map((item) => Number(item.count || 0)), 1),
    [analytics.objection_frequency]
  );
  const maxPipelineCount = useMemo(
    () => Math.max(...analytics.pipeline_stages.map((item) => Number(item.count || 0)), 1),
    [analytics.pipeline_stages]
  );
  const budgetTotal = useMemo(
    () => analytics.budget_distribution.reduce((sum, item) => sum + Number(item.count || 0), 0),
    [analytics.budget_distribution]
  );

  if (loading) {
    return <div className="rounded-xl bg-white p-8 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading sales analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Sales Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Track lead quality, objections, and realtor performance.</p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total Leads" value={analytics.total_leads} subtitle="All CRM opportunities" />
        <StatsCard title="Hot Leads" value={analytics.hot_leads} subtitle="Highest-priority prospects" />
        <StatsCard title="Conversion Rate" value={analytics.conversion_rate} subtitle={`${analytics.closed_won} closed won`} />
        <StatsCard title="Avg Deal Value" value={fmt(analytics.avg_deal_value || 0)} subtitle="Average across all deals" />
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Lead Thermal Distribution</h2>
          <p className="text-sm text-slate-500">Current lead urgency split.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <div className="text-sm font-medium text-rose-600">🔴 Hot</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{analytics.hot_leads}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="text-sm font-medium text-amber-600">🟡 Warm</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{analytics.warm_leads}</div>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
            <div className="text-sm font-medium text-sky-600">🔵 Cold</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{analytics.cold_leads}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Objection Frequency</h2>
            <p className="text-sm text-slate-500">Most common roadblocks across active leads.</p>
          </div>
          <div className="space-y-4">
            {analytics.objection_frequency.map((item, index) => {
              const width = `${(Number(item.count || 0) / maxObjectionCount) * 100}%`;
              return (
                <div key={item.type}>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                    <span>{item.type}</span>
                    <span className="font-semibold text-slate-900">{item.count}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div className={`h-3 rounded-full ${colors[index % colors.length]}`} style={{ width }} />
                  </div>
                </div>
              );
            })}
            {!analytics.objection_frequency.length && <p className="text-sm text-slate-500">No objections logged yet.</p>}
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Pipeline Velocity</h2>
            <p className="text-sm text-slate-500">Lead movement through the core sales funnel.</p>
          </div>
          <div className="space-y-3">
            {analytics.pipeline_stages.map((item, index) => {
              const width = `${35 + (Number(item.count || 0) / maxPipelineCount) * 65}%`;
              return (
                <div key={item.stage} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{item.stage}</span>
                    <span className="font-semibold text-slate-900">{item.count}</span>
                  </div>
                  <div className="mx-auto h-10 rounded-lg bg-gradient-to-r from-blue-600 to-sky-400" style={{ width }} />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Budget Distribution</h2>
            <p className="text-sm text-slate-500">How lead budgets break down.</p>
          </div>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full border-[14px] border-slate-200 bg-slate-50 text-center">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Lead Pool</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{budgetTotal}</div>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              {analytics.budget_distribution.map((item, index) => {
                const percent = budgetTotal ? ((Number(item.count || 0) / budgetTotal) * 100).toFixed(1) : '0.0';
                const width = `${budgetTotal ? (Number(item.count || 0) / budgetTotal) * 100 : 0}%`;
                return (
                  <div key={item.range}>
                    <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${colors[index % colors.length]}`} />
                        <span>{item.range}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{item.count} · {percent}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div className={`h-3 rounded-full ${colors[index % colors.length]}`} style={{ width }} />
                    </div>
                  </div>
                );
              })}
              {!analytics.budget_distribution.length && <p className="text-sm text-slate-500">No budget data available.</p>}
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Realtor Conversion Rates</h2>
            <p className="text-sm text-slate-500">Ranked by closed leads versus assigned lead volume.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Realtor</th>
                  <th className="px-3 py-2 font-medium">Closed</th>
                  <th className="px-3 py-2 font-medium">Total Leads</th>
                  <th className="px-3 py-2 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.realtor_conversion.map((item) => (
                  <tr key={item.realtor}>
                    <td className="px-3 py-3 text-slate-900">{item.realtor}</td>
                    <td className="px-3 py-3">{item.closed}</td>
                    <td className="px-3 py-3">{item.total}</td>
                    <td className="px-3 py-3 font-semibold text-blue-600">{item.rate}</td>
                  </tr>
                ))}
                {!analytics.realtor_conversion.length && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">No realtor performance data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

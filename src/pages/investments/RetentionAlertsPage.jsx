import { useEffect, useMemo, useState } from 'react';
import { getRetentionAlerts } from '../../api/investmentApi';
import Button from '../../components/ui/Button';
import StatsCard from '../../components/common/StatsCard';
import { useCurrency } from '../../context/useAppearance';

const FILTERS = ['all', 'expiring', 'reinvestment_opportunity'];
const urgencyStyles = {
  high: 'border-rose-500',
  medium: 'border-amber-500',
  low: 'border-slate-300',
};

const emptyState = { data: [], summary: { total_alerts: 0, high_urgency: 0, expiring_soon: 0, reinvestment_opportunities: 0 } };

function ToneCard({ title, value, subtitle, className }) {
  return (
    <div className={`rounded-xl p-5 shadow-sm ring-1 ${className}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
    </div>
  );
}

export default function RetentionAlertsPage() {
  const fmt = useCurrency();
  const [payload, setPayload] = useState(emptyState);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getRetentionAlerts();
        setPayload({
          data: Array.isArray(response?.data) ? response.data : [],
          summary: response?.summary || emptyState.summary,
        });
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.userMessage || 'Failed to load retention alerts.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return payload.data;
    return payload.data.filter((alert) => alert.type === filter);
  }, [filter, payload.data]);

  if (loading) {
    return <div className="rounded-xl bg-white p-8 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading retention alerts...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Retention Alerts</h1>
        <p className="mt-1 text-sm text-slate-500">Surface expiring investments and likely reinvestment opportunities.</p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total Alerts" value={payload.summary.total_alerts} subtitle="All current retention signals" />
        <ToneCard title="High Urgency" value={payload.summary.high_urgency} subtitle="Requires immediate outreach" className="bg-rose-50 text-rose-700 ring-rose-200" />
        <ToneCard title="Expiring Investments" value={payload.summary.expiring_soon} subtitle="Active plans ending soon" className="bg-amber-50 text-amber-700 ring-amber-200" />
        <ToneCard title="Reinvestment Opportunities" value={payload.summary.reinvestment_opportunities} subtitle="Completed plans ready for re-engagement" className="bg-emerald-50 text-emerald-700 ring-emerald-200" />
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((value) => {
            const active = filter === value;
            const label = value === 'all' ? 'All' : value === 'expiring' ? 'Expiring' : 'Reinvestment Opportunities';
            return (
              <Button key={value} type="button" variant={active ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter(value)}>
                {label}
              </Button>
            );
          })}
        </div>
      </section>

      <div className="space-y-4">
        {filteredAlerts.map((alert) => (
          <div key={`${alert.type}-${alert.investment_id}`} className={`rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 border-l-4 ${urgencyStyles[alert.urgency] || urgencyStyles.low}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="text-sm font-medium uppercase tracking-wide text-slate-500">User ID: {alert.user_id}</div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {alert.type === 'expiring' ? `⚠️ Investment Expiring in ${alert.days_remaining} days` : '💰 Reinvestment Opportunity'}
                </h2>
                <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                  <span>Plan: <span className="font-medium text-slate-900">{alert.plan_name}</span></span>
                  <span>Amount: <span className="font-medium text-slate-900">{fmt(alert.amount || 0)}</span></span>
                  <span>Investment ID: <span className="font-medium text-slate-900">#{alert.investment_id}</span></span>
                </div>
                <p className="text-sm text-slate-600">{alert.action}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[21rem]">
                {alert.type === 'expiring' ? (
                  <>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Churn risk</div>
                      <div className="mt-1 text-xl font-semibold text-rose-600">{alert.churn_risk_pct}%</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Urgency</div>
                      <div className="mt-1 text-xl font-semibold capitalize text-slate-900">{alert.urgency}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Reinvest probability</div>
                      <div className="mt-1 text-xl font-semibold text-emerald-600">{alert.reinvestment_probability_pct}%</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Days since completed</div>
                      <div className="mt-1 text-xl font-semibold text-slate-900">{alert.days_since_completed}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {!filteredAlerts.length && (
          <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            No alerts match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}

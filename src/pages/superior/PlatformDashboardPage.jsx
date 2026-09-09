import { useEffect, useState } from 'react';
import client from '../../api/client';
import StatsCard from '../../components/common/StatsCard';
import Badge from '../../components/common/Badge';
import { Link } from 'react-router-dom';

export default function PlatformDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/platform/overview').catch(() => ({ data: {} })),
      client.get('/companies?limit=5&sort=recent').catch(() => ({ data: [] })),
    ]).then(([overviewRes, companiesRes]) => {
      setOverview(overviewRes.data?.data || overviewRes.data || {});
      setCompanies(Array.isArray(companiesRes.data?.data) ? companiesRes.data.data : []);
    }).finally(() => setLoading(false));
  }, []);

  const stats = [
    { title: 'Total Companies', value: overview?.totalCompanies ?? '—', subtitle: 'Active tenants' },
    { title: 'Total Users', value: overview?.totalUsers ?? '—', subtitle: 'Across all companies' },
    { title: 'Active Companies', value: overview?.activeCompanies ?? '—', subtitle: 'Status: active' },
    { title: 'Suspended', value: overview?.suspendedCompanies ?? '—', subtitle: 'Status: suspended' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            🌐 Platform Admin
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Overview</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Cross-company statistics and health of the entire Realto platform.
          </p>
        </div>
        <Link to="/superior/companies/new"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          ＋ Onboard Company
        </Link>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => <StatsCard key={s.title} {...s} />)}
        </div>
      )}

      {/* Recent companies */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Recent Companies</h2>
          <Link to="/superior/companies" className="text-sm text-blue-600 hover:underline">View all</Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}
          </div>
        ) : companies.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <div className="mb-2 text-3xl">🏢</div>
            <p className="text-sm">No companies onboarded yet.</p>
            <Link to="/superior/companies/new" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              Onboard your first company →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {companies.map((c) => (
              <div key={c.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 hover:bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  {c.logo_url
                    ? <img src={c.logo_url} alt={c.name} className="h-8 w-8 rounded object-contain" />
                    : <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-100 text-sm font-bold text-blue-700">
                        {(c.name || '?').charAt(0)}
                      </div>
                  }
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{c.name}</div>
                    <div className="text-xs text-slate-400">{c.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={c.status === 'active' ? 'success' : c.status === 'suspended' ? 'error' : 'warning'}>
                    {c.status}
                  </Badge>
                  <Link to={`/superior/companies/${c.id}/settings`}
                    className="text-xs text-blue-600 hover:underline">Manage</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: '🏢', label: 'Manage Companies', desc: 'View, edit, suspend companies', to: '/superior/companies' },
          { icon: '⚙️', label: 'Global Settings', desc: 'Default settings for all tenants', to: '/superior/settings' },
          { icon: '👥', label: 'All Users', desc: 'Browse users across all companies', to: '/superior/users' },
        ].map((a) => (
          <Link key={a.to} to={a.to}
            className="flex items-start gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:shadow-md transition-shadow">
            <div className="text-2xl">{a.icon}</div>
            <div>
              <div className="font-medium text-slate-800">{a.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{a.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

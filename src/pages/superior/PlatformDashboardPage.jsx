import { useEffect, useState } from 'react';
import {
  Building2, Users, CheckCircle2, PauseCircle, Plus, Settings, ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { topPerformersReport } from '../../api/financeApi';
import Badge from '../../components/common/Badge';
import { Ranking } from '../../components/dashboard/TopPerformersPanel';
import { capRows } from '../../components/dashboard/dashboardRows';
import { useCurrency } from '../../context/useAppearance';
import {
  DashboardHero, TintCard, TrendChip, Panel, PanelLink, MiniStat, useModuleAccent,
} from '../../components/dashboard/DashboardKit';
import { accentStyle } from '../../components/layout/launcherPalette';

const number = (value) => (value === undefined || value === null ? '—' : Number(value).toLocaleString());

export default function PlatformDashboardPage() {
  const fmt = useCurrency();
  const { accentFor, nth } = useModuleAccent();
  const [overview, setOverview] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [topCompanies, setTopCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/platform/overview').catch(() => ({ data: {} })),
      client.get('/companies?limit=5&sort=recent').catch(() => ({ data: [] })),
      /**
       * The same report the company dashboards use. A platform admin has no
       * company of their own, so the endpoint returns a cross-company ranking
       * — and `companies` comes back null for anyone who is bounded to one,
       * which is why this page is the only place it is asked for.
       */
      topPerformersReport({ limit: 5 }).catch(() => null),
    ]).then(([overviewRes, companiesRes, topRes]) => {
      setOverview(overviewRes.data?.data || overviewRes.data || {});
      setCompanies(Array.isArray(companiesRes.data?.data) ? companiesRes.data.data : []);
      setTopCompanies(topRes?.data?.companies ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const o = overview || {};
  const stats = [
    {
      label: 'Total companies', value: number(o.totalCompanies), sub: 'Active tenants', icon: Building2, module: 'Dashboard',
      trend: o.newCompaniesThisMonth ? <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">+{o.newCompaniesThisMonth} this month</span> : null,
    },
    {
      label: 'Total users', value: number(o.totalUsers), sub: 'Across all companies', icon: Users, module: 'People & Access',
      trend: o.newUsersThisMonth ? <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">+{Number(o.newUsersThisMonth).toLocaleString()}</span> : null,
    },
    {
      label: 'Active companies', value: number(o.activeCompanies), sub: 'Status: active', icon: CheckCircle2, module: 'Properties',
      trend: o.totalCompanies ? <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{Math.round((o.activeCompanies / o.totalCompanies) * 100)}%</span> : null,
    },
    { label: 'Suspended', value: number(o.suspendedCompanies), sub: 'Status: suspended', icon: PauseCircle, module: 'Sales & CRM' },
  ];

  const byType = o.usersByType || {};
  const typeTotal = (byType.clients || 0) + (byType.realtors || 0) + (byType.staff || 0);
  const types = [
    ['Clients', byType.clients, accentFor('Dashboard')],
    ['Realtors', byType.realtors, accentFor('People & Access')],
    ['Staff', byType.staff, accentFor('Sales & CRM')],
  ];
  const share = (n) => (typeTotal ? `${Math.round(((n || 0) / typeTotal) * 100)}%` : '—');

  const activity = o.activity || {};
  const activityRows = [
    ['Invoices raised', activity.invoicesRaised, (v) => Number(v).toLocaleString(), 'Dashboard'],
    ['Payments approved', activity.paymentsApproved, fmt, 'People & Access'],
    ['Commission paid out', activity.commissionPaid, fmt, 'Properties'],
    ['Properties listed', activity.propertiesListed, (v) => Number(v).toLocaleString(), 'Sales & CRM'],
  ];

  const attention = o.attention || {};
  const attentionRows = [
    ['Companies with overdue invoices', attention.companiesWithOverdueInvoices, 'bg-rose-500', '/superior/companies'],
    ['Payments awaiting approval', attention.paymentsAwaitingApproval, 'bg-amber-500', '/superior/companies'],
    ['Realtor verifications pending', attention.realtorVerificationsPending, 'bg-amber-500', '/superior/users'],
    ['Suspended companies', attention.suspendedCompanies, 'bg-slate-400', '/superior/companies'],
  ];

  const actions = [
    { icon: Building2, label: 'Manage companies', desc: 'View, edit, suspend companies', to: '/superior/companies', module: 'Operations & Support' },
    { icon: Settings, label: 'Settings', desc: 'Platform defaults, or any one company', to: '/superior/settings', module: 'Finance' },
    { icon: Users, label: 'All users', desc: 'Browse users across all companies', to: '/superior/users', module: 'Marketing & Content' },
  ];

  return (
    <div className="space-y-6">
      <DashboardHero
        kicker="Platform admin"
        title="Platform overview"
        subtitle="Statistics and health across every company on the platform."
        aside={(
          <Link
            to="/superior/companies/new"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Plus size={18} strokeWidth={2.4} /> Onboard company
          </Link>
        )}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 animate-pulse rounded-[20px] bg-slate-200" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <TintCard key={s.label} accent={accentFor(s.module)} icon={s.icon} value={s.value} label={s.label} sub={s.sub} trend={s.trend} />
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-12">
        {/*
          * Ranked by money RECEIVED, the same basis as every other "top" panel
          * in the app — a tenant that raised the largest unpaid invoices is not
          * the platform's strongest. Above Recent Companies because "who is
          * performing" is the question this page exists to answer.
          */}
        {topCompanies.length > 0 && (
          <div className="xl:col-span-7">
            <Ranking icon={Building2} title="Top companies" rows={topCompanies} fmt={fmt} emptyNote="No payments received yet." />
          </div>
        )}

        <Panel
          title="Recent companies"
          subtitle="Newest tenants first"
          action={<PanelLink to="/superior/companies">View all →</PanelLink>}
          className={topCompanies.length > 0 ? 'xl:col-span-5' : 'xl:col-span-12'}
        >
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div>
          ) : companies.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="text-sm">No companies onboarded yet.</p>
              <Link to="/superior/companies/new" className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">
                Onboard your first company →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {/* Capped here as well as in the request — `?limit=5` is a request, not a guarantee. */}
              {capRows(companies).map((c, index) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  {c.logo_url
                    ? <img src={c.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
                    : (
                      <span style={accentStyle(nth(index))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--rx-card-tint)] text-base font-bold text-[color:var(--rx-card-link)]">
                        {(c.name || '?').charAt(0)}
                      </span>
                    )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900">{c.name}</div>
                    <div className="truncate text-xs text-slate-500">{c.email}</div>
                  </div>
                  <Badge variant={c.status === 'active' ? 'success' : c.status === 'suspended' ? 'error' : 'warning'}>{c.status}</Badge>
                  <Link to={`/superior/companies/${c.id}/settings`} className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-200">
                    Manage
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Users by type" subtitle={`${number(o.totalUsers)} people across every company`}>
          <div role="img" aria-label={types.map(([label, n]) => `${label} ${share(n)}`).join(', ')} className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {types.map(([label, n, colour]) => (
              <span key={label} style={{ width: share(n) === '—' ? 0 : share(n), backgroundColor: colour }} />
            ))}
          </div>
          <ul className="space-y-2.5">
            {types.map(([label, n, colour]) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className="h-3 w-3 rounded" style={{ backgroundColor: colour }} aria-hidden="true" />
                <span className="flex-1 font-semibold text-slate-800">{label}</span>
                <span className="text-slate-500">{share(n)}</span>
                <span className="min-w-[4rem] text-right font-bold tabular-nums">{number(n)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-600">Active in the last 30 days</span>
            <strong className="tabular-nums">
              {number(o.activeUsers30d)}{o.totalUsers ? ` · ${Math.round(((o.activeUsers30d || 0) / o.totalUsers) * 100)}%` : ''}
            </strong>
          </div>
        </Panel>

        <Panel title="Platform activity" subtitle="All companies · this month">
          <div className="grid grid-cols-2 gap-3">
            {activityRows.map(([label, pair, format, module]) => (
              <div key={label} className="space-y-1">
                <MiniStat accent={accentFor(module)} value={pair ? format(pair.current) : '—'} label={label} />
                {pair && <TrendChip current={pair.current} previous={pair.previous} />}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Needs attention" subtitle="Across the platform, right now">
          <ul className="divide-y divide-slate-100">
            {attentionRows.map(([label, value, dot, to]) => (
              <li key={label} className="flex items-center gap-3 py-2.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
                <span className="flex-1 text-sm font-semibold text-slate-800">{label}</span>
                <strong className="text-lg font-bold tabular-nums">{number(value)}</strong>
                <Link to={to} className="text-xs font-bold text-blue-700 hover:underline">Review</Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            style={accentStyle(accentFor(a.module))}
            className="flex items-center gap-4 rounded-[20px] border border-[color:var(--rx-card-edge)] bg-[linear-gradient(160deg,#ffffff_0%,var(--rx-card-tint)_75%)] p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--rx-card-fill)] text-[color:var(--rx-card-on-fill)]">
              <a.icon size={26} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-slate-900">{a.label}</span>
              <span className="block text-xs text-slate-600">{a.desc}</span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--rx-card-chev-bg)] text-[color:var(--rx-card-chev)]" aria-hidden="true">
              <ChevronRight size={18} strokeWidth={2.4} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

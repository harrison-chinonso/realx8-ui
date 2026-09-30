import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  RefreshCw, ArrowUpRight, ArrowUp, ArrowDown, Minus, Send, Plus, Download, Wallet, AlertTriangle,
  Users, Home, FileText, Briefcase, Award, CreditCard, ShieldCheck,
} from 'lucide-react';

import useDashboardData from '../../hooks/useDashboardData';
import Select from '../../components/ui/Select';
import ExportProgress from '../../components/common/ExportProgress';
import { isStaleBuildError } from '../../utils/lazyImport';
import { exportDashboardPdf, exportDashboardExcel } from '../../utils/dashboardExport';
import useDashboardStore from '../../store/dashboardStore';
import { useCurrency, useAppearance, useOnPrimary } from '../../context/useAppearance';
import useNavBadgeStore from '../../store/navBadgeStore';
import {
  DashboardHero, TintCard, Panel, PanelLink, MiniStat, SectionHeading, SplitBar, useModuleAccent,
} from '../../components/dashboard/DashboardKit';
import { accentStyle } from '../../components/layout/launcherPalette';
import useAuthStore from '../../store/authStore';

import DateFilterBar from '../../components/dashboard/DateFilterBar';
import QuickActionBar from '../../components/dashboard/QuickActionBar';
import NotificationsPanel from '../../components/dashboard/NotificationsPanel';
import WidgetToggleBar from '../../components/dashboard/WidgetToggleBar';
import RevenueChart from '../../components/dashboard/RevenueChart';
import PropertyStatusChart from '../../components/dashboard/PropertyStatusChart';
import TopDuePaymentsTable from '../../components/dashboard/TopDuePaymentsTable';
import PaymentRemindersWidget from '../../components/dashboard/PaymentRemindersWidget';
import LeadStatusPanel from '../../components/dashboard/LeadStatusPanel';
import RealtorLeaderboard from '../../components/dashboard/RealtorLeaderboard';
import RecentActivitiesFeed from '../../components/dashboard/RecentActivitiesFeed';
import SupportStatsWidget from '../../components/dashboard/SupportStatsWidget';
import TopPerformersPanel from '../../components/dashboard/TopPerformersPanel';
import RealtorDashboard from './RealtorDashboard';
import ClientDashboard from './ClientDashboard';
import { canSeeWidget } from '../../components/dashboard/widgetPermissions';

/**
 * Exporting the dashboard.
 *
 * `window.print()` is still offered, because printing the page as it looks is
 * genuinely what someone occasionally wants — but it is no longer what
 * "Export" means. PDF and Excel are built from the dashboard's DATA (see
 * utils/dashboardExport.js): everything it computed, including widgets that
 * happen to be toggled off or scrolled out of view, laid out as a paginated
 * report rather than a screenshot of a web page.
 */
const EXPORT_CHOICES = [
  ['pdf', 'PDF report'],
  ['excel', 'Excel workbook'],
  ['print', 'Print this screen'],
];

// A role/tenant-type value ("Platform", "Admin", "Staff"...) sometimes ends
// up in the same slot a human first name would occupy. Rather than greet
// someone by their role, drop the name entirely when it looks like one.
const SYSTEM_NAME_WORDS = new Set(['platform', 'admin', 'staff', 'realtor', 'client', 'superior', 'company', 'agency', 'system', 'tenant']);
function resolveFirstName(user) {
  const raw = user?.first_name || user?.firstName || user?.name?.split(' ')[0];
  if (!raw) return null;
  return SYSTEM_NAME_WORDS.has(String(raw).trim().toLowerCase()) ? null : raw;
}

// ₦29,030,000 -> "₦29.03M". Full value always lives in a title attribute.
function abbreviate(n, symbol) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${symbol}${(v / 1_000).toFixed(0)}K`;
  return `${symbol}${v.toLocaleString('en-US')}`;
}

function formatUpdatedAgo(date) {
  if (!date) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}


// ─── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

function SectionSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-44" />
      <Skeleton className="h-40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    </div>
  );
}

/**
 * A card, shown when the viewer has both switched it on and is allowed it.
 *
 * `visible` is the viewer's own preference; `allowed` is the permission. The
 * two are deliberately separate arguments rather than one combined flag,
 * because they fail differently: a card you turned off you can turn back on,
 * and a card you may not see is not yours to turn on at all.
 */
function Section({ visible, allowed = true, children }) {
  if (!visible || !allowed) return null;
  return <>{children}</>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  // Realtors and clients get their own dashboards; everything below is the
  // staff view. Keyed on the ACTIVE profile so switching swaps the dashboard.
  const effectiveType = useAuthStore((s) => s.effectiveType());
  if (effectiveType === 'realtor') return <RealtorDashboard />;
  if (effectiveType === 'client') return <ClientDashboard />;

  return <StaffDashboard />;
}

function StaffDashboard() {
  const fmt = useCurrency();
  const { currencySymbol } = useAppearance();
  // The ink for the one button filled with the primary colour.
  const onPrimary = useOnPrimary();
  const { accentFor } = useModuleAccent();
  // The approval-queue counts the sidebar badges already fetched.
  const badgeCounts = useNavBadgeStore((s) => s.counts);
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  /*
   * Which cards this account may see at all, decided here and passed down, so
   * the page, the toggle bar and the export cannot disagree about it.
   */
  const allow = (key) => canSeeWidget(key, hasPermission);
  const widgets = useDashboardStore((s) => s.widgets);
  const preset = useDashboardStore((s) => s.preset);
  const getDateRange = useDashboardStore((s) => s.getDateRange);

  const { data, loading, error, reload } = useDashboardData();

  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');
  const [exportStale, setExportStale] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);

  const runExport = async (choice) => {
    if (choice === 'print') { window.print(); return; }
    setExportError('');
    setExportStale(false);
    setExporting(choice);
    setExportProgress({ stage: 'Preparing', percent: 5 });
    try {
      const options = {
        data,
        symbol: currencySymbol || '',
        title: 'Dashboard report',
        period: preset,
        onProgress: setExportProgress,
        // The report is built from the same permission rule as the screen, so
        // a figure the viewer was refused is absent from the file rather than
        // present as a zero somebody reads as fact six months later.
        allow,
      };
      if (choice === 'pdf') await exportDashboardPdf(options);
      else await exportDashboardExcel(options);
    } catch (error) {
      setExportStale(isStaleBuildError(error));
      setExportError(error?.message || 'Export failed.');
    } finally {
      setExporting('');
      setExportProgress(null);
    }
  };

  const [notifications, setNotifications] = useState([]);
  const [notifBootstrapped, setNotifBootstrapped] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Re-render every 60s purely so "updated N minutes ago" keeps counting up.
  const [, forceTick] = useState(0);

  // Bootstrap notifications from data once loaded
  if (data && !notifBootstrapped) {
    setNotifications(data.unreadNotifications || []);
    setNotifBootstrapped(true);
  }

  useEffect(() => {
    if (data) setLastUpdated(new Date());
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const dismissNotif = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const firstName = resolveFirstName(user);
  // The full name for the welcome banner — unless the first word looks like a
  // role, in which case the whole value is a role and not a person's name.
  const fullName = firstName ? (user?.name || firstName) : null;

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5">
        {/* Toolbar skeletons */}
        <Skeleton className="h-10" />
        <Skeleton className="h-8" />
        <SectionSkeleton />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-2xl bg-rose-50 p-8 text-center ring-1 ring-rose-200">
        <p className="text-sm font-semibold text-rose-700">Failed to load dashboard data</p>
        <p className="mt-1 text-xs text-rose-500">{error.message}</p>
        <button
          onClick={reload}
          className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const {
    totalClients, totalProperties, totalInvoices, totalSales,
    totalStaff, totalRealtors,
    totalInvoiceAmount, collected, outstanding,
    collectionRateBand, paymentsInRange, averagePayment, avgDaysToSettle,
    units = { total: 0, available: 0, held: 0 },
    oldestUnpaidDays, overdueCount,
    rangedRevenue, momGrowth, momGrowthKind, ytdRevenue, weekComparison,
    qualifiedLeads, conversionRate,
    leadStatusMap, totalLeadsInRange,
    duePayments, reminders,
    propertyStatusMap,
    realtorLeaderboard,
    recentSales, activities,
    topPerformers,
    openTickets, closedTickets, escalatedTickets, avgResolutionHours, totalTickets,
  } = data;

  const collectedPct = totalInvoiceAmount > 0 ? (collected / totalInvoiceAmount) * 100 : 0;
  const outstandingPct = totalInvoiceAmount > 0 ? 100 - collectedPct : 0;
  const hour = new Date().getHours();
  const greeting = `Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}`;

  /*
   * What is waiting on this person, from the counts the sidebar badges already
   * hold. Absent when the store has no count for a queue, which is how it says
   * this person cannot approve that queue — so the row shows only what is
   * theirs to act on.
   */
  const queues = [
    { key: 'pendingApprovals', label: 'Payment approvals', sub: 'Receipts to confirm', icon: CreditCard, to: '/receipts', module: 'Finance' },
    { key: 'commissionPayouts', label: 'Commission payouts', sub: 'Requests and draft runs', icon: Wallet, to: '/finance/commission-payouts', module: 'People & Access' },
    { key: 'bills', label: 'Bills', sub: 'Awaiting approval', icon: FileText, to: '/finance/payables', module: 'Sales & CRM' },
    { key: 'realtorVerifications', label: 'Realtor verifications', sub: 'Identity to review', icon: ShieldCheck, to: '/users/verifications', module: 'Properties' },
  ].filter((queue) => badgeCounts[queue.key] !== undefined);

  const portfolio = [
    { label: 'Clients', value: totalClients, to: '/users/clients', icon: Users, module: 'Dashboard' },
    { label: 'Properties', value: totalProperties, to: '/properties', icon: Home, module: 'Properties' },
    { label: 'Invoices', value: totalInvoices, to: '/finance/invoices', icon: FileText, module: 'Finance' },
    { label: 'Staff', value: totalStaff, to: '/users/employees', icon: Briefcase, module: 'Sales & CRM' },
    { label: 'Realtors', value: totalRealtors, to: '/users/realtors', icon: Award, module: 'People & Access' },
  ];

  return (
    <div className="space-y-6 print:space-y-4">

      {/* ══ WELCOME + CONTROLS ═══════════════════════════════════════════════ */}
      <div className="print:hidden">
        <DashboardHero
          kicker={`${greeting},`}
          title={fullName || 'Welcome back'}
          subtitle={(
            <>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {lastUpdated && <> · updated {formatUpdatedAgo(lastUpdated)}</>}
            </>
          )}
        >
          {/* min-w-0 on every child below stops long labels from being clipped
              at the container edge instead of wrapping. */}
          <DateFilterBar />
          <NotificationsPanel notifications={notifications} onDismiss={dismissNotif} />
          <button
            onClick={reload}
            aria-label="Refresh dashboard data"
            title="Refresh dashboard data"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm hover:text-slate-900 transition-colors motion-reduce:transition-none"
          >
            <RefreshCw size={15} />
          </button>
          {/* The shared Select, matching DateFilterBar beside it — a native
              <select> draws its list with the operating system's styling. */}
          <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
            <Download size={13} className="shrink-0 text-slate-500" />
            <Select
              value=""
              disabled={Boolean(exporting) || loading}
              aria-label="Export the dashboard"
              placeholder={exporting ? 'Preparing…' : 'Export'}
              onChange={(event) => { if (event.target.value) runExport(event.target.value); }}
              className="h-7 cursor-pointer border-0 bg-transparent px-0 text-xs font-medium text-slate-700 shadow-none focus-visible:ring-0"
              options={EXPORT_CHOICES.map(([value, label]) => ({ value, label }))}
            />
          </div>
          <QuickActionBar />
          <WidgetToggleBar />
        </DashboardHero>
        {(exportProgress || exportError) && (
          <div className="mt-2 max-w-md">
            <ExportProgress
              progress={exportProgress}
              error={exportError}
              staleBuild={exportStale}
              onDismiss={() => setExportError('')}
            />
          </div>
        )}
      </div>

      {/* ══ CASH POSITION + REVENUE ═══════════════════════════════════════════
          Revenue, receivables and collection rate are one number split two
          ways, not three independent facts — a stacked bar makes that
          arithmetic visible. "Collected" is derived (invoiced − outstanding),
          so it can never disagree with the other two. */}
      <div className="grid gap-5 xl:grid-cols-12">
        <Section visible={widgets.kpiSummary} allowed={allow('kpiSummary')}>
          <section
            aria-label="Cash position"
            style={accentStyle(accentFor('Finance'))}
            className="flex min-w-0 flex-col gap-5 rounded-[22px] border border-[color:var(--rx-card-edge)] bg-[linear-gradient(160deg,#ffffff_0%,var(--rx-card-tint)_75%)] p-6 sm:p-7 xl:col-span-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-600">Invoiced to date · {preset}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-heading text-3xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-[42px]" title={fmt(totalInvoiceAmount)}>
                  {abbreviate(totalInvoiceAmount, currencySymbol)}
                  <span className="font-sans text-sm font-normal text-slate-600">across {totalInvoices.toLocaleString()} invoice{totalInvoices === 1 ? '' : 's'}</span>
                </p>
              </div>
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--rx-card-fill)] text-[color:var(--rx-card-on-fill)]">
                <Wallet size={27} aria-hidden="true" />
              </span>
            </div>

            <SplitBar
              done={collected}
              total={totalInvoiceAmount}
              label={`${collectedPct.toFixed(1)} percent collected, ${outstandingPct.toFixed(1)} percent outstanding`}
            />

            {/* Text equivalent for the bar above — kept visible, not a tooltip. */}
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <dt className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" /> Collected</dt>
                <dd className="mt-1 font-heading text-xl font-extrabold tabular-nums text-slate-900" title={fmt(collected)}>{abbreviate(collected, currencySymbol)}</dd>
                <dd className="text-xs font-semibold text-emerald-800">{totalInvoiceAmount > 0 ? collectedPct.toFixed(1) : '0.0'}% of invoiced</dd>
              </div>
              <div className="min-w-0 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <dt className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden="true" /> Outstanding</dt>
                <dd className="mt-1 font-heading text-xl font-extrabold tabular-nums">
                  <Link
                    to="/finance/invoices?status=unpaid&sort=oldest"
                    title={fmt(outstanding)}
                    className="rounded text-slate-900 underline decoration-amber-500 decoration-2 underline-offset-4 hover:decoration-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {abbreviate(outstanding, currencySymbol)}
                  </Link>
                </dd>
                <dd className="text-xs font-semibold text-slate-600">{totalInvoiceAmount > 0 ? outstandingPct.toFixed(1) : '0.0'}% still to collect</dd>
              </div>
              <div className="min-w-0 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <dt className="text-[13px] font-semibold text-slate-600">Collection rate</dt>
                <dd className="mt-1 font-heading text-xl font-extrabold tabular-nums text-slate-900">{collectionRateBand == null ? '—' : `${collectionRateBand.toFixed(0)}%`}</dd>
                <dd className="text-xs font-semibold text-slate-600">Of everything invoiced</dd>
              </div>
              <div className="min-w-0 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <dt className="text-[13px] font-semibold text-slate-600">Avg. days to settle</dt>
                <dd className="mt-1 font-heading text-xl font-extrabold tabular-nums text-slate-900">{avgDaysToSettle == null ? '—' : `${avgDaysToSettle} day${avgDaysToSettle === 1 ? '' : 's'}`}</dd>
                <dd className="text-xs font-semibold text-slate-600">Raised to fully paid</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--rx-card-edge)] pt-4 text-sm text-slate-700">
              {oldestUnpaidDays !== null ? (
                <p className="flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0 text-amber-600" aria-hidden="true" />
                  <span>
                    {overdueCount > 0 && <strong className="text-slate-900">{overdueCount} invoice{overdueCount === 1 ? '' : 's'} overdue</strong>}
                    {overdueCount > 0 && ' · '}
                    oldest unpaid <strong className="tabular-nums text-slate-900">{oldestUnpaidDays} day{oldestUnpaidDays === 1 ? '' : 's'}</strong>
                  </span>
                </p>
              ) : <p className="text-slate-600">No outstanding invoices</p>}
              <Link
                to="/finance/payment-reminders"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-[color:var(--on-primary,#fff)] shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                style={{ color: onPrimary }}
              >
                <Send size={14} /> Send reminders
              </Link>
            </div>
          </section>
        </Section>

        <Section visible={widgets.financeSummary} allowed={allow('financeSummary')}>
          <section
            style={accentStyle(accentFor('People & Access'))}
            className="flex min-w-0 flex-col gap-4 rounded-[22px] border border-[color:var(--rx-card-edge)] bg-[linear-gradient(160deg,#ffffff_0%,var(--rx-card-tint)_75%)] p-6 xl:col-span-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-heading text-lg font-extrabold text-slate-900">Revenue</h2>
                <p className="text-[13px] text-slate-600">Money actually received, {preset.toLowerCase()}</p>
              </div>
              <Link to="/finance/reports" className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50">
                <ArrowUpRight size={12} /> View report
              </Link>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-600">Period revenue · {preset}</p>
              <p className="mt-1 break-words font-heading text-3xl font-extrabold tabular-nums tracking-tight text-slate-900" title={fmt(rangedRevenue)}>{fmt(rangedRevenue)}</p>
              {/* Value and delta are both computed over the SAME window
                  (rangedRevenue vs the prior period of equal length), so this
                  can never contradict the figure it sits next to. */}
              {momGrowthKind === 'pct' && (
                <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${parseFloat(momGrowth) > 0 ? 'bg-emerald-100 text-emerald-800' : parseFloat(momGrowth) < 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                  {parseFloat(momGrowth) > 0 ? <ArrowUp size={12} /> : parseFloat(momGrowth) < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
                  {momGrowth > 0 ? '+' : ''}{momGrowth}% vs prior period
                </p>
              )}
              {momGrowthKind === 'from-zero' && <p className="mt-2 text-xs font-semibold text-slate-600">New this period</p>}
              {momGrowthKind === 'no-baseline' && <p className="mt-2 text-xs text-slate-600">No prior period</p>}
            </div>
            <dl className="mt-auto space-y-2 border-t border-[color:var(--rx-card-edge)] pt-4 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-semibold text-slate-600">Payments received</dt>
                <dd className="font-heading font-extrabold tabular-nums text-slate-900">
                  {paymentsInRange.toLocaleString()}{averagePayment != null && <span className="font-sans text-xs font-semibold text-slate-600"> · avg {abbreviate(averagePayment, currencySymbol)}</span>}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-semibold text-slate-600">Year to date</dt>
                <dd className="font-heading text-lg font-extrabold tabular-nums text-slate-900" title={fmt(ytdRevenue)}>{fmt(ytdRevenue)}</dd>
              </div>
            </dl>
          </section>
        </Section>
      </div>

      {/* ══ PORTFOLIO — slow-moving counts, each a door to its list ══════════ */}
      <Section visible={widgets.kpiSummary} allowed={allow('kpiSummary')}>
        <nav aria-label="Portfolio" className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {portfolio.map((item) => (
            <TintCard
              key={item.label}
              to={item.to}
              accent={accentFor(item.module)}
              icon={item.icon}
              value={item.value.toLocaleString()}
              label={item.label}
            />
          ))}
        </nav>
      </Section>

      {/* ══ NEEDS YOUR ATTENTION — the approval queues this person can act on ═ */}
      {queues.length > 0 && (
        <section aria-label="Needs your attention" className="space-y-3 print:hidden">
          <SectionHeading>Needs your attention</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {queues.map((queue) => (
              <Link
                key={queue.key}
                to={queue.to}
                style={accentStyle(accentFor(queue.module))}
                className="flex items-center gap-4 rounded-[18px] border border-[color:var(--rx-card-edge)] bg-[linear-gradient(160deg,#ffffff_0%,var(--rx-card-tint)_75%)] p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--rx-card-fill)] text-[color:var(--rx-card-on-fill)]">
                  <queue.icon size={21} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{queue.label}</span>
                  <span className="block text-xs text-slate-600">{queue.sub}</span>
                </span>
                <span className={`min-w-[2rem] rounded-full px-2.5 py-1 text-center font-heading text-sm font-extrabold tabular-nums ${badgeCounts[queue.key] > 0 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {badgeCounts[queue.key]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/*
        ══ TOP PERFORMERS ══════════════════════════════════════════════════
        Directly under the executive numbers because it answers the question
        those numbers raise: the cash position says how much came in, this
        says where from.
      */}
      <Section visible={widgets.topPerformers} allowed={allow('topPerformers')}>
        <TopPerformersPanel data={topPerformers} fmt={fmt} period={preset} />
      </Section>

      {/* ══ REVENUE TREND + PROPERTY STATUS ══════════════════════════════════ */}
      <div className="grid gap-5 xl:grid-cols-12">
        <Section visible={widgets.revenueChart} allowed={allow('revenueChart')}>
          <Panel
            className="xl:col-span-8"
            title="Revenue trend"
            action={<PanelLink to="/finance/reports">View detailed report →</PanelLink>}
            subtitle={(
              <>
                {/* Compared LIKE FOR LIKE, against last week up to the same day —
                    and shaped by the delta classifier in useDashboardData, so a
                    near-zero baseline reads as a multiple, not a fault. */}
                This week vs last week, day for day
                {weekComparison?.delta && weekComparison.delta.kind !== 'no-baseline' && (
                  <>
                    {' · '}
                    {weekComparison.delta.kind === 'from-zero' ? (
                      <strong className="text-emerald-800">New this week</strong>
                    ) : (
                      <strong className={weekComparison.delta.pct >= 0 ? 'text-emerald-800' : 'text-rose-700'}>
                        {weekComparison.delta.pct >= 0 ? '▲' : '▼'}{' '}
                        {weekComparison.delta.kind === 'large'
                          ? `${weekComparison.delta.multiple.toFixed(weekComparison.delta.multiple >= 10 ? 0 : 1)}× last week`
                          : `${Math.abs(weekComparison.delta.pct).toFixed(1)}%`}
                      </strong>
                    )}
                    {` through ${weekComparison.throughDay}`}
                  </>
                )}
              </>
            )}
          >
            <RevenueChart data={weekComparison} fmt={fmt} />
          </Panel>
        </Section>
        <Section visible={widgets.propertyStatus} allowed={allow('propertyStatus')}>
          <Panel
            className={widgets.revenueChart && allow('revenueChart') ? 'xl:col-span-4' : 'xl:col-span-12'}
            title="Property status"
            subtitle="Portfolio availability breakdown"
            action={<PanelLink to="/properties">View all →</PanelLink>}
          >
            <PropertyStatusChart statusMap={propertyStatusMap} />
            <div className="grid grid-cols-2 gap-3">
              <MiniStat accent={accentFor('Properties')} value={units.total ? `${units.available.toLocaleString()} / ${units.total.toLocaleString()}` : '—'} label="Units available" />
              <MiniStat accent={accentFor('Sales & CRM')} value={units.held.toLocaleString()} label="Units held by payments" />
            </div>
          </Panel>
        </Section>
      </div>

      {/* ══ DEBTORS + REMINDERS ══════════════════════════════════════════════ */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Section visible={widgets.topDuePayments} allowed={allow('topDuePayments')}>
          <TopDuePaymentsTable invoices={duePayments} fmt={fmt} />
        </Section>
        <Section visible={widgets.paymentReminders} allowed={allow('paymentReminders')}>
          <PaymentRemindersWidget reminders={reminders} fmt={fmt} />
        </Section>
      </div>

      {/* ══ LEADS + PIPELINE + SUPPORT ═══════════════════════════════════════ */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Section visible={widgets.leadStatus} allowed={allow('leadStatus')}>
          <LeadStatusPanel statusMap={leadStatusMap} totalLeads={totalLeadsInRange} />
        </Section>

        {/* ══ PIPELINE — the one place a stepped/funnel treatment is earned ═══ */}
        <Section visible={widgets.operationalSummary} allowed={allow('operationalSummary')}>
          <Panel aria-label="Sales pipeline" title="Pipeline" subtitle={preset}>
            <div className="space-y-2.5">
              {[
                { label: 'Leads', value: totalLeadsInRange, note: totalLeadsInRange === 0 ? 'None captured' : 'Captured this period', width: '100%', module: 'Dashboard' },
                {
                  label: 'Qualified',
                  value: qualifiedLeads,
                  note: totalLeadsInRange > 0 ? `${((qualifiedLeads / totalLeadsInRange) * 100).toFixed(0)}% of leads` : 'No leads to qualify',
                  width: '84%',
                  module: 'Properties',
                },
                {
                  label: 'Sales',
                  value: totalSales,
                  note: totalLeadsInRange === 0 ? 'No prior period' : conversionRate != null ? `${conversionRate}% conversion` : '—',
                  width: '68%',
                  module: 'People & Access',
                },
              ].map((step) => (
                <div
                  key={step.label}
                  style={{ ...accentStyle(accentFor(step.module)), width: step.width }}
                  className="mx-auto flex items-center justify-between gap-3 rounded-2xl bg-[color:var(--rx-card-tint)] px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900">{step.label}</span>
                    <span className="block truncate text-xs text-slate-600">{step.note}</span>
                  </span>
                  <strong className={`font-heading text-2xl font-extrabold tabular-nums ${step.value === 0 ? 'text-slate-400' : 'text-slate-900'}`}>{step.value}</strong>
                </div>
              ))}
            </div>

            {totalLeadsInRange === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3">
                <p className="text-xs text-slate-600">No leads came in this period. Add one to start tracking conversion.</p>
                <Link
                  to="/crm/leads"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Plus size={12} /> Add a lead
                </Link>
              </div>
            )}
          </Panel>
        </Section>

        <Section visible={widgets.supportStats} allowed={allow('supportStats')}>
          <SupportStatsWidget
            open={openTickets}
            closed={closedTickets}
            escalated={escalatedTickets}
            total={totalTickets}
            avgResolutionHours={avgResolutionHours}
          />
        </Section>
      </div>

      {/* ══ REALTOR LEADERBOARD ══════════════════════════════════════════════ */}
      <Section visible={widgets.realtorLeaderboard} allowed={allow('realtorLeaderboard')}>
        <RealtorLeaderboard realtors={realtorLeaderboard} fmt={fmt} period={preset} range={getDateRange()} />
      </Section>

      {/* ══ ACTIVITY FEED + RECENT SALES ═════════════════════════════════════ */}
      <Section visible={widgets.recentActivities}>
        <RecentActivitiesFeed activities={activities} recentSales={recentSales} fmt={fmt} />
      </Section>

    </div>
  );
}

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { RefreshCw, ArrowUpRight, ArrowUp, ArrowDown, Minus, Send, Plus, Download } from 'lucide-react';

import useDashboardData from '../../hooks/useDashboardData';
import Select from '../../components/ui/Select';
import ExportProgress from '../../components/common/ExportProgress';
import { isStaleBuildError } from '../../utils/lazyImport';
import { exportDashboardPdf, exportDashboardExcel } from '../../utils/dashboardExport';
import useDashboardStore from '../../store/dashboardStore';
import { useCurrency, useAppearance, useBrandSurface } from '../../context/useAppearance';
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
  const { primary_color, currencySymbol } = useAppearance();
  /*
   * The executive card's palette, derived from the tenant's darker brand
   * colour. Spread onto the card as a style object; everything inside reads
   * var(--sf-…) from it.
   */
  const surface = useBrandSurface();
  const accent = primary_color || '#2563eb';
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

  return (
    <div className="space-y-8 print:space-y-4">

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="border-b border-slate-100 pb-5 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-0.5 text-xs text-[#5A5A5A]">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {lastUpdated && <> · updated {formatUpdatedAgo(lastUpdated)}</>}
            </p>
          </div>
          {/* min-w-0 on every child below stops long labels ("Print / Export")
              from being clipped at the container edge instead of wrapping. */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <DateFilterBar />
            <NotificationsPanel notifications={notifications} onDismiss={dismissNotif} />
            <button
              onClick={reload}
              aria-label="Refresh dashboard data"
              title="Refresh dashboard data"
              className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors motion-reduce:transition-none"
            >
              <RefreshCw size={14} />
            </button>
            {/*
              The shared Select, matching DateFilterBar beside it.

              This was a native <select>, whose option list is drawn by the
              operating system and so ignores the design tokens entirely — it
              looked like a different application next to the controls either
              side of it. Select renders its own list, and the wrapper here
              mirrors DateFilterBar's framing so the two read as a pair.
            */}
            <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
              <Download size={13} className="shrink-0 text-slate-400" />
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
          </div>
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
      </div>

      {/* ══ CASH POSITION ════════════════════════════════════════════════════
          Revenue, receivables and collection rate are one number split two
          ways, not three independent facts — a stacked bar makes that
          arithmetic visible instead of three cards that can silently drift
          apart. "Collected" here is derived (invoiced − outstanding), so it
          can never disagree with the other two. */}
      <Section visible={widgets.kpiSummary} allowed={allow('kpiSummary')}>
        <div className="space-y-3">
          {/*
            Filled with the tenant's darker brand colour, and everything inside
            it derived from that fill — see useBrandSurface and surfaceTokens.
            It was slate-900 with fourteen hand-picked slates, emeralds and
            ambers on top, each of which was right for slate-900 and would have
            been wrong for anything else.
          */}
          <section aria-label="Cash position" style={surface} className="rounded-2xl bg-[color:var(--sf-fill)] p-6 text-[color:var(--sf-ink)] sm:p-8">
            <p className="text-xs text-[color:var(--sf-ink-subtle)]">Invoiced to date · {preset}</p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-3xl font-bold tabular-nums sm:text-4xl lg:text-[44px]" title={fmt(totalInvoiceAmount)}>
              {abbreviate(totalInvoiceAmount, currencySymbol)}
              <span className="text-sm font-normal text-[color:var(--sf-ink-subtle)]">across {totalInvoices.toLocaleString()} invoice{totalInvoices === 1 ? '' : 's'}</span>
            </p>

            <div
              role="img"
              aria-label={`${collectedPct.toFixed(1)} percent collected, ${outstandingPct.toFixed(1)} percent outstanding`}
              className="mt-5 flex h-3 overflow-hidden rounded-full bg-[color:var(--sf-track)]"
            >
              {/* Collected: positive fill. Outstanding: neutral, not red — it's expected, not a failure.
                  Both keep their hue and move only in lightness, far enough to stay visible on whatever
                  the card is filled with. */}
              <span className="bg-[color:var(--sf-positive)] transition-all motion-reduce:transition-none" style={{ width: `${collectedPct}%` }} />
              <span className="bg-[color:var(--sf-warning-soft)] transition-all motion-reduce:transition-none" style={{ width: `${outstandingPct}%` }} />
            </div>

            {/* Text equivalent for the bar above — kept visible, not a tooltip. */}
            <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-[color:var(--sf-ink-subtle)]"><span className="h-2 w-2 rounded-sm bg-[color:var(--sf-positive)]" aria-hidden="true" /> Collected</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums" title={fmt(collected)}>
                  {abbreviate(collected, currencySymbol)} <span className="text-sm font-normal text-[color:var(--sf-ink-subtle)]">· {totalInvoiceAmount > 0 ? collectedPct.toFixed(1) : '0.0'}%</span>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-[color:var(--sf-ink-subtle)]"><span className="h-2 w-2 rounded-sm bg-[color:var(--sf-warning)]" aria-hidden="true" /> Outstanding</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">
                  <Link
                    to="/finance/invoices?status=unpaid&sort=oldest"
                    title={fmt(outstanding)}
                    className="rounded underline decoration-current/50 decoration-1 underline-offset-2 hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sf-ink)]"
                  >
                    {abbreviate(outstanding, currencySymbol)}
                  </Link>
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--sf-line)] pt-4 text-xs text-[color:var(--sf-ink-muted)]">
              {oldestUnpaidDays !== null ? (
                <p>
                  {overdueCount > 0 && <span className="font-semibold text-[color:var(--sf-warning)]">{overdueCount} invoice{overdueCount === 1 ? '' : 's'} overdue</span>}
                  {overdueCount > 0 && ' · '}
                  oldest unpaid <span className="font-semibold text-[color:var(--sf-ink)] tabular-nums">{oldestUnpaidDays} day{oldestUnpaidDays === 1 ? '' : 's'}</span>
                </p>
              ) : <p className="text-[color:var(--sf-ink-subtle)]">No outstanding invoices</p>}
              <Link
                to="/finance/payment-reminders"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--sf-border)] px-3 py-1.5 font-medium text-[color:var(--sf-ink)] hover:border-[color:var(--sf-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sf-ink)] transition-colors motion-reduce:transition-none"
              >
                <Send size={12} /> Send reminders
              </Link>
            </div>
          </section>

          {/* ══ PORTFOLIO — one compact row of slow-moving counts ══════════ */}
          <nav aria-label="Portfolio" className="flex flex-wrap divide-y divide-slate-100 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 sm:flex-nowrap sm:divide-x sm:divide-y-0">
            {[
              { label: 'Clients', value: totalClients, to: '/users/clients' },
              { label: 'Properties', value: totalProperties, to: '/properties' },
              { label: 'Invoices', value: totalInvoices, to: '/finance/invoices' },
              { label: 'Staff', value: totalStaff, to: '/users/employees' },
              { label: 'Realtors', value: totalRealtors, to: '/users/realtors' },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="group flex min-w-0 flex-1 basis-1/2 items-baseline gap-2 px-5 py-3.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:basis-auto"
              >
                <span className="text-lg font-semibold tabular-nums text-slate-900">{item.value.toLocaleString()}</span>
                <span className="truncate text-xs text-slate-500 group-hover:text-slate-700">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </Section>

      {/*
        ══ TOP PERFORMERS ══════════════════════════════════════════════════
        Placed directly under the executive numbers because it answers the
        question those numbers raise: the cash position says how much came in,
        this says where from.
      */}
      <Section visible={widgets.topPerformers} allowed={allow('topPerformers')}>
        <TopPerformersPanel data={topPerformers} fmt={fmt} period={preset} />
      </Section>

      {/* ══ REVENUE TREND CHART ════════════════════════════════════════════════ */}
      <Section visible={widgets.revenueChart} allowed={allow('revenueChart')}>
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            {/*
              Title and link share one baseline — the link is a destination for
              this panel, not a second heading, so it sits on the title's line
              and is muted until it is wanted.
            */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-sm font-semibold text-slate-900">Revenue Trend</h2>
              <Link
                to="/finance/reports"
                className="rounded text-[13px] text-slate-500 underline-offset-4 transition-colors hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                View detailed report →
              </Link>
            </div>
            {/*
              The comparison is stated in words as well as drawn, because the
              number people repeat to each other is "up 12% on last week" —
              and it is compared LIKE FOR LIKE, against last week up to the
              same day. Against last week's full total this week would be
              behind until Sunday evening, every week.

              What SHAPE that statement takes depends on the data: see the
              delta classifier in useDashboardData. A percentage against a
              near-zero baseline is arithmetically true and reads as a fault,
              so past 500% it becomes a multiple, and a week that began from
              nothing says so instead of dividing by zero.
            */}
            <p className="text-[11px] text-slate-400">
              This week vs last week, day for day
              {weekComparison?.delta && weekComparison.delta.kind !== 'no-baseline' && (
                <>
                  {' · '}
                  {weekComparison.delta.kind === 'from-zero' ? (
                    <span className="text-emerald-600">New this week</span>
                  ) : (
                    <span className={weekComparison.delta.pct >= 0 ? 'text-emerald-600' : 'text-rose-500'}>
                      {weekComparison.delta.pct >= 0 ? '▲' : '▼'}{' '}
                      {weekComparison.delta.kind === 'large'
                        ? `${weekComparison.delta.multiple.toFixed(weekComparison.delta.multiple >= 10 ? 0 : 1)}× last week`
                        : `${Math.abs(weekComparison.delta.pct).toFixed(1)}%`}
                    </span>
                  )}
                  {` through ${weekComparison.throughDay}`}
                </>
              )}
            </p>
          </div>
          <RevenueChart data={weekComparison} fmt={fmt} />
        </section>
      </Section>

      {/* ══ REVENUE PANEL ════════════════════════════════════════════════════ */}
      <Section visible={widgets.financeSummary} allowed={allow('financeSummary')}>
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Revenue Panel</h2>
              <p className="text-[11px] text-slate-400">Money actually received, {preset.toLowerCase()}</p>
            </div>
            <Link to="/finance/reports" className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <ArrowUpRight size={11} /> View Report
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Period Revenue · {preset}</p>
              <p className="mt-1 break-words text-2xl font-bold leading-tight tabular-nums" style={{ color: accent }} title={fmt(rangedRevenue)}>{fmt(rangedRevenue)}</p>
              {/* Value and delta are both computed over the SAME window
                  (rangedRevenue vs the prior period of equal length), so this
                  can never contradict the figure it sits next to. */}
              {momGrowthKind === 'pct' && (
                <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${parseFloat(momGrowth) > 0 ? 'text-emerald-600' : parseFloat(momGrowth) < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {parseFloat(momGrowth) > 0 ? <ArrowUp size={12} /> : parseFloat(momGrowth) < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
                  {momGrowth > 0 ? '+' : ''}{momGrowth}% vs prior period
                </div>
              )}
              {momGrowthKind === 'from-zero' && <p className="mt-1.5 text-xs font-medium text-slate-400">New this period</p>}
              {momGrowthKind === 'no-baseline' && <p className="mt-1.5 text-xs text-slate-400">No prior period</p>}
            </div>
            <div className="min-w-0 rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Year to date</p>
              <p className="mt-1 break-words text-xl font-bold leading-tight text-slate-900 tabular-nums" title={fmt(ytdRevenue)}>{fmt(ytdRevenue)}</p>
            </div>
          </div>
        </section>
      </Section>

      {/* ══ SECTION 4 — DEBTORS + REMINDERS ══════════════════════════════════ */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Section visible={widgets.topDuePayments} allowed={allow('topDuePayments')}>
          <TopDuePaymentsTable invoices={duePayments} fmt={fmt} />
        </Section>
        <Section visible={widgets.paymentReminders} allowed={allow('paymentReminders')}>
          <PaymentRemindersWidget reminders={reminders} fmt={fmt} />
        </Section>
      </div>

      {/* ══ SECTION 5 — LEAD STATUS + PROPERTY STATUS ════════════════════════ */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Section visible={widgets.leadStatus} allowed={allow('leadStatus')}>
          <LeadStatusPanel statusMap={leadStatusMap} totalLeads={totalLeadsInRange} />
        </Section>
        <Section visible={widgets.propertyStatus} allowed={allow('propertyStatus')}>
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Property Status</h2>
                <p className="text-[11px] text-slate-400">Portfolio availability breakdown</p>
              </div>
              <Link to="/properties" className="text-xs font-medium text-blue-600 hover:underline">View All →</Link>
            </div>
            <PropertyStatusChart statusMap={propertyStatusMap} />
          </section>
        </Section>
      </div>

      {/* ══ SECTION 6 — REALTOR LEADERBOARD ══════════════════════════════════ */}
      <Section visible={widgets.realtorLeaderboard} allowed={allow('realtorLeaderboard')}>
        <RealtorLeaderboard realtors={realtorLeaderboard} fmt={fmt} period={preset} range={getDateRange()} />
      </Section>

      {/* ══ SECTION 7 — ACTIVITY FEED + RECENT SALES ════════════════════════ */}
      <Section visible={widgets.recentActivities}>
        <RecentActivitiesFeed activities={activities} recentSales={recentSales} fmt={fmt} />
      </Section>

      {/* ══ PIPELINE — the one place a stepped/funnel treatment is earned ═══ */}
      <Section visible={widgets.operationalSummary} allowed={allow('operationalSummary')}>
        <section aria-label="Sales pipeline" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Pipeline</h2>
            <span className="text-[11px] text-slate-400">{preset}</span>
          </div>

          <div className="flex flex-col divide-y divide-slate-100 sm:flex-row sm:divide-x sm:divide-y-0">
            <div className="min-w-0 flex-1 pb-4 sm:pb-0 sm:pr-6">
              <p className="text-xs text-[#5A5A5A]">Leads</p>
              <p className={`mt-1 text-[28px] font-semibold leading-none tabular-nums ${totalLeadsInRange === 0 ? 'font-normal text-slate-300' : 'text-slate-900'}`}>{totalLeadsInRange}</p>
              <p className="mt-1.5 text-xs text-slate-400">{totalLeadsInRange === 0 ? 'None captured' : 'Captured this period'}</p>
            </div>
            <div className="min-w-0 flex-1 py-4 sm:py-0 sm:px-6">
              <p className="text-xs text-[#5A5A5A]">Qualified</p>
              <p className={`mt-1 text-[28px] font-semibold leading-none tabular-nums ${qualifiedLeads === 0 ? 'font-normal text-slate-300' : 'text-slate-900'}`}>{qualifiedLeads}</p>
              <p className="mt-1.5 text-xs font-medium" style={{ color: totalLeadsInRange > 0 ? accent : undefined }}>
                {totalLeadsInRange > 0 ? `${((qualifiedLeads / totalLeadsInRange) * 100).toFixed(0)}% of leads` : <span className="font-normal text-slate-400">No leads to qualify</span>}
              </p>
            </div>
            <div className="min-w-0 flex-1 pt-4 sm:pt-0 sm:pl-6">
              <p className="text-xs text-[#5A5A5A]">Sales</p>
              <p className={`mt-1 text-[28px] font-semibold leading-none tabular-nums ${totalSales === 0 ? 'font-normal text-slate-300' : 'text-slate-900'}`}>{totalSales}</p>
              <p className="mt-1.5 text-xs text-slate-400">
                {totalLeadsInRange === 0 ? 'No prior period' : conversionRate != null ? `${conversionRate}% conversion` : '—'}
              </p>
            </div>
          </div>

          {totalLeadsInRange === 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500">No leads came in this period. Add one to start tracking conversion.</p>
              <Link
                to="/crm/leads"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              >
                <Plus size={12} /> Add a lead
              </Link>
            </div>
          )}
        </section>
      </Section>

      {/* ══ SECTION 8 — SUPPORT PERFORMANCE ════════════════════════════════ */}
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
  );
}

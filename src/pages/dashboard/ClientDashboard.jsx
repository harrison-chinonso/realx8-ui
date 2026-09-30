import { useCallback, useEffect, useState } from 'react';
import { getDashboardSummary } from '../../api/userApi';
import { Link } from 'react-router-dom';
import {
  FileText, Home, CheckCircle2, Clock, Ticket, CreditCard,
} from 'lucide-react';
import {
  DashboardHero, HeroFigure, TintCard, Panel, PanelLink, MiniStat, useModuleAccent,
} from '../../components/dashboard/DashboardKit';
import { accentStyle } from '../../components/layout/launcherPalette';
import TransactionHistory from '../../components/dashboard/TransactionHistory';
import InvoicePickerModal from '../../components/finance/InvoicePickerModal';
import PayInvoiceModal from '../../components/finance/PayInvoiceModal';
import { useCurrency } from '../../context/useAppearance';
import useAuthStore from '../../store/authStore';
import usePromotionAdverts from '../../hooks/usePromotionAdverts';
import PromotionAdvertCarousel from '../../components/promotions/PromotionAdvertCarousel';
import PromotionAdvertModal from '../../components/promotions/PromotionAdvertModal';

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
};

export default function ClientDashboard() {
  const fmt = useCurrency();
  const { accentFor } = useModuleAccent();
  const user = useAuthStore((state) => state.user);
  // Properties this company is promoting. Empty for everyone with nothing on
  // offer, so both advert components render nothing at all.
  const { slides: adverts } = usePromotionAdverts();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // Two steps, two pieces of state: which invoice, and then paying it. The
  // picker closes as the payment modal opens, so they are never both on screen.
  const [picking, setPicking] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    getDashboardSummary()
      .then((response) => { if (!cancelled) setData(response?.data ?? response); })
      .catch((err) => { if (!cancelled) setError(err?.userMessage || 'Could not load your dashboard.'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => load(), [load]);

  if (error) return <div className="rounded-2xl bg-rose-50 p-6 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>;

  if (!data) {
    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const invoices = data.invoices || {};
  const nextDue = formatDate(invoices.nextDueDate);
  const next = data.nextPayment;
  const account = data.account || {};
  // In-progress plans first; a plan paid off long ago is reassurance, not news.
  const plans = [...(data.plans || [])]
    .sort((a, b) => Number(a.paidSchedules >= a.schedules) - Number(b.paidSchedules >= b.schedules))
    .slice(0, 3);
  const upcoming = data.upcomingInstallments || [];
  const hasUnpaid = (invoices.unpaid?.count ?? 0) > 0;
  const daysUntil = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const days = Math.ceil((date.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
    if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue`;
    if (days === 0) return 'Due today';
    return `In ${days} day${days === 1 ? '' : 's'}`;
  };

  return (
    <div className="space-y-6">
      <DashboardHero
        kicker="Welcome back,"
        title={user?.name || 'there'}
        subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        /*
          Pay now is offered whenever anything is outstanding, and simply absent
          when nothing is — a Pay now that opens an empty list is a dead end, and
          the summary already says the balance is zero.
        */
        aside={(next || hasUnpaid) ? (
          <>
            {next ? (
              <HeroFigure label={`Next payment · due ${formatDate(next.dueDate)}`} value={fmt(next.amount)} />
            ) : (
              <HeroFigure label={nextDue ? `Outstanding · earliest due ${nextDue}` : 'Outstanding'} value={fmt(invoices.unpaid?.value ?? 0)} />
            )}
            {hasUnpaid && (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <CreditCard size={17} /> Pay now
              </button>
            )}
          </>
        ) : null}
      />

      {/* Directly under the banner, above everything else on the page: what
          the company is promoting, and one tap to buy it. */}
      <PromotionAdvertCarousel slides={adverts} />
      <PromotionAdvertModal slides={adverts} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <TintCard
          accent={accentFor('Finance')}
          icon={FileText}
          label="Invoices"
          value={`${invoices.count ?? 0} · ${fmt(invoices.value ?? 0)}`}
          sub={nextDue ? `Next due ${nextDue}` : 'Nothing currently due'}
          to="/finance/my-invoices"
        />
        <TintCard
          accent={accentFor('Properties')}
          icon={Home}
          label="Properties purchased"
          value={data.purchases?.count ?? 0}
          sub={`Worth ${fmt(data.purchases?.value ?? 0)}`}
          to="/finance/my-properties"
        />
        <TintCard
          accent={accentFor('People & Access')}
          icon={CheckCircle2}
          label="Paid invoices"
          value={`${invoices.paid?.count ?? 0} · ${fmt(invoices.paid?.value ?? 0)}`}
          sub="Approved and settled"
        />
        <TintCard
          accent={accentFor('Sales & CRM')}
          icon={Clock}
          label="Unpaid invoices"
          value={`${invoices.unpaid?.count ?? 0} · ${fmt(invoices.unpaid?.value ?? 0)}`}
          sub={nextDue ? `Earliest due ${nextDue}` : undefined}
        />
        <TintCard
          accent={accentFor('Operations & Support')}
          icon={Ticket}
          label="Active tickets"
          value={data.activeTickets ?? 0}
          sub="Open or in progress"
          to="/support"
        />
      </div>

      {/* One card per purchase: how far through its payments the buyer is. */}
      {plans.length > 0 && (
        <div className="space-y-3">
          {plans.map((plan) => {
            const settled = plan.schedules > 0 && plan.paidSchedules >= plan.schedules;
            const segments = Array.from({ length: Math.min(plan.schedules, 24) }, (_, index) => index < plan.paidSchedules);
            return (
              <Panel key={plan.id} as="section" aria-label={`Payment plan for ${plan.title}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 lg:w-72">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                      {plan.paymentType === 'installment' ? 'Your payment plan' : 'Your purchase'}
                    </p>
                    <p className="font-heading text-lg font-extrabold text-slate-900">{plan.title}</p>
                    <p className="text-sm text-slate-600">
                      {plan.planName ? `${plan.planName} · ` : ''}
                      {settled ? 'Paid in full' : `${plan.paidSchedules} of ${plan.schedules} ${plan.schedules === 1 ? 'payment' : 'installments'} paid`}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div
                      role="img"
                      aria-label={`${plan.paidSchedules} of ${plan.schedules} paid`}
                      className="grid gap-1.5"
                      style={{ gridTemplateColumns: `repeat(${Math.max(segments.length, 1)}, minmax(0, 1fr))` }}
                    >
                      {segments.map((paid, index) => (
                        <span key={index} className={`h-3 rounded-full ${paid ? 'bg-emerald-500' : index === plan.paidSchedules ? 'bg-amber-400' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-600">
                      <span><strong className="text-slate-900">{fmt(Math.max(plan.total - plan.outstanding, 0))}</strong> paid</span>
                      <span><strong className="text-slate-900">{fmt(plan.outstanding)}</strong> to go</span>
                    </div>
                  </div>
                  <Link to={`/finance/invoices/${plan.invoiceId}`} className="shrink-0 self-start rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-200 lg:self-center">
                    View schedule
                  </Link>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="Upcoming installments" subtitle="What is due next, and when" action={<PanelLink to="/finance/my-invoices">My invoices →</PanelLink>}>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-600">Nothing scheduled — you are all paid up.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((row, index) => {
                const date = new Date(row.dueDate);
                return (
                  <li key={row.id} className="flex items-center gap-4 py-3">
                    <span
                      style={accentStyle(row.overdue ? accentFor('Sales & CRM') : accentFor('Dashboard'))}
                      className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[color:var(--rx-card-tint)] text-[color:var(--rx-card-link)]"
                    >
                      <span className="text-[11px] font-extrabold uppercase tracking-wide">{date.toLocaleString('en-US', { month: 'short' })}</span>
                      <span className="font-heading text-xl font-extrabold leading-none">{date.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900">{row.title}</span>
                      <span className={`block text-xs ${row.overdue ? 'font-semibold text-rose-700' : 'text-slate-600'}`}>
                        {daysUntil(row.dueDate)}{index === 0 && !row.overdue ? ' · next' : ''}
                      </span>
                    </span>
                    <strong className="font-heading text-base font-extrabold tabular-nums text-slate-900">{fmt(row.amount)}</strong>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-5" title="Account snapshot" subtitle="Everything you have bought, in one place">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat accent={accentFor('Dashboard')} value={fmt(data.purchases?.value ?? 0)} label="Total purchase value" />
            <MiniStat accent={accentFor('People & Access')} value={fmt(account.paidToDate ?? 0)} label="Paid to date" />
            <MiniStat accent={accentFor('Sales & CRM')} value={fmt(invoices.unpaid?.value ?? 0)} label="Still to pay" />
            <MiniStat accent={accentFor('Properties')} value={fmt(account.lateFees ?? 0)} label="Late fees" />
            <MiniStat
              accent={accentFor('Finance')}
              value={account.settledInstallments ? `${account.onTimeInstallments} of ${account.settledInstallments}` : '—'}
              label="Paid on time"
            />
            <MiniStat accent={accentFor('Marketing & Content')} value={(account.unitsHeld ?? 0).toLocaleString()} label="Units held for you" />
          </div>
        </Panel>
      </div>

      {/*
        Payments, not transactions — and the heading says so.
        `payments` is the accurate field; `transactions` is the alias the API
        still sends for clients that have not been redeployed. Reading both
        means this panel does not depend on which one arrives first.
      */}
      <TransactionHistory
        title="Recent Payments"
        rows={data.payments || data.transactions || []}
        fmt={fmt}
        emptyText="No payments yet. Anything you submit appears here straight away, before it is approved."
      />

      <InvoicePickerModal
        open={picking}
        userId={user?.id}
        onClose={() => setPicking(false)}
        onSelect={(invoiceId) => { setPicking(false); setPayingInvoiceId(invoiceId); }}
      />
      <PayInvoiceModal
        open={Boolean(payingInvoiceId)}
        invoiceId={payingInvoiceId}
        onClose={() => setPayingInvoiceId(null)}
        /**
         * Reload after a receipt is submitted: the invoice moves to
         * payment_under_review, so the tiles the buyer just acted on are now
         * stale and would still be inviting them to pay it.
         */
        onSubmitted={() => { setPayingInvoiceId(null); load(); }}
      />
    </div>
  );
}

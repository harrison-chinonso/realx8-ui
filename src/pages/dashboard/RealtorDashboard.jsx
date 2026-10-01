import { useCallback, useEffect, useState } from 'react';
import { getDashboardSummary, getMyKyc } from '../../api/userApi';
import LevelBadge from '../../components/common/LevelBadge';
import VerificationPrompt from '../../components/dashboard/VerificationPrompt';
import VerificationBadge from '../../components/common/VerificationBadge';
import { Link } from 'react-router-dom';
import {
  UserPlus, Target, Briefcase, Eye, Ticket, Home, Wallet,
} from 'lucide-react';
import {
  DashboardHero, HeroFigure, TintCard, TrendChip, Panel, PanelLink, MiniStat, SectionHeading, SplitBar, useModuleAccent,
} from '../../components/dashboard/DashboardKit';
import { accentStyle } from '../../components/layout/launcherPalette';
import TransactionHistory from '../../components/dashboard/TransactionHistory';
import { useCurrency } from '../../context/useAppearance';
import useAuthStore from '../../store/authStore';
import usePromotionAdverts from '../../hooks/usePromotionAdverts';
import PromotionAdvertCarousel from '../../components/promotions/PromotionAdvertCarousel';
import PromotionAdvertModal from '../../components/promotions/PromotionAdvertModal';
import RequestPayoutModal, { requestableOf } from '../../components/finance/RequestPayoutModal';
import { getMyCommissions } from '../../api/financeApi';

const STATUS_ORDER = ['pending', 'confirmed', 'completed', 'cancelled'];

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

export default function RealtorDashboard() {
  const fmt = useCurrency();
  const { accentFor } = useModuleAccent();
  const user = useAuthStore((state) => state.user);
  // The same offers a client sees, with Share link in place of Buy now — a
  // realtor's move on a promotion is to put it in front of somebody.
  const { slides: adverts } = usePromotionAdverts();
  /*
   * Commissions this realtor could ask to be paid.
   *
   * Whether the button appears is the SERVER's answer (`summary.can_request`),
   * not a sum worked out here: requesting is gated on a verified identity and
   * the company's minimum payout as well as on there being something to ask
   * for, and re-deriving those in the browser would be a second opinion free to
   * offer a button the handler then refuses.
   */
  const [commissions, setCommissions] = useState([]);
  const [payoutSummary, setPayoutSummary] = useState(null);
  const [showPayout, setShowPayout] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // Fetched once here and shared with both the prompt and the Verified badge.
  const [kyc, setKyc] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    getDashboardSummary()
      .then((response) => { if (!cancelled) setData(response?.data ?? response); })
      .catch((err) => { if (!cancelled) setError(err?.userMessage || 'Could not load your dashboard.'); });
    return () => { cancelled = true; };
  }, []);

  const loadCommissions = useCallback(() => {
    getMyCommissions()
      .then((response) => {
        setCommissions(response?.data ?? []);
        setPayoutSummary(response?.summary ?? null);
      })
      // A dashboard tile is not worth an error. No summary simply means no
      // button, which is the same thing a realtor with nothing owed sees.
      .catch(() => { setCommissions([]); setPayoutSummary(null); });
  }, []);

  useEffect(() => { loadCommissions(); }, [loadCommissions]);

  useEffect(() => {
    let cancelled = false;
    getMyKyc()
      .then((r) => { if (!cancelled) setKyc(r?.data ?? null); })
      .catch(() => { if (!cancelled) setKyc(null); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="rounded-2xl bg-rose-50 p-6 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>;

  if (!data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const inspections = data.inspections || { total: 0, byStatus: {} };
  const breakdown = STATUS_ORDER
    .filter((status) => inspections.byStatus?.[status])
    .map((status) => `${inspections.byStatus[status]} ${status}`)
    .join(' · ');

  const requestable = requestableOf(commissions);
  const growth = data.growth || {};
  const series = growth.commissionByMonth || [];
  const peak = Math.max(...series.map((m) => m.amount), 0);
  const network = data.network || {};
  const upcoming = data.upcomingInspections || [];
  const ratio = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');
  // What can be asked for now, from both commission systems, as the server
  // totals it — shown beside the button, never used to decide it.
  const availableToRequest = Number(payoutSummary?.requestable || 0) + Number(payoutSummary?.engine_available || 0);
  const commission = data.commission || {};

  const payoutButton = payoutSummary?.can_request && (
    payoutSummary.request_via === 'statement' ? (
      /*
       * The engine holds entitlements in a ledger and requests against a
       * balance, picking the lines on the statement screen. The dashboard does
       * not hold those ids, so it sends the realtor there rather than offering
       * a modal that cannot complete the request.
       */
      <Link to="/finance/my-commission" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <Wallet size={17} /> Request payout
      </Link>
    ) : requestable.length > 0 && (
      <button type="button" onClick={() => setShowPayout(true)} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <Wallet size={17} /> Request payout
      </button>
    )
  );

  return (
    <div className="space-y-6">
      {/*
        Same shape as the client dashboard's banner, so Request payout sits
        exactly where Pay now does over there. Offered only when a request
        would actually be accepted — the server weighs the amount, the identity
        check and the company's minimum and answers can_request.
      */}
      <DashboardHero
        kicker="Welcome back,"
        title={user?.name || 'there'}
        badges={(
          <>
            {kyc?.status === 'approved' && <VerificationBadge status="approved" size="lg" />}
            {/* The level links to the tab where an upgrade is requested — the
                only action a realtor can take on it from here. */}
            <Link
              to="/profile?tab=level"
              title={data.level ? `${data.level.name} — request an upgrade` : 'Request a level'}
              className="rounded-full transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {data.level
                ? <LevelBadge level={data.level} size="lg" />
                : <span className="inline-block rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-slate-700">No level yet</span>}
            </Link>
          </>
        )}
        subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        aside={(availableToRequest > 0 || payoutButton) ? (
          <>
            <HeroFigure label="Available to request" value={fmt(availableToRequest)} />
            {payoutButton}
          </>
        ) : null}
      />

      <VerificationPrompt record={kyc} loading={kyc === undefined} />

      {/* Top of the page, matching where the client dashboard puts it. */}
      <PromotionAdvertCarousel slides={adverts} />
      <PromotionAdvertModal slides={adverts} />

      <RequestPayoutModal
        open={showPayout}
        onClose={() => setShowPayout(false)}
        commissions={commissions}
        summary={payoutSummary}
        // Re-read after each request so the button disappears once the last
        // requestable commission has been asked for.
        onRequested={loadCommissions}
      />

      <section className="space-y-3">
        <SectionHeading>Business summary</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <TintCard
            accent={accentFor('My Referrals')}
            icon={UserPlus}
            value={data.referrals?.total ?? 0}
            label="Referrals"
            sub={`${data.referrals?.clients ?? 0} clients · ${data.referrals?.realtors ?? 0} realtors`}
            to="/realtor/referrals"
          />
          <TintCard accent={accentFor('Sales & CRM')} icon={Target} value={data.leads ?? 0} label="Leads" sub="Created by or assigned to you" />
          <TintCard accent={accentFor('Dashboard')} icon={Briefcase} value={data.deals ?? 0} label="Deals" sub="Open in your pipeline" />
          <TintCard accent={accentFor('Properties')} icon={Eye} value={inspections.total} label="Inspections" sub={breakdown || 'No inspections yet'} />
          <TintCard accent={accentFor('Operations & Support')} icon={Ticket} value={data.activeTickets ?? 0} label="Active tickets" sub="Open or in progress" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading>Payment overview</SectionHeading>
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-3">
            <TintCard
              accent={accentFor('Dashboard')}
              icon={Home}
              value={data.clientPurchases?.count ?? 0}
              label="Client purchases"
              sub={`Worth ${fmt(data.clientPurchases?.value ?? 0)}`}
              className="h-full"
            />
          </div>
          <Panel className="xl:col-span-9">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-xs font-semibold text-slate-600">Total commission</dt>
                <dd className="mt-1 break-words text-2xl font-bold tabular-nums text-slate-900">{fmt(commission.total ?? 0)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" /> Paid commission</dt>
                <dd className="mt-1 break-words text-2xl font-bold tabular-nums text-slate-900">{fmt(commission.paid ?? 0)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden="true" /> Unpaid commission</dt>
                <dd className="mt-1 break-words text-2xl font-bold tabular-nums text-slate-900">{fmt(commission.unpaid ?? 0)}</dd>
                <dd className="text-xs text-slate-600">Pending or approved</dd>
              </div>
            </dl>
            <SplitBar done={Number(commission.paid) || 0} total={Number(commission.total) || 0} label={`${ratio(Number(commission.paid) || 0, Number(commission.total) || 0)} of commission paid`} />
          </Panel>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading>Your growth</SectionHeading>
        <div className="grid gap-4 lg:grid-cols-12">
          {/*
            Levels are requested and approved rather than earned by a count, so
            there is no progress bar to draw — only where the realtor stands,
            what the next rung pays, and the way to ask for it.
          */}
          <Panel className="lg:col-span-5" title="Your level" action={<PanelLink to="/profile?tab=level">Request upgrade →</PanelLink>}>
            <div className="flex flex-wrap items-center gap-3">
              {data.level ? <LevelBadge level={data.level} size="lg" /> : <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">No level yet</span>}
              {data.level?.commission_percentage != null && (
                <span className="text-sm text-slate-700">
                  <strong className="text-lg font-bold">{Number(data.level.commission_percentage)}%</strong> direct rate
                  {data.level.rate_in_force === false && <span className="text-slate-500"> · not applied by your company&apos;s plan</span>}
                </span>
              )}
            </div>
            {growth.nextLevel ? (
              <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Next level</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{growth.nextLevel.name}</p>
                <p className="text-sm text-slate-700">
                  {growth.nextLevel.commission_percentage != null && <>{Number(growth.nextLevel.commission_percentage)}% direct rate</>}
                  {growth.nextLevel.levelup_fee > 0 && <> · level-up fee {fmt(growth.nextLevel.levelup_fee)}</>}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">{data.level ? 'You are on the highest level your company offers.' : 'Ask for a level to start earning your level rate.'}</p>
            )}
          </Panel>

          <Panel className="lg:col-span-3" title="Conversion">
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{ratio(data.deals ?? 0, data.leads ?? 0)}</p>
              <p className="text-xs text-slate-600">Leads that became deals</p>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <p className="text-2xl font-bold tabular-nums text-slate-900">{ratio(data.clientPurchases?.count ?? 0, data.referrals?.clients ?? 0)}</p>
              <p className="text-xs text-slate-600">Referred clients who bought</p>
            </div>
          </Panel>

          <Panel
            className="lg:col-span-4"
            title="Commission earned"
            subtitle="This month"
            action={<TrendChip current={growth.commissionThisMonth} previous={growth.commissionLastMonth} />}
          >
            <p className="text-2xl font-bold tabular-nums text-slate-900">{fmt(growth.commissionThisMonth ?? 0)}</p>
            <div className="flex h-24 items-end gap-2" role="img" aria-label={`Commission by month: ${series.map((m) => `${m.month} ${fmt(m.amount)}`).join(', ')}`}>
              {series.map((m, index) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`w-full rounded-md ${index === series.length - 1 ? 'bg-emerald-500' : 'bg-emerald-200'}`}
                    style={{ height: `${peak > 0 ? Math.max((m.amount / peak) * 72, m.amount > 0 ? 4 : 2) : 2}px` }}
                  />
                  <span className="text-[11px] font-semibold text-slate-600">{m.month}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <Panel className="lg:col-span-7" title="Upcoming inspections" subtitle="Your next three site visits" action={<PanelLink to="/properties/inspections">All inspections →</PanelLink>}>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-600">No site visits booked. Book one from a lead or a client.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcoming.map((visit) => {
                  const when = new Date(visit.scheduledAt);
                  const pending = visit.status === 'awaiting_approval';
                  return (
                    <li key={visit.id} className="flex items-center gap-4 py-3">
                      <span style={accentStyle(accentFor('Properties'))} className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[color:var(--rx-card-tint)] text-[color:var(--rx-card-link)]">
                        <span className="text-[11px] font-bold uppercase tracking-wide">{when.toLocaleString('en-US', { month: 'short' })}</span>
                        <span className="text-xl font-bold leading-none">{when.getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900">{[visit.client, visit.property].filter(Boolean).join(' · ') || 'Site visit'}</span>
                        <span className="block text-xs text-slate-600">{when.toLocaleString('en-GB', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${pending ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
                        {pending ? 'Awaiting approval' : (visit.status === 'confirmed' ? 'Confirmed' : 'Booked')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel className="lg:col-span-5" title="Your network" subtitle="Realtors you brought in, and what they add" action={<PanelLink to="/realtor/referrals">View referrals →</PanelLink>}>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat accent={accentFor('My Referrals')} value={(data.referrals?.realtors ?? 0).toLocaleString()} label="Realtors referred" />
              <MiniStat accent={accentFor('Dashboard')} value={(network.salesCount ?? 0).toLocaleString()} label="Sales their clients made" />
              <MiniStat accent={accentFor('Properties')} value={fmt(network.overrideEarned ?? 0)} label="Override earned" />
            </div>
          </Panel>
        </div>
      </section>

      <TransactionHistory
        title="Recent Commission History"
        rows={data.transactions || []}
        fmt={fmt}
        emptyText="No commission activity yet."
      />
    </div>
  );
}

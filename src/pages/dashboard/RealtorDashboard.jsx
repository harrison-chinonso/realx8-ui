import { useCallback, useEffect, useState } from 'react';
import { getDashboardSummary, getMyKyc } from '../../api/userApi';
import LevelBadge from '../../components/common/LevelBadge';
import VerificationPrompt from '../../components/dashboard/VerificationPrompt';
import VerificationBadge from '../../components/common/VerificationBadge';
import { Link } from 'react-router-dom';
import SummaryTile from '../../components/dashboard/SummaryTile';
import TransactionHistory from '../../components/dashboard/TransactionHistory';
import { useCurrency } from '../../context/useAppearance';
import useAuthStore from '../../store/authStore';
import usePromotionAdverts from '../../hooks/usePromotionAdverts';
import PromotionAdvertCarousel from '../../components/promotions/PromotionAdvertCarousel';
import PromotionAdvertModal from '../../components/promotions/PromotionAdvertModal';
import Button from '../../components/ui/Button';
import RequestPayoutModal, { requestableOf } from '../../components/finance/RequestPayoutModal';
import { getMyCommissions } from '../../api/financeApi';

const STATUS_ORDER = ['pending', 'confirmed', 'completed', 'cancelled'];

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

export default function RealtorDashboard() {
  const fmt = useCurrency();
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

  return (
    <div className="space-y-6">
      {/* Same shape as the client dashboard's header, so Request Payout sits
          exactly where Pay Now does over there. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">
              Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋
            </h1>
            {kyc?.status === 'approved' && <VerificationBadge status="approved" size="lg" />}
            {/* The level links to the tab where an upgrade is requested — that is
                the only action a realtor can take on it from here. */}
            <Link
              to="/profile?tab=level"
              title={data.level ? `${data.level.name} — request an upgrade` : 'Request a level'}
              className="rounded-full transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {data.level
                ? <LevelBadge level={data.level} size="lg" />
                : (
                  <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-200">
                    No level yet
                  </span>
                )}
            </Link>
          </div>
          <p className="text-[11px] text-slate-400">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {/*
          Offered only when a request would actually be accepted — the server
          weighs the amount, the identity check and the company's minimum and
          answers can_request. Absent otherwise, for the same reason Pay Now is
          absent with nothing outstanding: a button that opens an empty list, or
          one that is refused on press, is worse than no button.
        */}
        {payoutSummary?.can_request && (
          payoutSummary.request_via === 'statement' ? (
            /*
             * The engine holds entitlements in a ledger and requests against a
             * balance, picking the lines on the statement screen. The dashboard
             * does not hold those ids, so it sends the realtor there rather
             * than offering a modal that cannot complete the request.
             */
            <Link to="/finance/my-commission" className="self-start">
              <Button type="button">Request Payout</Button>
            </Link>
          ) : requestable.length > 0 && (
            <Button type="button" className="self-start" onClick={() => setShowPayout(true)}>
              Request Payout
            </Button>
          )
        )}
      </div>

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

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Business Summary</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryTile
            label="Referrals"
            value={data.referrals?.total ?? 0}
            sub={`${data.referrals?.clients ?? 0} clients · ${data.referrals?.realtors ?? 0} realtors`}
            to="/realtor/referrals"
            linkText="View referrals"
            accent
          />
          <SummaryTile label="Leads" value={data.leads} sub="Created by or assigned to you" />
          <SummaryTile label="Deals" value={data.deals} />
          <SummaryTile label="Inspections" value={inspections.total} sub={breakdown || 'No inspections yet'} />
          <SummaryTile label="Active Tickets" value={data.activeTickets} sub="Open or in progress" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Payment Overview</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile
            label="Client Purchases"
            value={data.clientPurchases?.count ?? 0}
            sub={`Worth ${fmt(data.clientPurchases?.value ?? 0)}`}
          />
          <SummaryTile label="Total Commission" value={fmt(data.commission?.total ?? 0)} accent />
          <SummaryTile label="Paid Commission" value={fmt(data.commission?.paid ?? 0)} />
          <SummaryTile label="Unpaid Commission" value={fmt(data.commission?.unpaid ?? 0)} sub="Pending or approved" />
        </div>
      </div>

      <TransactionHistory
        title="Recent Commission History"
        rows={data.transactions || []}
        fmt={fmt}
        emptyText="No commission activity yet."
      />
    </div>
  );
}

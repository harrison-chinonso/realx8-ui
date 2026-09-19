import { useEffect, useState } from 'react';
import { getUserSummary } from '../../api/userApi';
import { useCurrency } from '../../context/useAppearance';
import Modal from './Modal';
import VerificationBadge from './VerificationBadge';
import LevelBadge from './LevelBadge';
import SummaryTile from '../dashboard/SummaryTile';
import TransactionHistory from '../dashboard/TransactionHistory';

const STATUS_ORDER = ['pending', 'confirmed', 'completed', 'cancelled'];

function Section({ title, children }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
      {children}
    </div>
  );
}

function RealtorBody({ summary, fmt }) {
  const inspections = summary.inspections || { total: 0, byStatus: {} };
  const breakdown = STATUS_ORDER
    .filter((s) => inspections.byStatus?.[s])
    .map((s) => `${inspections.byStatus[s]} ${s}`)
    .join(' · ');

  return (
    <>
      <Section title="Business Summary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryTile
            label="Referrals"
            value={summary.referrals?.total ?? 0}
            sub={`${summary.referrals?.clients ?? 0} clients · ${summary.referrals?.realtors ?? 0} realtors`}
          />
          <SummaryTile label="Leads" value={summary.leads ?? 0} />
          <SummaryTile label="Deals" value={summary.deals ?? 0} />
          <SummaryTile label="Inspections" value={inspections.total ?? 0} sub={breakdown || 'No inspections yet'} />
          <SummaryTile label="Active Tickets" value={summary.activeTickets ?? 0} sub="Open or in progress" />
        </div>
      </Section>

      <Section title="Payment Overview">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile
            label="Client Purchases"
            value={summary.clientPurchases?.count ?? 0}
            sub={fmt(summary.clientPurchases?.value ?? 0)}
          />
          <SummaryTile label="Total Commission" value={fmt(summary.commission?.total ?? 0)} accent />
          <SummaryTile label="Paid Commission" value={fmt(summary.commission?.paid ?? 0)} />
          <SummaryTile label="Unpaid Commission" value={fmt(summary.commission?.unpaid ?? 0)} />
        </div>
      </Section>

      <TransactionHistory
        title="Recent Commission"
        rows={summary.transactions || []}
        fmt={fmt}
        emptyText="No commission recorded yet."
        /*
          Uncapped. The five-row limit belongs to the dashboard, where every
          panel competes for one screen — this is a modal opened to look at one
          person, and trimming their history is the opposite of its purpose.
        */
        limit={null}
      />
    </>
  );
}

function ClientBody({ summary, fmt }) {
  const invoices = summary.invoices || {};
  return (
    <>
      <Section title="Business Summary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryTile
            label="Properties Purchased"
            value={summary.purchases?.count ?? 0}
            sub={fmt(summary.purchases?.value ?? 0)}
          />
          <SummaryTile label="Active Tickets" value={summary.activeTickets ?? 0} sub="Open or in progress" />
        </div>
      </Section>

      <Section title="Payment Overview">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryTile
            label="Total Invoiced"
            value={fmt(invoices.value ?? 0)}
            sub={`${invoices.count ?? 0} invoices`}
            accent
          />
          <SummaryTile
            label="Paid"
            value={fmt(invoices.paid?.value ?? 0)}
            sub={`${invoices.paid?.count ?? 0} invoices`}
          />
          <SummaryTile
            label="Outstanding"
            value={fmt(invoices.unpaid?.value ?? 0)}
            sub={`${invoices.unpaid?.count ?? 0} invoices`}
          />
        </div>
      </Section>

      <TransactionHistory
        title="Recent Transactions"
        rows={summary.transactions || []}
        fmt={fmt}
        emptyText="No transactions yet."
        // Uncapped, for the reason above.
        limit={null}
      />
    </>
  );
}

/**
 * Drill-down into one realtor's or client's business summary and payment
 * details — the same figures that user sees on their own dashboard.
 *
 * `user` only needs an id; everything shown is re-fetched from the server,
 * which also decides whether the viewer is allowed to see it.
 */
export default function UserSummaryModal({ user, open, onClose }) {
  const fmt = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    getUserSummary(user.id)
      .then((res) => { if (!cancelled) setData(res?.data ?? null); })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.userMessage || 'Could not load this summary.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    // Ignore a response that arrives after the modal moved to another user.
    return () => { cancelled = true; };
  }, [open, user?.id]);

  const person = data?.user;

  return (
    <Modal open={open} onClose={onClose} title={user?.name || 'Business Summary'} size="xl">
      {loading && <div className="py-10 text-center text-sm text-slate-500">Loading summary…</div>}
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {data && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{person.name}</p>
              <p className="truncate text-xs text-slate-500">
                {person.email}{person.phone ? ` · ${person.phone}` : ''}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600">
                {person.type}
              </span>
              <LevelBadge level={person.level_name ? {
                name: person.level_name,
                commission_percentage: person.commission_percentage,
                // Whether that percentage is what actually pays them.
                rate_in_force: person.rate_in_force,
              } : null} />
              <VerificationBadge status={person.kyc_status} />
            </div>
          </div>

          {data.summary?.role === 'realtor'
            ? <RealtorBody summary={data.summary} fmt={fmt} />
            : <ClientBody summary={data.summary} fmt={fmt} />}
        </div>
      )}
    </Modal>
  );
}

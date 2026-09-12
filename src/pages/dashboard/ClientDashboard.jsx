import { useCallback, useEffect, useState } from 'react';
import { getDashboardSummary } from '../../api/userApi';
import SummaryTile from '../../components/dashboard/SummaryTile';
import TransactionHistory from '../../components/dashboard/TransactionHistory';
import InvoicePickerModal from '../../components/finance/InvoicePickerModal';
import PayInvoiceModal from '../../components/finance/PayInvoiceModal';
import Button from '../../components/ui/Button';
import { useCurrency } from '../../context/useAppearance';
import useAuthStore from '../../store/authStore';

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
  const user = useAuthStore((state) => state.user);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-900">
            Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-[11px] text-slate-400">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {/*
          * Offered whenever anything is outstanding, and simply absent when
          * nothing is — a Pay Now that opens an empty list is a dead end, and
          * the summary already says the balance is zero.
          */}
        {(invoices.unpaid?.count ?? 0) > 0 && (
          <Button type="button" className="self-start" onClick={() => setPicking(true)}>
            Pay Now
          </Button>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Business Summary</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryTile
            label="Invoices"
            value={`${invoices.count ?? 0} · ${fmt(invoices.value ?? 0)}`}
            sub={nextDue ? `Next due ${nextDue}` : 'Nothing currently due'}
            accent
          />
          <SummaryTile label="Active Tickets" value={data.activeTickets ?? 0} sub="Open or in progress" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Payment Overview</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryTile
            label="Properties Purchased"
            value={data.purchases?.count ?? 0}
            sub={`Worth ${fmt(data.purchases?.value ?? 0)}`}
            accent
          />
          <SummaryTile
            label="Paid Invoices"
            value={`${invoices.paid?.count ?? 0} · ${fmt(invoices.paid?.value ?? 0)}`}
          />
          <SummaryTile
            label="Unpaid Invoices"
            value={`${invoices.unpaid?.count ?? 0} · ${fmt(invoices.unpaid?.value ?? 0)}`}
            sub={nextDue ? `Earliest due ${nextDue}` : undefined}
          />
        </div>
      </div>

      <TransactionHistory rows={data.transactions || []} fmt={fmt} emptyText="No transactions yet." />

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

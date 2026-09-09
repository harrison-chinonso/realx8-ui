import { useEffect, useState } from 'react';
import { getDashboardSummary } from '../../api/userApi';
import SummaryTile from '../../components/dashboard/SummaryTile';
import TransactionHistory from '../../components/dashboard/TransactionHistory';
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

  useEffect(() => {
    let cancelled = false;
    getDashboardSummary()
      .then((response) => { if (!cancelled) setData(response?.data ?? response); })
      .catch((err) => { if (!cancelled) setError(err?.userMessage || 'Could not load your dashboard.'); });
    return () => { cancelled = true; };
  }, []);

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
      <div>
        <h1 className="text-lg font-bold text-slate-900">
          Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-[11px] text-slate-400">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
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
    </div>
  );
}

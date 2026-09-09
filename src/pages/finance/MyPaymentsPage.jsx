import { useSearchParams } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import PaymentAnalysisPanel from '../../components/finance/PaymentAnalysisPanel';

/**
 * The client's own invoices, or their own payments.
 *
 * Both live on one component because they come from a single endpoint — the
 * same one the Payment Analysis drill-down uses — so the figures can never
 * disagree. `section` picks which half the page shows.
 */
export default function MyPaymentsPage({ section = 'invoices' }) {
  const user = useAuthStore((state) => state.user);
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('status');
  const initialTab = ['due', 'pending', 'paid'].includes(requested) ? requested : 'all';
  const isPayments = section === 'payments';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {isPayments ? 'My Payments' : 'My Invoices'}
        </h1>
        <p className="text-sm text-slate-500">
          {isPayments
            ? 'Every payment recorded against your invoices.'
            : 'Everything billed to you — all invoices, what is due and what is still pending.'}
        </p>
      </div>
      {user?.id
        ? (
          <PaymentAnalysisPanel
            userId={user.id}
            linkInvoices
            initialTab={initialTab}
            show={isPayments ? 'payments' : 'invoices'}
          />
        )
        : <div className="rounded-xl bg-white p-6 text-slate-500">Loading…</div>}
    </div>
  );
}

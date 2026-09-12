import { useSearchParams } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import PaymentAnalysisPanel from '../../components/finance/PaymentAnalysisPanel';
import MySubmittedPaymentsPanel from '../../components/finance/MySubmittedPaymentsPanel';

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
            ? 'What you have submitted, and what has been applied to your invoices.'
            : 'Everything billed to you — all invoices, what is due and what is still pending.'}
        </p>
      </div>

      {/*
        * Submissions come FIRST on the payments view.
        *
        * The panel below lists payments recorded against an invoice, which only
        * happens once an admin approves one — so a buyer waiting on a decision,
        * or one whose proof was refused, previously saw an empty page and no
        * sign their upload had landed anywhere.
        */}
      {isPayments && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Payments you have submitted</h2>
          <MySubmittedPaymentsPanel />
        </div>
      )}
      {isPayments && <h2 className="text-sm font-semibold text-slate-900">Applied to your invoices</h2>}
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

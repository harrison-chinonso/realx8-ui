import { useEffect, useState } from 'react';
import { getPaymentAnalysis } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';
import Modal from '../common/Modal';
import { STATE_TONE, STATE_LABEL, stateRank } from '../../utils/invoiceState';

/**
 * Which invoice am I paying?
 *
 * PayInvoiceModal already handles everything after that question — account
 * details, the amount, the proof upload — but it needs an invoice id, and from
 * the dashboard there is nothing to have supplied one. This is the step in
 * front of it: pick, then pay.
 *
 * Read from payment-analysis rather than the invoice list because it already
 * computes the two things that decide whether a row belongs here at all — the
 * outstanding balance, and whether the invoice is due or merely pending — and
 * it is scoped to the caller, so a client can only ever see their own.
 */
export default function InvoicePickerModal({ open, userId, onClose, onSelect }) {
  const fmt = useCurrency();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !userId) return undefined;
    let cancelled = false;
    setRows(null);
    setError('');
    getPaymentAnalysis(userId)
      .then((res) => {
        if (cancelled) return;
        const invoices = res?.data?.invoices ?? [];
        // Settled invoices are not payable, so they are not choices. Sorted by
        // what is most pressing: overdue first, then the earliest due date.
        setRows(invoices
          .filter((row) => Number(row.balance) > 0)
          .sort((a, b) => {
            // Rank, not a two-way comparison: there are more than two states
            // now, so "is this one due?" no longer orders the list.
            const byState = stateRank(a.state) - stateRank(b.state);
            if (byState !== 0) return byState;
            return new Date(a.due_date || 0) - new Date(b.due_date || 0);
          }));
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.userMessage || 'Could not load your invoices.');
      });
    return () => { cancelled = true; };
  }, [open, userId]);

  return (
    <Modal open={open} onClose={onClose} title="Pay an Invoice" size="lg">
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {!error && rows === null && (
        <div className="py-8 text-center text-sm text-slate-500">Loading your invoices…</div>
      )}
      {!error && rows?.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Nothing to pay right now.</p>
          <p className="mt-1 text-sm text-slate-500">Every invoice raised for you has been settled.</p>
        </div>
      )}

      {!error && rows?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">
            Choose the invoice you want to pay.
          </p>
          {/*
            * A card, not a single wide button.
            *
            * The status sits top-right against the reference and the Pay link
            * bottom-right under the amount, so the two things a buyer is
            * deciding between — how urgent is this, and do I act on it — are
            * where the eye already ends up rather than at opposite edges of one
            * long row.
            *
            * The card itself is not clickable: a button wrapping a button is
            * invalid, and an implicitly-clickable card gives no keyboard
            * affordance. Pay is the control.
            */}
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl p-4 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                {/* min-w-0 lets the long half truncate; shrink-0 keeps the short
                    half whole, so a narrow screen clips the property name
                    rather than wrapping the status onto its own line. */}
                <p className="min-w-0 truncate font-semibold text-slate-900">
                  {row.invoice_id}
                  {/* The property is what a buyer recognises the invoice by; the
                      reference on its own means nothing to them. */}
                  {row.property_name ? ` · ${row.property_name}` : ''}
                </p>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE_TONE[row.state] || 'bg-slate-100 text-slate-600'}`}>
                  {STATE_LABEL[row.state] || row.state}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                <p className="min-w-0 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{fmt(row.balance)}</span>
                  <span className="text-xs text-slate-500"> outstanding of {fmt(row.amount)}</span>
                </p>
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  className="ml-auto shrink-0 text-sm font-semibold hover:underline"
                  style={{ color: 'var(--primary)' }}
                >
                  Pay →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

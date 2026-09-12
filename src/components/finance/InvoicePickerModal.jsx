import { useEffect, useState } from 'react';
import { getPaymentAnalysis } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';
import Modal from '../common/Modal';
import Badge from '../common/Badge';

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
            if (a.state !== b.state) return a.state === 'due' ? -1 : 1;
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
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row.id)}
              className="flex w-full flex-col gap-2 rounded-xl p-4 text-left ring-1 ring-slate-200 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="min-w-0 sm:flex-1">
                <span className="block truncate font-semibold text-slate-900">
                  {row.invoice_id}
                  {/* The property is what a buyer recognises the invoice by; the
                      reference on its own means nothing to them. */}
                  {row.property_name ? ` · ${row.property_name}` : ''}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {fmt(row.balance)} outstanding of {fmt(row.amount)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                <Badge value={row.state === 'due' ? 'overdue' : 'pending'} />
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { getPaymentOptions, markInvoicePaid, payInvoice, listReceipts, verifyReceipt, rejectReceipt } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';
import Button from '../ui/Button';
import MoneyInput from '../ui/MoneyInput';
import Badge from '../common/Badge';
import Modal from '../common/Modal';

/**
 * Staff-side settlement for one invoice: review the buyer's proof of payment,
 * record an installment, or settle the whole balance in one entry.
 *
 * Lives on the invoice itself because that is where an admin looks when a buyer
 * says they have paid — the Receipts list is a queue, not a per-invoice view.
 *
 * Every action reduces the OUTSTANDING BALANCE only. An invoice's total is
 * fixed when it is issued and is never written here.
 */
export default function InvoiceSettlementPanel({ invoiceId, onChanged }) {
  const fmt = useCurrency();
  const [money, setMoney] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showInstalment, setShowInstalment] = useState(false);
  const [amount, setAmount] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [options, receipts] = await Promise.allSettled([
        getPaymentOptions(invoiceId),
        listReceipts({ status: 'pending' }),
      ]);
      const invoice = options.status === 'fulfilled' ? options.value?.data?.invoice ?? null : null;
      setMoney(invoice);
      setAmount(invoice ? String(invoice.balance) : '');
      // The pending receipt for THIS invoice, if the buyer submitted one.
      const rows = receipts.status === 'fulfilled' ? (receipts.value?.data ?? []) : [];
      setReceipt(rows.find((r) => Number(r.invoice_id) === Number(invoiceId)) || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (invoiceId) load(); }, [invoiceId]);

  const run = async (action, successMessage) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      setShowInstalment(false);
      setRejecting(false);
      setRejectNotes('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'That did not go through.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading settlement…</div>;
  if (!money) return null;

  const settled = money.balance <= 0;
  const amountNumber = Number(amount);
  const amountError = amount === '' ? ''
    : (!Number.isFinite(amountNumber) || amountNumber <= 0) ? 'Enter an amount greater than zero.'
    : amountNumber > money.balance ? `That is more than the outstanding ${fmt(money.balance)}.`
    : '';

  return (
    <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="text-lg font-semibold">Settlement</h2>
        <p className="text-sm text-slate-500">
          The invoice total never changes — recording money here reduces the outstanding balance.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[['Invoice total', money.total], ['Paid', money.paid], ['Outstanding', money.balance]].map(([label, value], i) => (
          <div key={label} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-xl font-bold ${i === 2 && value > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {notice && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div>}
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {/* Proof the buyer submitted, awaiting a decision. */}
      {receipt && (
        <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-amber-900">Proof of payment awaiting review</p>
              <p className="text-xs text-amber-800">
                {receipt.receipt_number} · {fmt(receipt.amount || 0)}
                {receipt.reference ? ` · ref ${receipt.reference}` : ''}
              </p>
            </div>
            <Badge value={receipt.status} />
          </div>

          {receipt.document_url ? (
            <a href={receipt.document_url} target="_blank" rel="noreferrer"
               className="mt-3 block rounded-lg border border-dashed border-amber-300 bg-white px-3 py-3 text-center text-sm font-semibold hover:border-amber-400"
               style={{ color: 'var(--primary)' }}>
              Open proof of payment
            </a>
          ) : (
            <p className="mt-2 text-xs text-amber-800">No document was attached.</p>
          )}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setRejecting(true)}>Decline</Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => run(() => verifyReceipt(receipt.id, { amount: Number(receipt.amount) }),
                `Approved — ${fmt(receipt.amount || 0)} credited.`)}
            >
              Approve &amp; credit
            </Button>
          </div>
        </div>
      )}

      {settled ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">This invoice is fully settled.</p>
      ) : (
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setShowInstalment(true)}>
            Record Installment
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Mark this invoice paid? This records ${fmt(money.balance)} as a single payment.`)) return;
              run(() => markInvoicePaid(invoiceId, { payment_method: 'bank_transfer' }), 'Invoice marked as paid.');
            }}
          >
            Mark Invoice as Paid
          </Button>
        </div>
      )}

      <Modal open={showInstalment} onClose={() => !busy && setShowInstalment(false)} title="Record Installment" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Outstanding on this invoice: <strong>{fmt(money.balance)}</strong>.
          </p>
          <MoneyInput label="Amount received" value={amount} onChange={setAmount} error={amountError} />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowInstalment(false)} disabled={busy}>Cancel</Button>
            <Button
              type="button"
              disabled={busy || !amount || Boolean(amountError)}
              onClick={() => run(() => payInvoice(invoiceId, { payment_method: 'bank_transfer', amount: Number(amount) }),
                'Installment recorded.')}
            >
              {busy ? 'Recording…' : 'Record Payment'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={rejecting} onClose={() => !busy && setRejecting(false)} title="Decline this proof" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">The buyer sees this reason and can submit new proof.</p>
          <textarea
            rows={3}
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="e.g. The screenshot is unreadable."
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setRejecting(false)} disabled={busy}>Cancel</Button>
            <Button
              type="button"
              variant="danger"
              disabled={busy || !rejectNotes.trim()}
              onClick={() => run(() => rejectReceipt(receipt.id, { notes: rejectNotes.trim() }), 'Proof declined.')}
            >
              Decline
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { getPaymentOptions, markInvoicePaid, payInvoice, listReceipts, verifyReceipt, rejectReceipt } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';
import Button from '../ui/Button';
import MoneyInput from '../ui/MoneyInput';
import Badge from '../common/Badge';
import Modal from '../common/Modal';
import Select from '../ui/Select';
import { CONFIRMABLE_METHOD_FALLBACK, METHOD_LABELS } from '../../utils/paymentMethods';
import { enumLabel } from '../../utils/enumLabel';
import { uploadMediaFiles } from '../../api/mediaApi';
import FieldMark from '../ui/FieldMark';
import { safeHref } from '../../utils/safeHref';

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
  // Confirming a payment: the admin reads these off the proof of payment.
  const [confirming, setConfirming] = useState(false);
  const [confirmMethod, setConfirmMethod] = useState('');
  /**
   * The company's own receipt. Kept in step with the Payment Approvals screen —
   * the same approval exists in two places, and a rule enforced in one of them
   * is an admin discovering it depends which screen they happened to use.
   */
  const [companyReceipt, setCompanyReceipt] = useState(null);
  const [receiptRequired, setReceiptRequired] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const attachReceipt = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const uploaded = await uploadMediaFiles([file]);
      const first = uploaded?.files?.[0] ?? uploaded?.[0];
      if (!first?.url) throw new Error('The upload returned no file.');
      setCompanyReceipt({ url: first.url, public_id: first.public_id, name: first.name || file.name });
    } catch (error) {
      setUploadError(error?.userMessage || 'That file could not be uploaded.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };
  const [confirmReference, setConfirmReference] = useState('');
  const [confirmAmount, setConfirmAmount] = useState('');
  // Served by the API from the same constant its validation uses.
  const [methods, setMethods] = useState(CONFIRMABLE_METHOD_FALLBACK);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [instalmentMethod, setInstalmentMethod] = useState('transfer');

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
      const served = options.status === 'fulfilled'
        ? options.value?.data?.confirmable_payment_methods : null;
      if (Array.isArray(served) && served.length) setMethods(served);
      setReceiptRequired(options.status === 'fulfilled'
        && Boolean(options.value?.data?.requires_company_receipt));
      // The pending receipt for THIS invoice, if the buyer submitted one.
      const rows = receipts.status === 'fulfilled' ? (receipts.value?.data ?? []) : [];
      /**
       * The status is re-checked here rather than trusted from the query.
       *
       * The receipts endpoint ignored ?status= until recently, so this could
       * pick up a proof that had already been approved or declined and offer to
       * decide it again — which is exactly how the approve and decline buttons
       * survived a confirmation.
       */
      setReceipt(rows.find((r) => (
        Number(r.invoice_id) === Number(invoiceId) && r.status === 'pending'
      )) || null);
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

  /**
   * Nothing further can be recorded.
   *
   * Balance alone was not enough: a CANCELLED or EXPIRED invoice can still
   * carry an outstanding balance, and the panel went on offering Record
   * Installment and Mark as Paid for it. The endpoints refuse both, so the
   * buttons only led to an error — this matches what the server will accept.
   */
  const closed = ['paid', 'cancelled', 'expired'].includes(money.status);
  const settled = money.balance <= 0 || closed;
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
            <a href={safeHref(receipt.document_url) ?? undefined} target="_blank" rel="noreferrer"
               className="mt-3 block rounded-lg border border-dashed border-amber-300 bg-white px-3 py-3 text-center text-sm font-semibold hover:border-amber-400"
               style={{ color: 'var(--primary)' }}>
              Open proof of payment
            </a>
          ) : (
            <p className="mt-2 text-xs text-amber-800">No document was attached.</p>
          )}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setRejecting(true)}>Decline</Button>
            {/*
              * Opens a form rather than approving on the spot. The method and
              * the transaction reference used to be inherited from whatever the
              * buyer typed on upload — so the ledger recorded their unverified
              * claim, with a reference that matched nothing at the bank. The
              * admin is looking at the proof when they approve, so they are the
              * one who can read the real reference off it.
              */}
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirmMethod('');
                setConfirmReference(receipt.reference || '');
                setConfirmAmount(String(receipt.amount ?? ''));
                setConfirming(true);
              }}
            >
              Approve &amp; credit
            </Button>
          </div>
        </div>
      )}

      {settled ? (
        closed && money.balance > 0 ? (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {/*
              The status is its own clause rather than dropped into the middle
              of a sentence: the raw values read as "is expired with…" and "is
              cancelled with…", which are not sentences anybody writes.
            */}
            This invoice is closed ({enumLabel(money.status)}) and {fmt(money.balance)} is still
            outstanding. No further payment can be recorded against it.
          </p>
        ) : (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">This invoice is fully settled.</p>
        )
      ) : (
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setShowInstalment(true)}>
            Record Installment
          </Button>
          <Button type="button" disabled={busy} onClick={() => setMarkingPaid(true)}>
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
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">How was it paid?<FieldMark /></span>
            <Select value={instalmentMethod} onChange={(e) => setInstalmentMethod(e.target.value)}>
              {methods.map((method) => (
                <option key={method} value={method}>{METHOD_LABELS[method] || method}</option>
              ))}
            </Select>
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowInstalment(false)} disabled={busy}>Cancel</Button>
            <Button
              type="button"
              disabled={busy || !amount || Boolean(amountError)}
              onClick={() => run(() => payInvoice(invoiceId, {
                payment_method: instalmentMethod, amount: Number(amount),
              }), 'Installment recorded.')}
            >
              {busy ? 'Recording…' : 'Record Payment'}
            </Button>
          </div>
        </div>
      </Modal>

      {/*
        * Confirming a payment (item 6).
        *
        * Both fields are required by the API too — this form is the convenient
        * place to enter them, not the thing that enforces them.
        */}
      <Modal
        open={confirming}
        onClose={() => !busy && setConfirming(false)}
        title="Confirm this payment"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Read these off the proof of payment. The reference is what reconciles this
            payment against the bank statement later.
          </p>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">How was it paid?<FieldMark required /></span>
            <Select value={confirmMethod} onChange={(e) => setConfirmMethod(e.target.value)}>
              <option value="">Select a method...</option>
              {methods.map((method) => (
                <option key={method} value={method}>{METHOD_LABELS[method] || method}</option>
              ))}
            </Select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Transaction reference<FieldMark required /></span>
            <input
              type="text"
              value={confirmReference}
              onChange={(e) => setConfirmReference(e.target.value)}
              placeholder="e.g. FT24098XYZ12"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="text-xs text-slate-500">
              From the deposit slip, transfer receipt or gateway confirmation.
            </span>
          </label>

          <MoneyInput
            label="Amount to credit"
            value={confirmAmount}
            onChange={setConfirmAmount}
          />
          <p className="text-xs text-slate-500">
            The buyer declared {fmt(receipt?.amount || 0)}. Correct it here if the proof shows
            a different figure — the corrected amount is what gets allocated.
          </p>

          <div className="space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Company receipt{receiptRequired && <span className="text-rose-600"> *</span>}
            </span>
            {companyReceipt ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <a href={safeHref(companyReceipt.url) ?? undefined} target="_blank" rel="noreferrer"
                   className="truncate text-sm font-medium" style={{ color: 'var(--primary)' }}>
                  {companyReceipt.name || 'Attached receipt'}
                </a>
                <Button type="button" variant="secondary" size="sm"
                        onClick={() => setCompanyReceipt(null)} disabled={busy}>
                  Remove
                </Button>
              </div>
            ) : (
              <label className={`block cursor-pointer rounded-lg border border-dashed px-3 py-3 text-center text-sm font-medium hover:border-slate-400 ${receiptRequired ? 'border-rose-300 text-rose-700' : 'border-slate-300 text-slate-600'}`}>
                {uploading ? 'Uploading…' : 'Attach the receipt you are issuing'}
                <input type="file" accept="image/*,application/pdf" className="hidden"
                       onChange={attachReceipt} disabled={uploading || busy} />
              </label>
            )}
            <span className="block text-xs text-slate-500">
              {receiptRequired
                ? 'This company requires a receipt before a payment can be approved.'
                : 'Optional. The buyer will be able to download whatever you attach.'}
            </span>
            {uploadError && <span className="block text-xs text-rose-600">{uploadError}</span>}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || uploading || !confirmMethod || !confirmReference.trim()
                || !Number(confirmAmount) || (receiptRequired && !companyReceipt)}
              onClick={() => {
                setConfirming(false);
                run(
                  () => verifyReceipt(receipt.id, {
                    amount: Number(confirmAmount),
                    payment_method: confirmMethod,
                    reference: confirmReference.trim(),
                    ...(companyReceipt ? {
                      company_receipt_url: companyReceipt.url,
                      company_receipt_public_id: companyReceipt.public_id,
                    } : {}),
                  }),
                  `Approved — ${fmt(Number(confirmAmount))} credited.`,
                );
              }}
            >
              {busy ? 'Confirming…' : 'Confirm payment'}
            </Button>
          </div>
        </div>
      </Modal>

      {/*
        * Marking an invoice paid (item 5).
        *
        * Spells out what it will do rather than asking a one-line confirm: it
        * CREATES a payment and transaction with no proof of payment and no
        * reference, recorded as Admin Approved. That is a real ledger entry an
        * auditor will find, so the admin should know they are the evidence for
        * it.
        */}
      <Modal
        open={markingPaid}
        onClose={() => !busy && setMarkingPaid(false)}
        title="Mark this invoice as paid"
        size="sm"
      >
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">
            This records the outstanding <strong>{fmt(money?.balance || 0)}</strong> as a
            payment and creates the matching transaction, settling the invoice.
          </p>
          <div className="space-y-2 rounded-lg bg-amber-50 px-4 py-3 text-amber-900">
            <p className="font-semibold">It will be recorded without evidence.</p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              <li>No proof of payment is attached.</li>
              <li>No transaction reference, so it cannot be reconciled against a bank statement.</li>
              <li>
                The payment method is recorded as <strong>Admin Approved</strong>, which
                identifies it as your assertion rather than a confirmed transfer.
              </li>
            </ul>
            <p className="text-xs">
              If the buyer has proof, decline this and confirm their uploaded payment instead.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setMarkingPaid(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setMarkingPaid(false);
                run(() => markInvoicePaid(invoiceId),
                  `Invoice settled — ${fmt(money?.balance || 0)} recorded as Admin Approved.`);
              }}
            >
              {busy ? 'Recording…' : 'Record without proof'}
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
              onClick={() => run(() => rejectReceipt(receipt.id, { reason: rejectNotes.trim() }), 'Proof declined.')}
            >
              Decline
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

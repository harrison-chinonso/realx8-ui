import { useEffect, useMemo, useState } from 'react';
import {
  createReceipt,
  listReceipts,
  rejectReceipt,
  verifyReceipt,
  getPaymentOptions,
} from '../../api/financeApi';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import MoneyInput from '../../components/ui/MoneyInput';
import ActionsMenu from '../../components/common/ActionsMenu';
import { useCurrency } from '../../context/useAppearance';
import Select from '../../components/ui/Select';
import { CONFIRMABLE_METHOD_FALLBACK, METHOD_LABELS } from '../../utils/paymentMethods';
import { enumLabel } from '../../utils/enumLabel';
import useNavBadgeStore from '../../store/navBadgeStore';
import { uploadMediaFiles } from '../../api/mediaApi';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const EMPTY_FORM = { amount: '', payment_method: '', invoice_id: '', notes: '' };

const getItems = (response) => response?.data ?? response ?? [];
const getErrorMessage = (error, fallback) => error?.userMessage || fallback;
const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function StatusBadge({ status }) {
  const key = String(status || 'pending').toLowerCase();
  const classes = {
    pending: 'bg-amber-100 text-amber-700',
    verified: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
  };

  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes[key] || 'bg-slate-100 text-slate-700'}`}>{status || 'pending'}</span>;
}

export default function ReceiptsPage() {
  const fmt = useCurrency();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [rejectingReceipt, setRejectingReceipt] = useState(null);
  // Reviewing opens the proof and lets the admin credit a different figure —
  // a part payment against a larger invoice.
  const [reviewing, setReviewing] = useState(null);
  /**
   * The method and the reference are REQUIRED by the verify endpoint, and are
   * read off the proof by the admin rather than inherited from what the buyer
   * typed. This modal sent neither, so every Confirm here was rejected with
   * "Choose how the payment was made" — the button appeared to do nothing.
   */
  const [reviewMethod, setReviewMethod] = useState('');
  const [reviewReference, setReviewReference] = useState('');
  const [reviewMethods, setReviewMethods] = useState(CONFIRMABLE_METHOD_FALLBACK);
  /** The company's own receipt, attached during review. */
  const [companyReceipt, setCompanyReceipt] = useState(null);
  const [receiptRequired, setReceiptRequired] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [rejectNotes, setRejectNotes] = useState('');
  const [message, setMessage] = useState(null);

  const refreshBadges = useNavBadgeStore((state) => state.refresh);

  const setFeedback = (type, text) => {
    setMessage({ type, text });
  };

  const load = async () => {
    setLoading(true);
    try {
      const response = await listReceipts();
      setItems(getItems(response));
      /**
       * Re-read the sidebar badge whenever this list is reloaded.
       *
       * Both approving and rejecting already call load(), so hooking it here
       * covers every path that changes the queue — including the first visit,
       * where the count may have gone stale since the last poll. Putting it in
       * the two handlers instead would mean a third action added later silently
       * leaving the badge wrong.
       */
      refreshBadges({ enabled: true });
    } catch (error) {
      console.error(error);
      setItems([]);
      setFeedback('error', getErrorMessage(error, 'Failed to load receipts.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const closeAddModal = (force = false) => {
    if (saving && !force) return;
    setShowAddModal(false);
    setForm(EMPTY_FORM);
  };

  const closeRejectModal = (force = false) => {
    if (saving && !force) return;
    setRejectingReceipt(null);
    setRejectNotes('');
  };

  const handleAddReceipt = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createReceipt({
        amount: Number(form.amount),
        payment_method: form.payment_method.trim(),
        ...(form.invoice_id ? { invoice_id: Number(form.invoice_id) } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      closeAddModal(true);
      await load();
      setFeedback('success', 'Receipt created successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to create receipt.'));
    } finally {
      setSaving(false);
    }
  };

  const openReview = (receipt) => {
    setReviewing(receipt);
    setCompanyReceipt(null);
    setReceiptRequired(false);
    setUploadError('');
    setCreditAmount(String(receipt.amount ?? ''));
    // Method starts EMPTY: it is the admin's reading of the proof, not the
    // buyer's claim, so it has to be chosen rather than accepted by default.
    setReviewMethod('');
    // The reference is seeded from what the buyer gave, as a starting point the
    // admin corrects against the document.
    setReviewReference(receipt.reference || '');
    setReviewMethods(CONFIRMABLE_METHOD_FALLBACK);
    // Served from the same constant the validation uses, so the picker cannot
    // offer a method the server will refuse. Best effort — the fallback above
    // stands if this receipt has no invoice or the call fails.
    if (receipt.invoice_id) {
      getPaymentOptions(receipt.invoice_id)
        .then((res) => {
          const served = res?.data?.confirmable_payment_methods;
          if (Array.isArray(served) && served.length) setReviewMethods(served);
          // Whether this company insists on its own receipt. The server enforces
          // it regardless; this is so the screen can say so before the admin
          // fills the rest of the form in and is refused at the end.
          setReceiptRequired(Boolean(res?.data?.requires_company_receipt));
        })
        .catch(() => {});
    }
  };

  const handleCompanyReceiptUpload = async (event) => {
    const file = event.target.files?.[0];
    // Clearing the picker must not clear an already-attached receipt: the
    // browser fires change with no file when a dialog is cancelled.
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const uploaded = await uploadMediaFiles([file]);
      const first = uploaded?.files?.[0] ?? uploaded?.[0];
      if (!first?.url) throw new Error('The upload returned no file.');
      setCompanyReceipt({ url: first.url, public_id: first.public_id, name: first.name || file.name });
    } catch (error) {
      console.error(error);
      setUploadError(getErrorMessage(error, 'That file could not be uploaded.'));
    } finally {
      setUploading(false);
      // Reset the input so re-picking the SAME file fires change again.
      event.target.value = '';
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!reviewing) return;
    setSaving(true);
    try {
      // The server clamps this to the outstanding balance — an invoice total
      // can never be exceeded, only its balance reduced.
      const result = await verifyReceipt(reviewing.id, {
        amount: Number(creditAmount) || undefined,
        payment_method: reviewMethod,
        reference: reviewReference.trim(),
        /**
         * Sent whenever one was attached, not only when the company demands it.
         * An admin who uploads a receipt on a company with the rule switched off
         * still means the buyer to receive it.
         */
        ...(companyReceipt ? {
          company_receipt_url: companyReceipt.url,
          company_receipt_public_id: companyReceipt.public_id,
        } : {}),
      });
      const invoice = result?.data?.invoice;
      const credited = result?.data?.payment?.amount;
      setReviewing(null);
      await load();
      setFeedback('success', invoice
        ? `Credited ${fmt(credited)}. Invoice balance is now ${fmt(invoice.balance)}.`
        : 'Receipt verified.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to verify receipt.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (event) => {
    event.preventDefault();
    if (!rejectingReceipt) return;

    setSaving(true);
    try {
      await rejectReceipt(rejectingReceipt.id, { reason: rejectNotes.trim() });
      closeRejectModal(true);
      await load();
      setFeedback('success', `Receipt ${rejectingReceipt.receipt_number || rejectingReceipt.number || rejectingReceipt.id} rejected.`);
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to reject receipt.'));
    } finally {
      setSaving(false);
    }
  };

  const printReceipt = (receipt) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    const receiptNumber = receipt.receipt_number || receipt.number || `RCPT-${receipt.id}`;
    const html = `
      <html>
        <head>
          <title>Receipt ${escapeHtml(receiptNumber)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
            h1 { color: var(--primary, #2563eb); margin-bottom: 24px; }
            .row { margin-bottom: 12px; }
            .label { font-weight: 700; display: inline-block; min-width: 160px; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Receipt</h1>
            <div class="row"><span class="label">Receipt Number:</span> ${escapeHtml(receiptNumber)}</div>
            <div class="row"><span class="label">Amount:</span> ${escapeHtml(fmt(receipt.amount || 0))}</div>
            <div class="row"><span class="label">Payment Method:</span> ${escapeHtml(receipt.payment_method || '—')}</div>
            <div class="row"><span class="label">Status:</span> ${escapeHtml(receipt.status || 'pending')}</div>
            <div class="row"><span class="label">Date:</span> ${escapeHtml(formatDate(receipt.date || receipt.created_at || receipt.createdAt))}</div>
            <div class="row"><span class="label">Invoice ID:</span> ${escapeHtml(receipt.invoice_id || '—')}</div>
            <div class="row"><span class="label">Notes:</span> ${escapeHtml(receipt.notes || '—')}</div>
          </div>
        </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const columns = useMemo(() => [
    {
      key: 'receipt_number',
      label: 'Receipt Number',
      render: (row) => row.receipt_number || row.number || `RCPT-${row.id}`,
    },
    { key: 'amount', label: 'Amount', render: (row) => fmt(row.amount || 0) },
    {
      key: 'document_url',
      label: 'Proof',
      render: (row) => (row.document_url
        ? <a href={row.document_url} target="_blank" rel="noreferrer" className="text-xs font-semibold hover:underline" style={{ color: 'var(--primary)' }}>View</a>
        : <span className="text-xs text-slate-300">—</span>),
    },
    { key: 'payment_method', label: 'Payment Method', render: (row) => row.payment_method || '—' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date || row.created_at || row.createdAt) },
  ], [fmt]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Receipts</h1>
          <p className="text-sm text-slate-500">Track submitted receipts and approval status.</p>
        </div>
        <Button type="button" onClick={() => setShowAddModal(true)}>+ Add Receipt</Button>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading receipts...</div>
      ) : (
        <Table
          columns={columns}
          rows={items}
          renderActions={(row) => (
            <div className="flex items-center justify-end gap-2">
              {row.status === 'pending' ? (
                <>
                  {/*
                    * Reject sits beside Review rather than inside the overflow
                    * menu. Approving and rejecting are the two halves of the
                    * same decision, and one of them being behind a "⋯" read as
                    * there being no way to reject at all.
                    */}
                  <Button type="button" variant="success" size="sm" onClick={() => openReview(row)}>Review</Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => setRejectingReceipt(row)}>Reject</Button>
                  <ActionsMenu items={[{ label: '🖨 Print', onClick: () => printReceipt(row) }]} />
                </>
              ) : (
                <Button type="button" variant="secondary" size="sm" onClick={() => printReceipt(row)}>Print</Button>
              )}
            </div>
          )}
        />
      )}

      <Modal open={showAddModal} onClose={closeAddModal} title="Add Receipt" size="sm">
        <form onSubmit={handleAddReceipt} className="space-y-4">
          <MoneyInput
            label="Amount"
            value={form.amount}
            onChange={(amount) => setForm((current) => ({ ...current, amount }))}
          />
          <Input
            label="Payment Method"
            value={form.payment_method}
            onChange={(event) => setForm((current) => ({ ...current, payment_method: event.target.value }))}
            required
          />
          <Input
            label="Invoice ID"
            type="number"
            min="1"
            value={form.invoice_id}
            onChange={(event) => setForm((current) => ({ ...current, invoice_id: event.target.value }))}
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className={`${INPUT_CLASS} resize-none`}
              placeholder="Optional notes"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeAddModal} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Receipt'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(reviewing)} onClose={() => !saving && setReviewing(null)} title="Review Payment" size="sm">
        {reviewing && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
              <div className="flex justify-between"><span className="text-slate-500">Receipt</span><span className="font-medium">{reviewing.receipt_number}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-slate-500">Declared</span><span className="font-medium">{fmt(reviewing.amount || 0)}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-slate-500">Method</span><span className="font-medium">{enumLabel(reviewing.payment_method)}</span></div>
              {reviewing.reference && (
                <div className="mt-1 flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono text-xs">{reviewing.reference}</span></div>
              )}
            </div>

            {reviewing.document_url ? (
              <a href={reviewing.document_url} target="_blank" rel="noreferrer"
                 className="block rounded-lg border border-dashed border-slate-300 px-3 py-3 text-center text-sm font-medium hover:border-slate-400"
                 style={{ color: 'var(--primary)' }}>
                Open proof of payment
              </a>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">No proof was attached to this receipt.</p>
            )}

            {/*
              The company's receipt, which is the opposite direction of travel
              from the proof above: that is the buyer evidencing payment, this
              is the company acknowledging it. Kept adjacent so an admin
              reviewing one is looking at the other.
            */}
            <div className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Company receipt{receiptRequired && <span className="text-rose-600"> *</span>}
              </span>

              {companyReceipt ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <a href={companyReceipt.url} target="_blank" rel="noreferrer"
                     className="truncate text-sm font-medium" style={{ color: 'var(--primary)' }}>
                    {companyReceipt.name || 'Attached receipt'}
                  </a>
                  <Button type="button" variant="secondary" size="sm"
                          onClick={() => setCompanyReceipt(null)} disabled={saving}>
                    Remove
                  </Button>
                </div>
              ) : (
                <label className={`block cursor-pointer rounded-lg border border-dashed px-3 py-3 text-center text-sm font-medium hover:border-slate-400 ${receiptRequired ? 'border-rose-300 text-rose-700' : 'border-slate-300 text-slate-600'}`}>
                  {uploading ? 'Uploading…' : 'Attach the receipt you are issuing'}
                  <input type="file" accept="image/*,application/pdf" className="hidden"
                         onChange={handleCompanyReceiptUpload} disabled={uploading || saving} />
                </label>
              )}

              <span className="block text-xs text-slate-500">
                {receiptRequired
                  ? 'This company requires a receipt before a payment can be approved. The buyer will be able to download it.'
                  : 'Optional. If you attach one, the buyer will be able to download it from their payment.'}
              </span>
              {uploadError && <span className="block text-xs text-rose-600">{uploadError}</span>}
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">How was it paid?</span>
              <Select value={reviewMethod} onChange={(event) => setReviewMethod(event.target.value)}>
                <option value="">Select a method…</option>
                {reviewMethods.map((method) => (
                  <option key={method} value={method}>{METHOD_LABELS[method] || method}</option>
                ))}
              </Select>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Transaction reference</span>
              <input
                type="text"
                value={reviewReference}
                onChange={(event) => setReviewReference(event.target.value)}
                placeholder="e.g. FT24098XYZ12"
                className={INPUT_CLASS}
              />
              <span className="block text-xs text-slate-500">
                Read it off the proof — it is what reconciles this payment against the bank
                statement later.
              </span>
            </label>

            <MoneyInput
              label="Amount to credit"
              value={creditAmount}
              onChange={setCreditAmount}
            />
            <p className="text-xs text-slate-400">
              Credit the full amount to settle the invoice, or a smaller figure to record an
              installment. The invoice total never changes — only its outstanding balance.
            </p>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setReviewing(null)} disabled={saving}>Cancel</Button>
              <Button
                type="submit"
                disabled={saving || uploading || !reviewMethod || !reviewReference.trim()
                  || (receiptRequired && !companyReceipt)}
              >
                {saving ? 'Recording...' : 'Confirm Payment'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(rejectingReceipt)} onClose={closeRejectModal} title="Reject Receipt" size="sm">
        <form onSubmit={handleReject} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Reason for rejection</span>
            <textarea
              rows={4}
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
              className={`${INPUT_CLASS} resize-none`}
              placeholder="What is wrong with this payment, and what should the buyer do?"
            />
            {/*
              * Compulsory, and the buyer reads it verbatim on their payments
              * page. "Rejected" with no explanation leaves them nothing to act
              * on, which is how a corrected payment never arrives.
              */}
            <span className="block text-xs text-slate-500">
              The buyer is shown this, so say what needs to change.
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeRejectModal} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={saving || !rejectNotes.trim()}>
              {saving ? 'Rejecting...' : 'Reject Receipt'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

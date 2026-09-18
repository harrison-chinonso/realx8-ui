import { useEffect, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { getPaymentOptions, submitInvoiceReceipt } from '../../api/financeApi';
import { uploadPropertyMedia } from '../../api/propertyApi';
import { useCurrency } from '../../context/useAppearance';
import Modal from '../common/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import MoneyInput from '../ui/MoneyInput';
import PaymentChoices from './PaymentChoices';
import FieldMark from '../ui/FieldMark';
import { safeHref } from '../../utils/safeHref';

/**
 * How a buyer pays an invoice.
 *
 * Bank Deposit shows the account an admin pinned to this invoice, or the
 * company's active accounts, and takes proof of payment. Online Payment is only
 * offered when the company has a gateway configured — the server omits it
 * otherwise, so there is never a button that leads nowhere.
 */
export default function PayInvoiceModal({ invoiceId, open, onClose, onSubmitted }) {
  const fmt = useCurrency();
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('bank');
  const [form, setForm] = useState({ amount: '', reference: '', document_url: '', notes: '' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !invoiceId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setOptions(null);
    getPaymentOptions(invoiceId)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? null;
        setOptions(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.userMessage || 'Could not load payment options.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, invoiceId]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      // Helper takes an array and returns an array — same call the KYC upload makes.
      const uploaded = await uploadPropertyMedia([file]);
      const url = uploaded?.[0]?.url;
      if (!url) throw new Error('Upload did not return a file URL.');
      setForm((f) => ({ ...f, document_url: url }));
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not upload that file.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.document_url) { setError('Upload your proof of payment first.'); return; }
    if (!canSubmit) { setError(amountError || 'Enter the amount you paid.'); return; }
    setSaving(true);
    try {
      await submitInvoiceReceipt(invoiceId, {
        document_url: form.document_url,
        amount: Number(form.amount) || undefined,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
        payment_method: method === 'online' ? 'online' : 'bank_transfer',
      });
      onSubmitted?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not submit your payment.');
      setSaving(false);
    }
  };

  const invoice = options?.invoice;

  const amountNumber = Number(form.amount);
  const amountError = (() => {
    if (form.amount === '' || form.amount === null) return '';
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return 'Enter an amount greater than zero.';
    if (invoice && amountNumber > invoice.balance) return `That is more than the outstanding ${fmt(invoice.balance)}.`;
    return '';
  })();
  const canSubmit = Boolean(form.document_url) && form.amount !== '' && !amountError;

  return (
    <Modal open={open} onClose={onClose} title="Make Payment" size="lg">
      {loading && <div className="py-8 text-center text-sm text-slate-500">Loading payment options…</div>}
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {!loading && options && (
        <div className="space-y-5">
          <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-500">Invoice {invoice.invoice_id}</span>
              <span className="font-semibold text-slate-900">Outstanding: {fmt(invoice.balance)}</span>
            </div>
            {/*
              * What this invoice is FOR.
              *
              * This is where the money is committed, and it named the invoice
              * by its reference alone — so somebody buying two units in the
              * same development could not tell from this form which one they
              * were paying for. Absent when the invoice was raised without a
              * purchase behind it, because then nothing records a unit.
              */}
            {(invoice.property_name || invoice.purchase) && (
              <p className="mt-1 text-sm text-slate-700">
                {invoice.property_name}
                {invoice.purchase && (
                  <span className="text-slate-500">
                    {invoice.property_name ? ' · ' : ''}
                    {invoice.purchase.unit_label || 'Unit'}
                    {invoice.purchase.quantity ? ` × ${invoice.purchase.quantity}` : ''}
                  </span>
                )}
              </p>
            )}
            {invoice.paid > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                {fmt(invoice.paid)} of {fmt(invoice.total)} already paid.
              </p>
            )}
          </div>

          <PaymentChoices options={options} method={method} onMethod={setMethod} />

          <form onSubmit={submit} className="space-y-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-900">Submit proof of payment</p>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* MoneyInput comma-separates as you type and shows the company's
                  currency sign. It hands back a raw string, so Number() still
                  works — but it is a text input, so the max has to be checked
                  here rather than by the browser. */}
              <div>
                <MoneyInput
                  label="Amount paid"
                  // canSubmit refuses without it; the label has to say so.
                  required
                  value={form.amount}
                  onChange={(amount) => setForm((f) => ({ ...f, amount }))}
                  error={amountError}
                />
                {/* The outstanding figure, offered rather than assumed. */}
                {invoice?.balance > 0 && !form.amount && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, amount: String(invoice.balance) }))}
                    className="mt-1 text-xs font-medium underline underline-offset-2"
                    style={{ color: 'var(--primary)' }}
                  >
                    Paying it all? Use {fmt(invoice.balance)}
                  </button>
                )}
              </div>
              <Input
                label="Payment reference"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                placeholder="e.g. bank transfer reference"
              />
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Proof of payment<FieldMark required />
              </span>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 hover:border-slate-400">
                <UploadCloud size={16} />
                <span>{uploading ? 'Uploading…' : form.document_url ? 'Replace file' : 'Upload receipt or screenshot'}</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
              {form.document_url && (
                <a href={safeHref(form.document_url) ?? undefined} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs hover:underline" style={{ color: 'var(--primary)' }}>
                  View uploaded file
                </a>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving || uploading || !canSubmit}>
                {saving ? 'Submitting…' : 'Submit for review'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}

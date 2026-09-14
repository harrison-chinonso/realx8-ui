import { useEffect, useState } from 'react';
import { Landmark, CreditCard, UploadCloud, Copy, Check } from 'lucide-react';
import { getPaymentOptions, submitInvoiceReceipt } from '../../api/financeApi';
import { uploadPropertyMedia } from '../../api/propertyApi';
import { useCurrency } from '../../context/useAppearance';
import Modal from '../common/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import MoneyInput from '../ui/MoneyInput';

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
  const [copied, setCopied] = useState(null);

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

  const copy = async (value, which) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch { /* clipboard unavailable — the value is on screen anyway */ }
  };

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
  const accounts = options?.bank?.accounts || [];
  const online = options?.online;

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
            {invoice.paid > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                {fmt(invoice.paid)} of {fmt(invoice.total)} already paid.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMethod('bank')}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${method === 'bank' ? 'border-transparent text-white' : 'border-slate-300 text-slate-600'}`}
              style={method === 'bank' ? { backgroundColor: 'var(--primary)' } : undefined}
            >
              <Landmark size={15} /> Bank Deposit
            </button>
            {/* Rendered only when the company actually has a gateway configured. */}
            {online && (
              <button
                type="button"
                onClick={() => setMethod('online')}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${method === 'online' ? 'border-transparent text-white' : 'border-slate-300 text-slate-600'}`}
                style={method === 'online' ? { backgroundColor: 'var(--primary)' } : undefined}
              >
                <CreditCard size={15} /> Pay with {online.label}
              </button>
            )}
          </div>

          {method === 'bank' && (
            <div className="space-y-3">
              {options.bank.assigned && (
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  Your account manager has assigned a specific account for this invoice.
                </p>
              )}
              {accounts.length ? accounts.map((account) => (
                <div key={account.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">{account.bank_name}</p>
                  <p className="text-xs text-slate-500">{account.name}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-lg font-bold tracking-wider text-slate-900">{account.account_number}</span>
                    <button type="button" onClick={() => copy(account.account_number, account.id)} className="text-slate-400 hover:text-slate-700" title="Copy account number">
                      {copied === account.id ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  </div>

                  {/* Only rendered when set — a local-only account should not
                      show empty IBAN/SWIFT rows. */}
                  {(account.iban || account.swift_code) && (
                    <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                      {account.iban && (
                        <div className="flex items-center gap-2">
                          <dt className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">IBAN</dt>
                          <dd className="min-w-0 flex-1 break-all font-mono text-xs text-slate-700">{account.iban}</dd>
                          <button type="button" onClick={() => copy(account.iban, `${account.id}-iban`)} className="shrink-0 text-slate-400 hover:text-slate-700" title="Copy IBAN">
                            {copied === `${account.id}-iban` ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      )}
                      {account.swift_code && (
                        <div className="flex items-center gap-2">
                          <dt className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">SWIFT</dt>
                          <dd className="min-w-0 flex-1 break-all font-mono text-xs text-slate-700">{account.swift_code}</dd>
                          <button type="button" onClick={() => copy(account.swift_code, `${account.id}-swift`)} className="shrink-0 text-slate-400 hover:text-slate-700" title="Copy SWIFT code">
                            {copied === `${account.id}-swift` ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      )}
                    </dl>
                  )}
                </div>
              )) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No bank account has been published yet. Please contact your account manager.
                </p>
              )}
            </div>
          )}

          {method === 'online' && online && (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
              <p>You will be routed to <strong>{online.label}</strong> to complete this payment securely.</p>
              <p className="mt-2 text-xs text-slate-400">
                After paying, upload the confirmation below so it can be matched to this invoice.
              </p>
            </div>
          )}

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
                Proof of payment <span className="text-red-500">*</span>
              </span>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 hover:border-slate-400">
                <UploadCloud size={16} />
                <span>{uploading ? 'Uploading…' : form.document_url ? 'Replace file' : 'Upload receipt or screenshot'}</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
              {form.document_url && (
                <a href={form.document_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs hover:underline" style={{ color: 'var(--primary)' }}>
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

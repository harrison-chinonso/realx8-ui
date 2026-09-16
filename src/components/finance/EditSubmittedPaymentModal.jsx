import { useEffect, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { updateOwnReceipt } from '../../api/financeApi';
import { uploadPropertyMedia } from '../../api/propertyApi';
import Modal from '../common/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import MoneyInput from '../ui/MoneyInput';
import FieldMark from '../ui/FieldMark';

/**
 * Correcting a payment the buyer has already submitted.
 *
 * The same three things they got wrong the first time — the amount, the bank
 * reference, the proof itself — plus their own note. Deliberately not a second
 * PayInvoiceModal: they are not choosing how to pay again, and re-showing the
 * account details would invite them to transfer a second time.
 *
 * Only reachable while the payment is pending or rejected; the server refuses
 * anything else, so a stale tab cannot edit an approved payment.
 */
export default function EditSubmittedPaymentModal({ receipt, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: '', reference: '', document_url: '', notes: '' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!receipt) return;
    setError('');
    setForm({
      amount: String(receipt.amount ?? ''),
      reference: receipt.reference ?? '',
      document_url: receipt.document_url ?? '',
      notes: receipt.notes ?? '',
    });
  }, [receipt]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
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

  const amountNumber = Number(form.amount);
  const amountError = form.amount !== '' && (!Number.isFinite(amountNumber) || amountNumber <= 0)
    ? 'Enter an amount greater than zero.'
    : '';
  const canSave = Boolean(form.document_url) && form.amount !== '' && !amountError && !uploading;

  const submit = async (event) => {
    event.preventDefault();
    if (!canSave) { setError(amountError || 'Proof of payment is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await updateOwnReceipt(receipt.id, {
        amount: amountNumber,
        reference: form.reference.trim(),
        document_url: form.document_url,
        notes: form.notes.trim(),
      });
      onSaved?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  };

  const wasRejected = receipt?.status === 'rejected';

  return (
    <Modal
      open={Boolean(receipt)}
      onClose={onClose}
      title={wasRejected ? 'Correct and resend payment' : 'Edit payment'}
      size="lg"
    >
      {receipt && (
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

          {/* Kept in front of them while they fix it — it is the instruction. */}
          {wasRejected && receipt.rejection_reason && (
            <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <span className="font-semibold">Why it was rejected: </span>{receipt.rejection_reason}
            </div>
          )}
          {wasRejected && (
            <p className="text-sm text-slate-500">
              Saving sends this straight back for review.
            </p>
          )}

          {/* MoneyInput renders its own label and error line, and hands back a
              raw string, so Number() still works. */}
          <MoneyInput
            label="Amount paid"
            value={form.amount}
            error={amountError}
            onChange={(value) => setForm((f) => ({ ...f, amount: value }))}
          />

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Bank reference<FieldMark /></span>
            <Input
              value={form.reference}
              onChange={(event) => setForm((f) => ({ ...f, reference: event.target.value }))}
              placeholder="The reference on your transfer"
            />
          </label>

          <div className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">Proof of payment</span>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 hover:border-slate-400">
              <UploadCloud size={16} />
              <span>{uploading ? 'Uploading…' : form.document_url ? 'Replace file' : 'Upload receipt or screenshot'}<FieldMark /></span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            {form.document_url && (
              <a href={form.document_url} target="_blank" rel="noreferrer" className="inline-block text-xs hover:underline" style={{ color: 'var(--primary)' }}>
                View current file
              </a>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Note (optional)<FieldMark /></span>
            <Input
              value={form.notes}
              onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))}
              placeholder="Anything the reviewer should know"
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !canSave}>
              {saving ? 'Saving…' : wasRejected ? 'Resend for review' : 'Save changes'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

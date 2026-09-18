import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { submitNotePayment } from '../../api/financeApi';
import { uploadPropertyMedia } from '../../api/propertyApi';
import { useCurrency } from '../../context/useAppearance';
import Modal from '../common/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import PaymentChoices from './PaymentChoices';
import FieldMark from '../ui/FieldMark';
import { safeHref } from '../../utils/safeHref';

/**
 * Paying a credit note.
 *
 * ── Why there is no amount field ───────────────────────────────────────────
 *
 * An invoice can be paid in instalments, so its form asks how much. A note
 * cannot: it is a single charge for a single thing, and half a verification
 * fee buys nothing. Asking for an amount would invite a part payment the
 * approval path has no way to accept, so the note's own figure is shown and
 * the form takes only the evidence.
 *
 * ── What this does NOT do ──────────────────────────────────────────────────
 *
 * It does not mark anything paid. It records a claim and puts it in front of
 * somebody who can check it, which the copy says plainly — a realtor who
 * believes uploading a screenshot completed their upgrade will be back in two
 * days asking why nothing happened.
 */
export default function NotePaymentModal({ note, payment, open, onClose, onSubmitted }) {
  const fmt = useCurrency();
  const [method, setMethod] = useState('bank');
  const [form, setForm] = useState({ reference: '', document_url: '' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      // Takes an array and returns one — the same call the invoice receipt makes.
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
    setSaving(true);
    try {
      await submitNotePayment(note.id, {
        document_url: form.document_url,
        reference: form.reference || undefined,
      });
      setForm({ reference: '', document_url: '' });
      onSubmitted?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not submit your payment.');
    } finally {
      setSaving(false);
    }
  };

  if (!note) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Pay ${note.reference}`} size="lg">
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="space-y-5">
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-500">{note.reference}</span>
            <span className="font-semibold text-slate-900">{fmt(note.amount)}</span>
          </div>
          {note.reason && <p className="mt-1 text-sm text-slate-700">{note.reason}</p>}
        </div>

        <PaymentChoices options={payment} method={method} onMethod={setMethod} />

        <form onSubmit={submit} className="space-y-4 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-900">Submit proof of payment</p>

          <Input
            label="Payment reference"
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            placeholder="e.g. bank transfer reference"
          />

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

          {/* Said before they press it, not discovered from a status afterwards. */}
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            This goes to your company to be checked. Nothing is marked paid until they confirm it.
          </p>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || uploading || !form.document_url}>
              {saving ? 'Submitting…' : 'Submit for review'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

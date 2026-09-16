import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from '../ui/Button';
import FieldMark from '../ui/FieldMark';

const formatWhen = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

function Detail({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="truncate text-sm font-medium text-slate-900" title={value ?? ''}>{value || '—'}</div>
    </div>
  );
}

/**
 * Approve or decline a realtor's inspection request, with a note back to them.
 *
 * The note is optional on approval but required on decline — a realtor being
 * turned down needs to know why, and that message is emailed to them.
 */
export default function InspectionReviewModal({ open, inspection, decision, onClose, onSubmit }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const declining = decision === 'rejected';

  useEffect(() => {
    if (open) { setNotes(''); setError(''); setBusy(false); }
  }, [open, inspection?.id, decision]);

  const submit = async () => {
    if (declining && !notes.trim()) {
      setError('Please give the realtor a reason for declining.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(notes.trim() || null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not update the inspection.');
      setBusy(false);
    }
  };

  if (!inspection) return null;

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={declining ? 'Decline Inspection Request' : 'Approve Inspection Request'}
      size="lg"
    >
      <div className="space-y-5">
        <div
          className={`rounded-lg px-4 py-3 text-sm ${declining ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}
        >
          {declining
            ? 'The realtor will be notified that this request was declined, along with your reason.'
            : 'The realtor will be notified that this inspection is approved.'}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Request details</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Detail label="Reference" value={inspection.ref_number} />
            <Detail label="Property" value={inspection.property_name} />
            <Detail label="Lead" value={inspection.client_name} />
            <Detail label="Lead Phone" value={inspection.client_phone} />
            <Detail label="Realtor" value={inspection.realtor_name} />
            <Detail label="Scheduled" value={formatWhen(inspection.scheduled_at)} />
            <Detail label="Attendees" value={String(inspection.attendees ?? 1)} />
            <Detail label="Current Status" value={inspection.status} />
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            {declining ? 'Reason for declining' : 'Note to the realtor'}
            {declining
              ? <span className="text-red-500"> *</span>
              : <span className="ml-1 font-normal text-slate-400">(optional)</span>}
          <FieldMark /></span>
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => { setNotes(event.target.value); setError(''); }}
            maxLength={500}
            autoFocus
            placeholder={declining
              ? 'e.g. The client already viewed this property last week.'
              : 'e.g. Confirmed with the site team — go ahead.'}
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <span className="block text-right text-xs text-slate-400">{notes.length}/500</span>
        </label>

        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" variant={declining ? 'danger' : 'success'} onClick={submit} disabled={busy}>
            {busy
              ? (declining ? 'Declining…' : 'Approving…')
              : (declining ? 'Decline Request' : 'Approve Request')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

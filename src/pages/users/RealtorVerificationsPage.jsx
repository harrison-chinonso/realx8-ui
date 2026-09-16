import { useEffect, useState } from 'react';
import { approveKyc, listKycSubmissions, rejectKyc, getSettings, upsertSetting } from '../../api/userApi';
import { useCurrency } from '../../context/useAppearance';
import Input from '../../components/ui/Input';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import FieldMark from '../../components/ui/FieldMark';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const LABELS = {
  national_id: 'National ID',
  drivers_license: "Driver's Licence",
  passport: 'Passport',
  voters_card: "Voter's Card",
  utility_bill: 'Utility Bill',
  bank_statement: 'Bank Statement',
  tenancy_agreement: 'Tenancy Agreement',
  other: 'Other',
};

/** Company admin review of realtor identity verifications. */
export default function RealtorVerificationsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [review, setReview] = useState(null);   // { record, decision }
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await listKycSubmissions();
      setRows(response?.data ?? []);
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Could not load verifications.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const action = review.decision === 'approved' ? approveKyc : rejectKyc;
      await action(review.record.id, { notes: notes.trim() || null });
      setReview(null);
      setNotes('');
      setMessage({ type: 'success', text: review.decision === 'approved' ? 'Verification approved.' : 'Verification rejected.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Could not update the verification.' });
    } finally {
      setSaving(false);
    }
  };

  /*
   * What a realtor pays to be verified.
   *
   * One verification, so one price per company — which is why this is a
   * setting and the level-up fees are columns on the levels they price. It
   * lives on this page rather than in Settings because a price is easiest to
   * reason about beside the thing it charges for, and this is the screen an
   * admin is already on when they think about verification at all.
   *
   * Kobo in the store, naira in the field: nobody prices verification in kobo.
   */
  const fmt = useCurrency();
  const [fee, setFee] = useState('');
  const [feeSaving, setFeeSaving] = useState(false);

  useEffect(() => {
    getSettings('realtor')
      .then((response) => {
        const minor = Number(response?.data?.verification_fee_minor || 0);
        setFee(minor > 0 ? String(minor / 100) : '');
      })
      .catch(() => setFee(''));
  }, []);

  const saveFee = async () => {
    setFeeSaving(true);
    try {
      const minor = fee === '' ? 0 : Math.round(Number(fee) * 100);
      await upsertSetting({ key: 'verification_fee_minor', value: String(minor), group: 'realtor' });
      setMessage({ type: 'success', text: minor > 0 ? `Verification fee set to ${fmt(minor / 100)}.` : 'Verification is now free.' });
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError?.response?.data?.message || 'Could not save the fee.' });
    } finally {
      setFeeSaving(false);
    }
  };

  const pending = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Realtor Verifications</h1>
        <p className="text-sm text-slate-500">
          Identity and address documents submitted by your realtors{pending ? ` — ${pending} awaiting review` : ''}.
        </p>
      </div>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Verification fee"
            type="number"
            min="0"
            step="0.01"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
            placeholder="0 — free"
            containerClassName="w-44"
          />
          <Button type="button" variant="secondary" disabled={feeSaving} onClick={saveFee}>
            {feeSaving ? 'Saving…' : 'Save fee'}
          </Button>
          <p className="text-xs text-slate-500">
            Charged when a realtor submits for verification. Leave blank to charge nothing.
          </p>
        </div>
      </section>

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Realtor</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Identification</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Proof of Address</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Submitted</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.realtor?.name || `#${row.user_id}`}</div>
                    <div className="text-xs text-slate-500">{row.realtor?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{LABELS[row.id_type] || row.id_type}</div>
                    <div className="text-xs text-slate-500">{row.id_number}</div>
                    <a href={row.id_document_url} target="_blank" rel="noreferrer" className="text-xs font-medium hover:underline" style={{ color: 'var(--primary)' }}>
                      View document ↗
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{LABELS[row.address_document_type] || row.address_document_type}</div>
                    {row.address_line && <div className="text-xs text-slate-500">{row.address_line}</div>}
                    <a href={row.address_document_url} target="_blank" rel="noreferrer" className="text-xs font-medium hover:underline" style={{ color: 'var(--primary)' }}>
                      View document ↗
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.submitted_at)}</td>
                  <td className="px-4 py-3">
                    <Badge value={row.status} />
                    {row.review_notes && <div className="mt-1 max-w-[12rem] truncate text-xs text-slate-400" title={row.review_notes}>{row.review_notes}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="success" size="sm" onClick={() => { setReview({ record: row, decision: 'approved' }); setNotes(''); }}>Approve</Button>
                        <Button type="button" variant="danger" size="sm" onClick={() => { setReview({ record: row, decision: 'rejected' }); setNotes(''); }}>Reject</Button>
                      </div>
                    ) : <span className="text-xs text-slate-400">Reviewed</span>}
                  </td>
                </tr>
              ))}
              {!loading && !rows.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No verifications submitted yet.</td></tr>
              )}
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!review}
        onClose={() => !saving && setReview(null)}
        title={review?.decision === 'approved' ? 'Approve Verification' : 'Reject Verification'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <strong>{review?.record?.realtor?.name}</strong> — {LABELS[review?.record?.id_type]} ending {String(review?.record?.id_number || '').slice(-4)}.
          </p>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              {review?.decision === 'rejected' ? 'Reason for rejection' : 'Note to the realtor'}
              {/* Required only when rejecting: a rejection has to say why. */}
              <FieldMark required={review?.decision === 'rejected'} />
            </span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder={review?.decision === 'rejected' ? 'e.g. The uploaded ID is not legible.' : ''}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setReview(null)} disabled={saving}>Cancel</Button>
            <Button
              type="button"
              variant={review?.decision === 'approved' ? 'success' : 'danger'}
              onClick={submit}
              disabled={saving || (review?.decision === 'rejected' && !notes.trim())}
            >
              {saving ? 'Saving…' : review?.decision === 'approved' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

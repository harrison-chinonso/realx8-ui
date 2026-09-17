import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyKyc, submitKyc } from '../../api/userApi';
import { useCurrency } from '../../context/useAppearance';
import { uploadPropertyMedia } from '../../api/propertyApi';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../ui/Select';
import FieldMark from '../ui/FieldMark';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const ID_TYPES = [
  { value: 'national_id', label: 'National ID' },
  { value: 'drivers_license', label: "Driver's Licence" },
  { value: 'passport', label: 'International Passport' },
  { value: 'voters_card', label: "Voter's Card" },
];

const ADDRESS_TYPES = [
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'tenancy_agreement', label: 'Tenancy Agreement' },
  { value: 'other', label: 'Other' },
];

const emptyForm = {
  id_type: 'national_id',
  id_number: '',
  id_document_url: '',
  address_document_type: 'utility_bill',
  address_line: '',
  address_document_url: '',
};

/** Uploads one file and reports the hosted URL. */
function DocumentUpload({ label, hint, value, onChange, disabled }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handle = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const uploaded = await uploadPropertyMedia([file]);
      const url = uploaded?.[0]?.url;
      if (!url) throw new Error('Upload did not return a file.');
      onChange(url);
    } catch (err) {
      setError(err?.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{label} <span className="text-red-500">*</span></span>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {value ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <span className="text-xs font-medium text-emerald-700">Uploaded ✓</span>
          <a href={value} target="_blank" rel="noreferrer" className="text-xs font-medium text-emerald-700 underline">View</a>
          {!disabled && (
            <button type="button" onClick={() => onChange('')} className="ml-auto text-xs text-slate-500 hover:text-slate-700">
              Replace
            </button>
          )}
        </div>
      ) : (
        <input type="file" accept="image/*,.pdf" onChange={handle} disabled={disabled || busy} className={INPUT_CLASS} />
      )}
      {busy && <p className="text-xs text-slate-500">Uploading…</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

/** Realtor identity verification (KYC). */
/**
 * The KYC submission form and its current status.
 *
 * Rendered both as the Verification tab of the profile page and as the
 * standalone /realtor/verification route, which the "verification rejected"
 * email links to — so this must keep working outside the profile page.
 */
export default function VerificationPanel() {
  const fmt = useCurrency();
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [charge, setCharge] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await getMyKyc();
      const existing = response?.data ?? null;
      setRecord(existing);
      if (existing) {
        setForm({
          id_type: existing.id_type,
          id_number: existing.id_number,
          id_document_url: existing.id_document_url,
          address_document_type: existing.address_document_type,
          address_line: existing.address_line || '',
          address_document_url: existing.address_document_url,
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not load your verification.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const locked = record?.status === 'approved';
  const set = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await submitKyc(form);
      /*
       * The bill, said here rather than left to be discovered.
       *
       * A company may charge for verification. Telling somebody their
       * submission is "awaiting review" when it is really awaiting THEIR
       * payment leaves them waiting for a decision nobody is going to make —
       * so when a charge came back, the notice says what it is and where to
       * pay it. Absent when the company charges nothing, which is most of them.
       */
      setCharge(response?.charge ?? null);
      setNotice(response?.charge
        ? 'Verification submitted.'
        : 'Verification submitted. An administrator will review it shortly.');
      load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not submit your verification.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="rounded-xl bg-white p-6 text-slate-500">Loading...</div>;

  return (
    <div className="space-y-4">
      {record && (
        <div className={`rounded-xl p-4 ring-1 ${
          record.status === 'approved' ? 'bg-emerald-50 ring-emerald-200'
            : record.status === 'rejected' ? 'bg-rose-50 ring-rose-200'
            : 'bg-amber-50 ring-amber-200'
        }`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Status</span>
            <Badge value={record.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {record.status === 'approved' && 'Your identity has been verified. No further action is needed.'}
            {record.status === 'pending' && 'Your submission is awaiting review.'}
            {record.status === 'rejected' && `Not accepted: ${record.review_notes || 'no reason given.'} Update your documents and resubmit.`}
          </p>
        </div>
      )}

      {notice && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div>}
      {charge && (
        <div className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
          <p>
            A verification fee of <strong>{fmt(charge.amount)}</strong> has been raised against you
            as <strong>{charge.credit_note_id}</strong>.
          </p>
          <p className="mt-1">
            <Link to="/finance/my-notes" className="font-medium underline">
              Pay it and upload your proof
            </Link>{' '}
            — your submission is reviewed once the payment is confirmed.
          </p>
        </div>
      )}
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <form onSubmit={submit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <fieldset disabled={locked} className="space-y-5">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Means of Identification</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Document type<FieldMark required /></span>
                <Select value={form.id_type} onChange={set('id_type')} className={INPUT_CLASS}>
                  {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </label>
              <Input label="Identification number" value={form.id_number} onChange={set('id_number')} required placeholder="e.g. A01234567" />
            </div>
            <div className="mt-4">
              <DocumentUpload
                label="Upload identification"
                hint="A clear photo or PDF of the document."
                value={form.id_document_url}
                onChange={(url) => setForm((f) => ({ ...f, id_document_url: url }))}
                disabled={locked}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Proof of Address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Document type<FieldMark required /></span>
                <Select value={form.address_document_type} onChange={set('address_document_type')} className={INPUT_CLASS}>
                  {ADDRESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </label>
              <Input label="Residential address" value={form.address_line} onChange={set('address_line')} required placeholder="e.g. 12 Admiralty Way, Lekki" />
            </div>
            <div className="mt-4">
              <DocumentUpload
                label="Upload proof of address"
                hint="Dated within the last three months."
                value={form.address_document_url}
                onChange={(url) => setForm((f) => ({ ...f, address_document_url: url }))}
                disabled={locked}
              />
            </div>
          </div>
        </fieldset>

        {!locked && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">Identification number and residential address are both required.</p>
            <Button type="submit" disabled={saving}>
              {saving ? 'Submitting…' : record ? 'Resubmit for Review' : 'Submit for Verification'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

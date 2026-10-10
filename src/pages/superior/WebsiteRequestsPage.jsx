import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { listWebsiteRequests, updateWebsiteRequest } from '../../api/websiteRequestApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/common/Modal';

/**
 * Platform admins: onboarding requests and enquiries from the public website
 * (realx8.net), raised by its form or its assistant. Each moves from New to
 * Contacted to Onboarded (or Closed), with notes on the follow-up. Onboarding
 * itself is done on Companies — this page is the queue that leads there.
 */
const STATUSES = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'onboarded', label: 'Onboarded' },
  { value: 'closed', label: 'Closed' },
];
const STATUS_STYLE = {
  new: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-800',
  onboarded: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-slate-100 text-slate-600',
};
/*
 * What the visitor asked for. 'trial' is the website's free-trial sign-up,
 * which arrives here like the others so somebody can follow it up.
 */
const KIND_LABEL = { enquiry: 'Enquiry', onboarding: 'Onboarding', trial: 'Free trial' };
const KIND_DETAIL = { enquiry: 'Enquiry', onboarding: 'Onboarding request', trial: 'Free trial' };
const kindLabel = (kind) => KIND_LABEL[kind] || KIND_LABEL.onboarding;
const label = (status) => STATUSES.find((s) => s.value === status)?.label || status;
const formatStamp = (value) => (value ? new Date(value).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '—');
const whatsappHref = (number) => {
  let digits = String(number || '').replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) digits = `234${digits.slice(1)}`;
  return digits ? `https://wa.me/${digits}` : null;
};

export default function WebsiteRequestsPage() {
  const [params, setParams] = useSearchParams();
  const filters = {
    status: params.get('status') ?? 'new',
    search: params.get('search') || '',
    page: Number(params.get('page') || 1),
  };
  const [search, setSearch] = useState(filters.search);
  const [result, setResult] = useState({ data: [], pagination: { page: 1, totalPages: 1, total: 0 }, new_count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState({ status: 'new', admin_notes: '' });
  const [saving, setSaving] = useState(false);

  const setFilter = (patch) => {
    const next = { ...filters, ...patch, page: patch.page || 1 };
    const entries = Object.entries(next).filter(([key, value]) => (key === 'status' ? true : value !== '' && value !== 1));
    setParams(Object.fromEntries(entries), { replace: true });
  };

  const load = () => {
    setLoading(true);
    listWebsiteRequests({ status: filters.status || undefined, search: filters.search || undefined, page: filters.page, limit: 25 })
      .then((res) => { setResult(res); setError(''); })
      .catch((err) => setError(err?.response?.data?.message || 'Could not load website requests.'))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [params.toString()]);

  const view = (row) => {
    setOpen(row);
    setDraft({ status: row.status, admin_notes: row.admin_notes || '' });
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateWebsiteRequest(open.id, draft);
      setOpen(null);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save the request.');
    } finally {
      setSaving(false);
    }
  };

  const { data: rows, pagination } = result;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Website requests</h1>
        <p className="mt-1 text-sm text-slate-500">
          Onboarding requests and enquiries from realx8.net, from the form or the website assistant.
          {result.new_count > 0 && <> <strong className="text-slate-700">{result.new_count} new.</strong></>}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1">
          {STATUSES.map((s) => (
            <button
              key={s.value || 'all'}
              type="button"
              role="tab"
              aria-selected={filters.status === s.value}
              onClick={() => setFilter({ status: s.value })}
              className={`min-h-0 rounded-md px-3 py-1.5 text-sm font-medium ${filters.status === s.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setFilter({ search: search.trim() }); }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Company, name, email or reference" className="w-64" aria-label="Search requests" />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}

      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Received</th>
              <th className="px-4 py-2.5">Reference</th>
              <th className="px-4 py-2.5">Company / person</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>}
            {!loading && !rows.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No requests here.</td></tr>}
            {!loading && rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2.5">{formatStamp(r.createdAt || r.created_at)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">{r.reference}</td>
                <td className="px-4 py-2.5">
                  <span className="block font-semibold text-slate-900">{r.company_name || '—'}</span>
                  <span className="block text-xs text-slate-500">{r.contact_name} · {r.email}</span>
                </td>
                <td className="px-4 py-2.5">
                  {kindLabel(r.kind)}
                  <span className="block text-xs text-slate-500">{r.source === 'assistant' ? 'via assistant' : 'via form'}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status] || STATUS_STYLE.closed}`}>{label(r.status)}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button type="button" size="sm" variant="secondary" onClick={() => view(r)}>Open</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{pagination.total.toLocaleString()} request{pagination.total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => setFilter({ page: pagination.page - 1 })}>Previous</Button>
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <Button type="button" variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setFilter({ page: pagination.page + 1 })}>Next</Button>
        </div>
      </div>

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? `${open.reference} · ${open.company_name || open.contact_name}` : ''} size="lg">
        {open && (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Type</dt><dd>{KIND_DETAIL[open.kind] || KIND_DETAIL.onboarding} ({open.source === 'assistant' ? 'website assistant' : 'website form'})</dd></div>
              <div><dt className="text-xs text-slate-500">Received</dt><dd>{formatStamp(open.createdAt || open.created_at)}</dd></div>
              <div><dt className="text-xs text-slate-500">Company</dt><dd>{open.company_name || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Contact</dt><dd>{open.contact_name}</dd></div>
              <div><dt className="text-xs text-slate-500">Business</dt><dd>{open.business_type || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Realtors</dt><dd>{open.realtor_count || '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Interested in</dt><dd>{open.interests || '—'}</dd></div>
              {open.message && (
                <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Message</dt><dd className="whitespace-pre-line">{open.message}</dd></div>
              )}
            </dl>

            <div className="flex flex-wrap gap-2">
              <a href={`mailto:${open.email}?subject=${encodeURIComponent(`Your request ${open.reference}`)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 hover:bg-slate-200"><Mail size={15} aria-hidden="true" /> {open.email}</a>
              {open.phone && <a href={`tel:${open.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 hover:bg-slate-200"><Phone size={15} aria-hidden="true" /> {open.phone}</a>}
              {open.phone && whatsappHref(open.phone) && <a href={whatsappHref(open.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 hover:bg-slate-200"><MessageCircle size={15} aria-hidden="true" /> WhatsApp</a>}
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Status</span>
              <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3">
                {STATUSES.filter((s) => s.value).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Notes</span>
              <textarea rows={4} value={draft.admin_notes} onChange={(e) => setDraft((d) => ({ ...d, admin_notes: e.target.value }))} placeholder="Calls, agreed setup, next step" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(null)} disabled={saving}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

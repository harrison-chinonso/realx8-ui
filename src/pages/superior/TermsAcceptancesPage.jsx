import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { exportTermsAcceptances, listTermsAcceptances } from '../../api/legalApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { enumLabel } from '../../utils/enumLabel';

/**
 * Platform admins: who agreed to the Terms of Use and Privacy Policy, which
 * version, and when — with the address and device it came from and whether
 * they opted in to marketing. Searchable, filterable, exportable as CSV.
 * Nobody else can reach this; the server refuses everyone but a platform
 * administrator.
 */
const CONTEXT_LABEL = { signup: 'Sign-up', google_signup: 'Google sign-up', in_app: 'In the app' };
const formatStamp = (value) => (value ? new Date(value).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '—');

export default function TermsAcceptancesPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const filters = {
    search: params.get('search') || '',
    version: params.get('version') || '',
    type: params.get('type') || '',
    page: Number(params.get('page') || 1),
  };
  const [result, setResult] = useState({ data: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const setFilter = (patch) => {
    const next = { ...filters, ...patch, page: patch.page || 1 };
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '' && v !== 1 && v !== null)), { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTermsAcceptances({ ...filters, limit: 25 })
      .then((res) => { if (!cancelled) { setResult(res); setError(''); } })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || err.userMessage || 'Could not load agreements.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const download = async () => {
    setExporting(true);
    try {
      const blob = await exportTermsAcceptances({ search: filters.search, version: filters.version, type: filters.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `terms-acceptances-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not export the agreements.');
    } finally {
      setExporting(false);
    }
  };

  const { data: rows, pagination } = result;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/superior/legal" className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft size={14} aria-hidden="true" /> Terms &amp; Privacy
          </Link>
          <h1 className="text-xl font-bold text-slate-800">Terms acceptances</h1>
          <p className="mt-1 text-sm text-slate-500">Every agreement to the Terms of Use and Privacy Policy, newest first.</p>
        </div>
        <Button type="button" variant="secondary" onClick={download} disabled={exporting || !pagination.total}>
          <Download size={16} aria-hidden="true" /> {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => { e.preventDefault(); setFilter({ search: search.trim() }); }}
      >
        <label className="block min-w-[14rem] flex-1 space-y-1">
          <span className="text-xs font-medium text-slate-600">Search name, email or company</span>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. ada@example.com" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Version</span>
          <Input type="number" min="1" value={filters.version} onChange={(e) => setFilter({ version: e.target.value })} placeholder="All" className="w-24" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Account type</span>
          <select value={filters.type} onChange={(e) => setFilter({ type: e.target.value })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="">All</option>
            <option value="realtor">Realtor</option>
            <option value="client">Client</option>
          </select>
        </label>
        <Button type="submit">Search</Button>
      </form>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}

      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Agreed on</th>
              <th className="px-4 py-2.5">Person</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">Version</th>
              <th className="px-4 py-2.5">Terms</th>
              <th className="px-4 py-2.5">Privacy</th>
              <th className="px-4 py-2.5">Marketing</th>
              <th className="px-4 py-2.5">How</th>
              <th className="px-4 py-2.5">IP address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>}
            {!loading && !rows.length && <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-500">No agreements match.</td></tr>}
            {!loading && rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2.5">{formatStamp(r.accepted_at)}</td>
                <td className="px-4 py-2.5">
                  <span className="block font-semibold text-slate-900">{r.user_name || '—'}</span>
                  <span className="block text-xs text-slate-500">{r.user_email || ''}</span>
                </td>
                <td className="px-4 py-2.5">{r.user_type ? enumLabel(r.user_type) : '—'}</td>
                <td className="px-4 py-2.5">{r.company_name || '—'}</td>
                <td className="px-4 py-2.5">v{r.version}</td>
                <td className="px-4 py-2.5">{r.accepted_terms ? 'Agreed' : '—'}</td>
                <td className="px-4 py-2.5">{r.accepted_privacy ? 'Agreed' : '—'}</td>
                <td className="px-4 py-2.5">{r.marketing_opt_in ? 'Opted in' : 'No'}</td>
                <td className="px-4 py-2.5">{CONTEXT_LABEL[r.context] || r.context || '—'}</td>
                <td className="px-4 py-2.5 font-mono text-xs" title={r.user_agent || ''}>{r.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{pagination.total.toLocaleString()} agreement{pagination.total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => setFilter({ page: pagination.page - 1 })}>Previous</Button>
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <Button type="button" variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setFilter({ page: pagination.page + 1 })}>Next</Button>
        </div>
      </div>
    </div>
  );
}

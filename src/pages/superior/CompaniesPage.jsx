import { useEffect, useState, useCallback } from 'react';
import client from '../../api/client';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS = { active: 'success', suspended: 'error', pending: 'warning', inactive: 'default' };

const PLAN_COLORS = {
  standard: 'bg-slate-100 text-slate-600',
  pro: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-violet-100 text-violet-700',
};

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin',
  'Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso',
  'Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China',
  'Colombia','Comoros','Congo (Brazzaville)','Congo (Kinshasa)','Costa Rica','Croatia','Cuba','Cyprus',
  'Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador',
  'Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia',
  'Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti',
  'Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica',
  'Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon',
  'Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia',
  'Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova',
  'Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands',
  'New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan',
  'Palau','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania',
  'Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa',
  'San Marino','São Tomé and Príncipe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone',
  'Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan',
  'Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania',
  'Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu',
  'Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
];

const EMPTY_FORM = {
  name: '', email: '', phone: '', website: '', country: '',
  admin_first_name: '', admin_last_name: '', admin_email: '',
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color = 'blue', sub }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   val: 'text-blue-700' },
    green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600', val: 'text-green-700' },
    red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',     val: 'text-red-700' },
    amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-600', val: 'text-amber-700' },
    violet: { bg: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600', val: 'text-violet-700' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className={`flex items-center gap-4 rounded-xl ${c.bg} px-5 py-4 ring-1 ring-black/5`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${c.icon}`}>{icon}</div>
      <div>
        <div className={`text-2xl font-bold ${c.val}`}>{value ?? '—'}</div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Company Avatar ───────────────────────────────────────────────────────────

function CompanyAvatar({ company }) {
  if (company.logo_url) {
    return (
      <img src={company.logo_url} alt={company.name}
        className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-0.5 ring-1 ring-slate-200" />
    );
  }
  const colors = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-orange-500','bg-rose-500','bg-teal-500'];
  const color = colors[(company.name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color} text-base font-bold text-white`}>
      {(company.name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Company Row ──────────────────────────────────────────────────────────────

function CompanyRow({ company, onStatusToggle, onNavigate }) {
  return (
    <tr className="group border-b border-slate-100 transition-colors hover:bg-slate-50/70">
      {/* Company */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <CompanyAvatar company={company} />
          <div>
            <div className="font-semibold text-slate-800 leading-tight">{company.name}</div>
            <div className="text-xs text-slate-400">{company.email}</div>
          </div>
        </div>
      </td>

      {/* Contact */}
      <td className="px-4 py-3 text-sm text-slate-600">
        <div>{company.phone || '—'}</div>
        <div className="text-xs text-slate-400">{company.country || ''}</div>
      </td>

      {/* Plan */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PLAN_COLORS[company.plan] || PLAN_COLORS.standard}`}>
          {company.plan || 'standard'}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant={STATUS_COLORS[company.status] || 'default'}>
          {company.status}
        </Badge>
      </td>

      {/* Created */}
      <td className="px-4 py-3 text-xs text-slate-500">
        {company.created_at ? new Date(company.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Button onClick={() => onNavigate(company.id)} variant="primary" size="sm">
            Manage
          </Button>
          <Button
            onClick={() => onStatusToggle(company)}
            variant={company.status === 'active' ? 'danger' : 'success'}
            size="sm"
          >
            {company.status === 'active' ? 'Suspend' : 'Activate'}
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companiesRes, overviewRes] = await Promise.allSettled([
        client.get('/companies'),
        client.get('/companies/overview'),
      ]);
      if (companiesRes.status === 'fulfilled') {
        setCompanies(Array.isArray(companiesRes.value.data?.data) ? companiesRes.value.data.data : []);
      }
      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value.data?.data || overviewRes.value.data || null);
      }
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = companies.filter((c) => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.country?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchPlan = filterPlan === 'all' || c.plan === filterPlan;
    return matchSearch && matchStatus && matchPlan;
  });

  const handleStatusToggle = async (company) => {
    const newStatus = company.status === 'active' ? 'suspended' : 'active';
    await client.patch(`/companies/${company.id}/status`, { status: newStatus });
    load();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await client.post('/companies', form);
      setShowNew(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || 'Failed to onboard company.');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = companies.filter((c) => c.status === 'active').length;
  const suspendedCount = companies.filter((c) => c.status === 'suspended').length;
  const pendingCount = companies.filter((c) => c.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            🌐 Platform Admin
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Companies</h1>
          <p className="mt-0.5 text-sm text-slate-500">Onboard, configure and monitor all tenant companies on the platform.</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="shrink-0">
          ＋ Onboard Company
        </Button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Companies" value={loading ? '…' : companies.length} icon="🏢" color="blue" />
        <StatCard label="Active" value={loading ? '…' : activeCount} icon="✅" color="green"
          sub={companies.length ? `${Math.round(activeCount / companies.length * 100)}% of total` : null} />
        <StatCard label="Suspended" value={loading ? '…' : suspendedCount} icon="🚫" color="red" />
        <StatCard label="Platform Users" value={loading ? '…' : (overview?.total_users ?? '—')} icon="👥" color="violet"
          sub="across all companies" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Search by name, email or country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </Select>
        <Select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          <option value="all">All Plans</option>
          <option value="standard">Standard</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </Select>
        {(search || filterStatus !== 'all' || filterPlan !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterPlan('all'); }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:bg-slate-50">
            ✕ Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 shrink-0">
          {filtered.length} of {companies.length} companies
        </span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 text-4xl">🏢</div>
            <p className="text-sm font-medium text-slate-600">No companies found</p>
            <p className="mt-1 text-xs text-slate-400">
              {search || filterStatus !== 'all' || filterPlan !== 'all'
                ? 'Try adjusting your filters'
                : 'Onboard your first company to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((company) => (
                  <CompanyRow
                    key={company.id}
                    company={company}
                    onStatusToggle={handleStatusToggle}
                    onNavigate={(id) => navigate(`/superior/companies/${id}/settings`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Onboard Modal ── */}
      <Modal open={showNew} onClose={() => { setShowNew(false); setError(''); setForm(EMPTY_FORM); }} title="Onboard New Company" size="lg">
        <form onSubmit={handleCreate} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
          )}

          {/* Company Details */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Company Details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Company Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
              <FormField label="Company Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} required />
              <FormField label="Phone Number" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600">Country<FieldMark /></label>
                <Select value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                  <option value="">— Select country —</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Website" value={form.website} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Super Admin Account */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Super Admin Account <span className="normal-case font-normal text-slate-400">(credentials will be emailed)</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="First Name" value={form.admin_first_name} onChange={(v) => setForm((f) => ({ ...f, admin_first_name: v }))} required />
              <FormField label="Last Name" value={form.admin_last_name} onChange={(v) => setForm((f) => ({ ...f, admin_last_name: v }))} required />
              <div className="sm:col-span-2">
                <FormField label="Admin Email" type="email" value={form.admin_email} onChange={(v) => setForm((f) => ({ ...f, admin_email: v }))} required />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" onClick={() => { setShowNew(false); setError(''); setForm(EMPTY_FORM); }} variant="secondary">
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Onboarding…' : 'Onboard Company'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

function FormField({ label, value, onChange, type = 'text', required }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-600">
        {label}{required && <span className="ml-0.5 text-rose-500">*</span>}<FieldMark required />
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );
}


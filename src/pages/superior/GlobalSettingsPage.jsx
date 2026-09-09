import { useEffect, useRef, useState } from 'react';
import client from '../../api/client';
import { FONT_CATALOGUE } from '../../config/fonts';
import Button from '../../components/ui/Button';
import { CURRENCIES, currencyOptionLabel } from '../../constants/currencies';
import Select from '../../components/ui/Select';

// ─── Constants ──────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Rose', value: '#e11d48' },
];

const SECONDARY_PRESETS = [
  { label: 'Slate', value: '#0f172a' },
  { label: 'Navy', value: '#0c1445' },
  { label: 'Indigo Dark', value: '#1e1b4b' },
  { label: 'Forest', value: '#14532d' },
  { label: 'Charcoal', value: '#1c1c1e' },
  { label: 'Teal Dark', value: '#134e4a' },
  { label: 'Wine', value: '#450a0a' },
];

const TEMPLATE_OPTIONS = [
  { id: 'classic', label: 'Classic', description: 'Dark sidebar + top header' },
  { id: 'modern', label: 'Modern', description: 'Full-width top navigation' },
  { id: 'minimal', label: 'Minimal', description: 'Icon-only collapsible sidebar' },
  { id: 'bold', label: 'Bold', description: 'Light sidebar with brand accent' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'GBP', label: 'GBP — British Pound (£)' },
  { value: 'NGN', label: 'NGN — Nigerian Naira (₦)' },
  { value: 'GHS', label: 'GHS — Ghanaian Cedi (₵)' },
  { value: 'KES', label: 'KES — Kenyan Shilling (KSh)' },
  { value: 'ZAR', label: 'ZAR — South African Rand (R)' },
  { value: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
  { value: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { value: 'AED', label: 'AED — UAE Dirham (د.إ)' },
  { value: 'INR', label: 'INR — Indian Rupee (₹)' },
];

const TABS = [
  { key: 'appearance', label: '🎨 Appearance', icon: '🎨' },
  { key: 'general', label: '⚙️ General', icon: '⚙️' },
  { key: 'email', label: '📧 Email', icon: '📧' },
  { key: 'payment', label: '💳 Payment', icon: '💳' },
  { key: 'system', label: '🔧 System', icon: '🔧' },
];

const FIELD_GROUPS = {
  general: [
    { key: 'site_name', label: 'Site Name', type: 'text' },
    { key: 'site_email', label: 'Site Email', type: 'email' },
    { key: 'site_phone', label: 'Site Phone', type: 'text' },
    // Code only — the sign shown across the app is derived from it.
    { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES.map((c) => ({ value: c.code, label: currencyOptionLabel(c) })) },
  ],
  email: [
    { key: 'mail_driver', label: 'Mail Driver', type: 'text', placeholder: 'smtp' },
    { key: 'mail_host', label: 'SMTP Host', type: 'text' },
    { key: 'mail_port', label: 'SMTP Port', type: 'text', placeholder: '587' },
    { key: 'mail_username', label: 'SMTP Username', type: 'text' },
    { key: 'mail_from_name', label: 'From Name', type: 'text' },
    { key: 'mail_from_address', label: 'From Email', type: 'email' },
  ],
  payment: [
    { key: 'paystack_public_key', label: 'Paystack Public Key', type: 'text' },
    { key: 'paystack_secret_key', label: 'Paystack Secret Key', type: 'password' },
    { key: 'flutterwave_public_key', label: 'Flutterwave Public Key', type: 'text' },
    { key: 'flutterwave_secret_key', label: 'Flutterwave Secret Key', type: 'password' },
    { key: 'stripe_public_key', label: 'Stripe Public Key', type: 'text' },
    { key: 'stripe_secret_key', label: 'Stripe Secret Key', type: 'password' },
  ],
  system: [
    { key: 'jwt_secret', label: 'JWT Secret', type: 'password', sensitive: true },
    { key: 'jwt_expires_in', label: 'JWT Expires In', type: 'text', placeholder: '7d' },
    { key: 'cloudinary_cloud_name', label: 'Cloudinary Cloud Name', type: 'text' },
    { key: 'cloudinary_api_key', label: 'Cloudinary API Key', type: 'text' },
    { key: 'cloudinary_api_secret', label: 'Cloudinary API Secret', type: 'password', sensitive: true },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg transition-all ${
      toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`}>
      {toast.msg}
    </div>
  );
}

function PasswordField({ label, fieldKey, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button type="button" onClick={() => setShow((s) => !s)} className="text-slate-400 hover:text-slate-600 text-sm">
          {show ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}

// ─── Appearance Tab ───────────────────────────────────────────────────────────

function AppearanceTab({ companyId, scopeLabel, onToast }) {
  const [form, setForm] = useState({
    app_name: '',
    primary_color: '#2563eb',
    secondary_color: '#0f172a',
    font_heading: 'Tomato Grotesk',
    font_body: 'Inter',
    font_ui: 'Inter',
    currency: 'USD',
    template: 'classic',
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    setLoading(true);
    const params = companyId ? { effective: true, company_id: companyId } : {};
    client.get('/settings', { params: { ...params, group: 'appearance' } })
      .then((res) => {
        const d = res.data?.data || {};
        setForm({
          app_name: d.app_name || '',
          primary_color: d.primary_color || '#2563eb',
          secondary_color: d.secondary_color || '#0f172a',
          font_heading: d.font_heading || 'Tomato Grotesk',
          font_body: d.font_body || 'Inter',
          font_ui: d.font_ui || 'Inter',
          currency: d.currency || 'USD',
          template: d.template || 'classic',
        });
        setLogoPreview(d.app_logo || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        if (companyId) fd.append('company_id', String(companyId));
        await client.post('/settings/upload-logo', fd);
        setLogoFile(null);
      }

      const settings = [
        { key: 'app_name', value: form.app_name },
        { key: 'primary_color', value: form.primary_color },
        { key: 'secondary_color', value: form.secondary_color },
        { key: 'font_heading', value: form.font_heading },
        { key: 'font_body', value: form.font_body },
        { key: 'font_ui', value: form.font_ui },
        { key: 'font_family', value: form.font_body },
        { key: 'currency', value: form.currency },
        { key: 'template', value: form.template },
      ].map((s) => (companyId ? { ...s, company_id: companyId } : s));

      await client.post('/settings/bulk', { settings, group: 'appearance' });
      onToast(`Appearance saved for ${scopeLabel}.`, 'success');
    } catch (err) {
      onToast(err.userMessage || 'Failed to save appearance.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>;

  return (
    <div className="space-y-6">
      {/* Template */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Layout Template</h2>
          <p className="mt-0.5 text-sm text-slate-500">Overall look and feel for {scopeLabel}.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TEMPLATE_OPTIONS.map((t) => (
            <Button
              key={t.id}
              type="button"
              onClick={() => setForm((f) => ({ ...f, template: t.id }))}
              variant={form.template === t.id ? 'primary' : 'secondary'}
              size="sm"
              className="h-auto flex-col items-stretch overflow-hidden p-0 text-left"
            >
              <div className={`px-3 py-3 ${form.template === t.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}>
                <div className="text-xs font-semibold">{t.label}</div>
                <div className={`text-[10px] mt-0.5 ${form.template === t.id ? 'text-blue-100' : 'text-slate-400'}`}>{t.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Branding */}
      <div className="space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {/* App Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">App Name</label>
          <input type="text" value={form.app_name}
            onChange={(e) => setForm((f) => ({ ...f, app_name: e.target.value }))}
            placeholder="e.g. Realto"
            className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Logo */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Logo</label>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
              {logoPreview
                ? <img src={logoPreview} alt="logo" className="h-full w-full object-contain p-1" />
                : <span className="text-2xl text-slate-400">🖼</span>}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); } }} />
              <Button type="button" onClick={() => fileRef.current?.click()} variant="secondary" size="sm">
                {logoPreview ? 'Change logo' : 'Upload logo'}
              </Button>
              <p className="mt-1 text-xs text-slate-500">PNG or SVG. Uploaded to Cloudinary.</p>
            </div>
          </div>
        </div>

        {/* Primary Color */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Primary Color</label>
          <div className="flex flex-wrap items-center gap-3">
            {PRESET_COLORS.map((c) => (
              <button key={c.value} type="button" title={c.label}
                onClick={() => setForm((f) => ({ ...f, primary_color: c.value }))}
                className="h-9 w-9 rounded-full border-4 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c.value,
                  borderColor: form.primary_color === c.value ? '#0f172a' : 'transparent',
                  boxShadow: form.primary_color === c.value ? '0 0 0 2px #fff, 0 0 0 4px #0f172a' : 'none',
                }} />
            ))}
            <div className="ml-2 flex items-center gap-2">
              <input type="color" value={form.primary_color}
                onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
                className="h-9 w-9 cursor-pointer rounded-lg border border-slate-300" />
              <span className="font-mono text-sm text-slate-500">{form.primary_color}</span>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Buttons, active links, highlights.</p>
        </div>

        {/* Secondary Color */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Secondary Color</label>
          <div className="flex flex-wrap items-center gap-3">
            {SECONDARY_PRESETS.map((c) => (
              <button key={c.value} type="button" title={c.label}
                onClick={() => setForm((f) => ({ ...f, secondary_color: c.value }))}
                className="h-9 w-9 rounded-full border-4 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c.value,
                  borderColor: form.secondary_color === c.value ? '#7c3aed' : 'transparent',
                  boxShadow: form.secondary_color === c.value ? '0 0 0 2px #fff, 0 0 0 4px #7c3aed' : 'none',
                }} />
            ))}
            <div className="ml-2 flex items-center gap-2">
              <input type="color" value={form.secondary_color}
                onChange={(e) => setForm((f) => ({ ...f, secondary_color: e.target.value }))}
                className="h-9 w-9 cursor-pointer rounded-lg border border-slate-300" />
              <span className="font-mono text-sm text-slate-500">{form.secondary_color}</span>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Sidebar background, brand band, dark accents.</p>
        </div>

        {/* Color preview bar */}
        <div className="flex overflow-hidden rounded-lg text-xs font-medium text-white">
          <div className="flex-1 px-4 py-3" style={{ backgroundColor: form.primary_color }}>Primary</div>
          <div className="flex-1 px-4 py-3" style={{ backgroundColor: form.secondary_color }}>Secondary</div>
        </div>

        {/* Typography */}
        <div className="space-y-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Typography</h3>
          {[
            { key: 'font_heading', label: 'Headings', desc: 'h1–h4, section headers' },
            { key: 'font_body', label: 'Body Text', desc: 'Paragraphs, lists, tables' },
            { key: 'font_ui', label: 'UI / Interface', desc: 'Buttons, inputs, navigation' },
          ].map(({ key, label, desc }) => (
            <div key={key}>
              <div className="mb-2">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <span className="ml-2 text-xs text-slate-400">{desc}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {FONT_CATALOGUE.map((entry) => {
                  const name = typeof entry === 'string' ? entry : entry.name;
                  const stack = typeof entry === 'object' ? entry.stack : `'${name}', sans-serif`;
                  const tag = typeof entry === 'object' ? entry.tag : null;
                  const active = form[key] === name;
                  return (
                    <Button
                      key={name}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, [key]: name }))}
                      variant={active ? 'primary' : 'secondary'}
                      size="sm"
                      className="h-auto flex-col items-start px-3 py-2 text-left"
                      style={{ fontFamily: stack }}>
                      <span className="text-sm font-semibold leading-none">{name}</span>
                      {tag && <span className="mt-1 text-[10px] font-normal opacity-60" style={{ fontFamily: 'Inter, sans-serif' }}>{tag}</span>}
                    </Button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs italic text-slate-400"
                style={{ fontFamily: FONT_CATALOGUE.find((e) => e.name === form[key])?.stack || `'${form[key]}', sans-serif` }}>
                The quick brown fox jumps over the lazy dog — {form[key]}
              </p>
            </div>
          ))}
        </div>

        {/* Currency */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
          <Select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            {CURRENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : `Save & Apply for ${scopeLabel}`}
        </Button>
      </div>
    </div>
  );
}

// ─── Generic Field Tab ────────────────────────────────────────────────────────

function FieldTab({ tabKey, companyId, scopeLabel, onToast }) {
  const fields = FIELD_GROUPS[tabKey] || [];
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = companyId
      ? { effective: true, company_id: companyId, group: tabKey }
      : { group: tabKey };
    client.get('/settings', { params })
      .then((res) => setValues(res.data?.data || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tabKey, companyId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = fields.map(({ key }) => {
        const entry = { key, value: values[key] || '' };
        if (companyId) entry.company_id = companyId;
        return entry;
      });
      await client.post('/settings/bulk', { settings, group: tabKey });
      onToast(`Settings saved for ${scopeLabel}.`, 'success');
    } catch (err) {
      onToast(err.userMessage || 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-3">{fields.map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>;

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
      {fields.map(({ key, label, type, placeholder, sensitive, options }) =>
        type === 'password' || sensitive ? (
          <PasswordField key={key} label={label} fieldKey={key}
            value={values[key] || ''} onChange={(v) => setValues((s) => ({ ...s, [key]: v }))} />
        ) : (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
            {type === 'select' ? (
              <Select value={values[key] || ''}
                onChange={(e) => setValues((s) => ({ ...s, [key]: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Not set</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            ) : (
              <input type={type || 'text'} value={values[key] || ''} placeholder={placeholder || ''}
                onChange={(e) => setValues((s) => ({ ...s, [key]: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            )}
          </div>
        )
      )}
      <Button type="button" onClick={handleSave} disabled={saving}
        >
        {saving ? 'Saving…' : `Save for ${scopeLabel}`}
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GlobalSettingsPage() {
  const [companies, setCompanies] = useState([]);
  // scope: null = global defaults, number = company id
  const [scopeId, setScopeId] = useState(null);
  const [activeTab, setActiveTab] = useState('appearance');
  const [toast, setToast] = useState(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    client.get('/companies')
      .then((res) => {
        const rows = Array.isArray(res.data?.data) ? res.data.data
          : Array.isArray(res.data) ? res.data : [];
        setCompanies(rows);
      })
      .catch(() => {})
      .finally(() => setLoadingCompanies(false));
  }, []);

  const selectedCompany = companies.find((c) => c.id === scopeId) || null;
  const scopeLabel = scopeId === null ? 'Global Defaults' : (selectedCompany?.name || `Company #${scopeId}`);
  const isGlobal = scopeId === null;

  return (
    <div className="space-y-6">
      <Toast toast={toast} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            🌐 Platform Admin
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage global defaults or override settings for a specific company.
          </p>
        </div>

        {/* Scope Picker */}
        <div className="flex min-w-64 flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Editing settings for
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <span className="text-base">{isGlobal ? '🌐' : '🏢'}</span>
            </div>
            <Select
              value={scopeId === null ? '' : String(scopeId)}
              onChange={(e) => {
                const v = e.target.value;
                setScopeId(v === '' ? null : Number(v));
                setActiveTab('appearance');
              }}
              className="w-full appearance-none rounded-xl border-2 border-blue-300 bg-white py-2.5 pl-9 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              disabled={loadingCompanies}
            >
              <option value="">🌐 Global Defaults (all companies)</option>
              {companies.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  🏢 {c.name}
                </option>
              ))}
            </Select>
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Scope info pill */}
          <div className={`rounded-lg px-3 py-2 text-xs ${isGlobal ? 'bg-blue-50 text-blue-700' : 'bg-blue-50 text-blue-700'}`}>
            {isGlobal
              ? 'Changes become platform-wide defaults for all companies that haven\'t set their own values.'
              : `Changes override settings only for ${selectedCompany?.name || 'this company'} — global defaults remain unchanged.`}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar tabs */}
        <aside className="flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-200 lg:w-48 lg:flex-col lg:overflow-x-visible">
          {TABS.map((t) => (
            <Button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              variant={activeTab === t.key ? 'primary' : 'secondary'}
              size="sm"
              className="shrink-0 whitespace-nowrap lg:w-full lg:justify-start"
            >
              <span>{t.icon}</span>
              <span className="hidden lg:inline">{t.label.replace(/^\S+\s/, '')}</span>
              <span className="lg:hidden">{t.label}</span>
            </Button>
          ))}
        </aside>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'appearance' ? (
            <AppearanceTab key={`${scopeId}-appearance`} companyId={scopeId} scopeLabel={scopeLabel} onToast={showToast} />
          ) : (
            <FieldTab key={`${scopeId}-${activeTab}`} tabKey={activeTab} companyId={scopeId} scopeLabel={scopeLabel} onToast={showToast} />
          )}
        </div>
      </div>
    </div>
  );
}

// Remove legacy duplicate code below — kept in CompanySettingsPage instead

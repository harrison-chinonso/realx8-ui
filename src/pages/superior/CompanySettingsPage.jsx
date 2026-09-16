import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client';
import { FONT_CATALOGUE, FONT_CATEGORIES } from '../../config/fonts';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { brightenForDark } from '../../utils/colorUtils';
import { CURRENCIES, currencyOptionLabel } from '../../constants/currencies';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';

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

const DARK_PRIMARY_PRESETS = [
  { label: 'Sky Blue', value: '#60a5fa' },
  { label: 'Violet', value: '#a78bfa' },
  { label: 'Emerald', value: '#34d399' },
  { label: 'Amber', value: '#fbbf24' },
  { label: 'Rose', value: '#fb7185' },
  { label: 'Teal', value: '#2dd4bf' },
  { label: 'Orange', value: '#fb923c' },
];

const DARK_SECONDARY_PRESETS = [
  { label: 'Slate Blue', value: '#94a3b8' },
  { label: 'Indigo', value: '#818cf8' },
  { label: 'Steel Blue', value: '#7dd3fc' },
  { label: 'Mint', value: '#6ee7b7' },
  { label: 'Lavender', value: '#c4b5fd' },
  { label: 'Silver', value: '#9ca3af' },
  { label: 'Peach', value: '#fdba74' },
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
  { value: 'JPY', label: 'JPY — Japanese Yen (¥)' },
  { value: 'CHF', label: 'CHF — Swiss Franc (Fr)' },
  { value: 'SAR', label: 'SAR — Saudi Riyal (﷼)' },
  { value: 'EGP', label: 'EGP — Egyptian Pound (E£)' },
  { value: 'XOF', label: 'XOF — West African CFA Franc (CFA)' },
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
    { key: 'mail_password', label: 'SMTP Password', type: 'password' },
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
    { key: 'jwt_secret', label: 'JWT Secret', type: 'password' },
    { key: 'jwt_expires_in', label: 'JWT Expires In', type: 'text', placeholder: '7d' },
    { key: 'cloudinary_cloud_name', label: 'Cloudinary Cloud Name', type: 'text' },
    { key: 'cloudinary_api_key', label: 'Cloudinary API Key', type: 'text' },
    { key: 'cloudinary_api_secret', label: 'Cloudinary API Secret', type: 'password' },
  ],
};

const TABS = [
  { key: 'details', label: 'Company Details' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'general', label: 'General' },
  { key: 'email', label: 'Email' },
  { key: 'payment', label: 'Payment' },
  { key: 'system', label: 'System Config' },
];

const STATUS_OPTIONS = ['active', 'suspended', 'pending'];
const PLAN_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];
const CODE_REGEX = /^[A-Z0-9]{5}$/;

function PreviewClassic() {
  return (
    <svg viewBox="0 0 200 112" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="112" fill="#0f172a" />
      <rect x="8" y="8" width="32" height="8" rx="2" fill="#3b82f6" />
      {[26, 38, 50, 62, 74, 86].map((y, i) => (
        <rect key={i} x="8" y={y} width={i === 0 ? 32 : 28} height="6" rx="2" fill={i === 0 ? '#2563eb' : '#334155'} />
      ))}
      <rect x="48" y="0" width="152" height="20" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <rect x="56" y="6" width="60" height="5" rx="2" fill="#94a3b8" />
      <rect x="176" y="5" width="16" height="10" rx="4" fill="#0f172a" />
      <rect x="48" y="20" width="152" height="92" fill="#f8fafc" />
      <rect x="56" y="28" width="64" height="10" rx="2" fill="#e2e8f0" />
      <rect x="56" y="44" width="130" height="6" rx="2" fill="#e2e8f0" />
      <rect x="56" y="54" width="100" height="6" rx="2" fill="#e2e8f0" />
      <rect x="56" y="68" width="130" height="24" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

function PreviewModern() {
  return (
    <svg viewBox="0 0 200 112" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="22" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <rect x="8" y="7" width="20" height="8" rx="2" fill="#3b82f6" />
      <rect x="36" y="8" width="20" height="6" rx="2" fill="#94a3b8" />
      <rect x="62" y="8" width="24" height="6" rx="2" fill="#94a3b8" />
      <rect x="92" y="8" width="18" height="6" rx="2" fill="#94a3b8" />
      <rect x="116" y="8" width="22" height="6" rx="2" fill="#94a3b8" />
      <circle cx="188" cy="11" r="7" fill="#2563eb" />
      <rect y="22" width="200" height="90" fill="#f8fafc" />
      {[8, 58, 108, 158].map((x) => (
        <rect key={x} x={x} y="30" width="42" height="24" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      <rect x="8" y="62" width="184" height="36" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

function PreviewMinimal() {
  return (
    <svg viewBox="0 0 200 112" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="18" height="112" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      {[8, 22, 36, 50, 64, 78, 92].map((y, i) => (
        <rect key={i} x="4" y={y} width="10" height="10" rx="3" fill={i === 0 ? '#2563eb' : '#cbd5e1'} />
      ))}
      <rect x="18" y="0" width="182" height="18" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <circle cx="190" cy="9" r="6" fill="#2563eb" />
      <rect x="18" y="18" width="182" height="94" fill="#f8fafc" />
      {[26, 76, 126].map((x) => (
        <rect key={x} x={x} y="26" width="60" height="18" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      <rect x="26" y="50" width="160" height="40" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

function PreviewBold() {
  return (
    <svg viewBox="0 0 200 112" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="52" height="112" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" />
      <rect width="52" height="22" fill="#2563eb" />
      <rect x="6" y="7" width="20" height="8" rx="2" fill="rgba(255,255,255,0.9)" />
      <rect x="0" y="30" width="3" height="10" fill="#2563eb" />
      <rect x="6" y="32" width="36" height="6" rx="2" fill="#dbeafe" />
      {[46, 58, 70, 82, 94].map((y) => (
        <rect key={y} x="6" y={y + 2} width="32" height="5" rx="2" fill="#cbd5e1" />
      ))}
      <rect x="4" y="98" width="44" height="10" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <circle cx="12" cy="103" r="4" fill="#2563eb" />
      <rect x="52" y="0" width="148" height="18" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <rect x="60" y="6" width="50" height="6" rx="2" fill="#94a3b8" />
      <rect x="52" y="18" width="148" height="94" fill="#f1f5f9" />
      <rect x="60" y="26" width="52" height="8" rx="2" fill="#e2e8f0" />
      <rect x="60" y="40" width="132" height="20" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <rect x="60" y="66" width="132" height="20" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

function PreviewGrouped() {
  return (
    <svg viewBox="0 0 200 112" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="56" height="112" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <rect x="6" y="6" width="24" height="8" rx="2" fill="#3b82f6" />
      <rect x="4" y="20" width="48" height="8" rx="3" fill="#2563eb" />
      <rect x="9" y="23" width="22" height="2.5" rx="1" fill="rgba(255,255,255,0.85)" />
      <line x1="6" y1="32" x2="50" y2="32" stroke="#e2e8f0" strokeWidth="1" />
      <rect x="6" y="35" width="30" height="3" rx="1" fill="#cbd5e1" />
      <line x1="10" y1="42" x2="10" y2="62" stroke="#e2e8f0" strokeWidth="1" />
      {[42, 50, 58].map((y) => (
        <rect key={y} x="13" y={y + 1} width="32" height="4" rx="1.5" fill="#f1f5f9" />
      ))}
      <rect x="6" y="68" width="20" height="3" rx="1" fill="#cbd5e1" />
      <path d="M48 68 L52 70 L48 72" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />
      <rect x="6" y="76" width="26" height="3" rx="1" fill="#e2e8f0" />
      <rect x="4" y="98" width="48" height="10" rx="3" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      <circle cx="11" cy="103" r="3.5" fill="#2563eb" />
      <rect x="17" y="101" width="22" height="2.5" rx="1" fill="#cbd5e1" />
      <rect x="17" y="105" width="14" height="2" rx="1" fill="#e2e8f0" />
      <rect x="56" y="0" width="144" height="112" fill="#f8fafc" />
      <rect x="64" y="10" width="56" height="8" rx="2" fill="#e2e8f0" />
      {[26, 42].map((y) => (
        <rect key={y} x="64" y={y} width="118" height="12" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      <rect x="64" y="60" width="56" height="10" rx="2" fill="#e2e8f0" />
      <rect x="64" y="75" width="118" height="28" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

const TEMPLATE_OPTIONS = [
  { id: 'classic', label: 'Classic', description: 'Dark sidebar + top header', Preview: PreviewClassic },
  { id: 'modern', label: 'Modern', description: 'Full-width top navigation', Preview: PreviewModern },
  { id: 'minimal', label: 'Minimal', description: 'Icon-only collapsible sidebar', Preview: PreviewMinimal },
  { id: 'bold', label: 'Bold', description: 'Light sidebar with brand accent', Preview: PreviewBold },
  { id: 'grouped', label: 'Grouped', description: 'Collapsible grouped left sidebar', Preview: PreviewGrouped },
];

const FALLBACK_FONT_GROUPS = [
  { key: 'font_heading', label: 'Headings', description: 'h1 – h4 titles and section headers' },
  { key: 'font_body', label: 'Body Text', description: 'Paragraphs, lists, table cells' },
  { key: 'font_ui', label: 'UI & Interface', description: 'Buttons, inputs, labels, navigation' },
];

const getFontName = (entry) => (typeof entry === 'string' ? entry : entry.name);
const getFontStack = (entry) => (typeof entry === 'string' ? `'${entry}', sans-serif` : entry.stack);
const getFontTag = (entry) => (typeof entry === 'string' ? null : entry.tag);
const getSavedFontStack = (name) => {
  const match = FONT_CATALOGUE.find((entry) => getFontName(entry) === name);
  return match ? getFontStack(match) : `'${name}', sans-serif`;
};

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
      toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`}>
      {toast.msg}
    </div>
  );
}

function CompanyDetailsTab({ companyId, company, onToast, onCompanyUpdated }) {
  const [form, setForm] = useState({
    name: company.name || '',
    email: company.email || '',
    phone: company.phone || '',
    address: company.address || '',
    status: company.status || 'active',
    plan: company.plan || 'standard',
    referral_code: company.referral_code || '',
  });
  const [saving, setSaving] = useState(false);
  const [codeStatus, setCodeStatus] = useState('idle');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleCodeChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    setForm((f) => ({ ...f, referral_code: val }));
    setCodeStatus('idle');
  };

  const validateCode = async () => {
    const code = form.referral_code.trim();
    if (code === (company.referral_code || '')) {
      setCodeStatus('idle');
      return;
    }
    if (!CODE_REGEX.test(code)) {
      setCodeStatus('invalid');
      return;
    }
    setCodeStatus('checking');
    try {
      const res = await client.get('/companies/check-code', { params: { code, exclude_id: companyId } });
      setCodeStatus(res.data.available ? 'available' : 'taken');
    } catch {
      setCodeStatus('idle');
    }
  };

  const codeHint = {
    idle: null,
    checking: { text: 'Checking…', cls: 'text-slate-400' },
    available: { text: '✓ Code is available', cls: 'text-emerald-600' },
    taken: { text: '✗ Code is already in use by another company', cls: 'text-rose-600' },
    invalid: { text: '✗ Must be exactly 8 uppercase letters or digits (A–Z, 0–9)', cls: 'text-rose-600' },
  }[codeStatus];

  const canSave = codeStatus !== 'taken' && codeStatus !== 'invalid' && codeStatus !== 'checking';
  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400';

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await client.put(`/companies/${companyId}`, form);
      onToast(`Company details updated for ${form.name}.`, 'success');
      setCodeStatus('idle');
      if (onCompanyUpdated) onCompanyUpdated(res.data?.data || { ...company, ...form });
    } catch (err) {
      onToast(err.response?.data?.message || 'Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-800">Company Information</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Company Name <span className="text-rose-500">*</span><FieldMark required /></label>
          <input type="text" value={form.name} onChange={set('name')} placeholder="Acme Corp" className={inputCls} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Billing Email <span className="text-rose-500">*</span><FieldMark required /></label>
          <input type="email" value={form.email} onChange={set('email')} placeholder="billing@company.com" className={inputCls} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number<FieldMark /></label>
          <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+234 800 000 0000" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Self-Registration Code
            <span className="ml-1.5 text-xs font-normal text-slate-400">(5 alphanumeric chars)</span><FieldMark />
          </label>
          <input
            type="text"
            value={form.referral_code}
            onChange={handleCodeChange}
            onBlur={validateCode}
            placeholder="AB12C"
            maxLength={5}
            className={`${inputCls} font-mono tracking-widest ${
              codeStatus === 'taken' || codeStatus === 'invalid' ? 'border-rose-400 focus:ring-rose-400'
                : codeStatus === 'available' ? 'border-emerald-400 focus:ring-emerald-400' : ''
            }`}
          />
          {codeHint && <p className={`mt-1 text-xs ${codeHint.cls}`}>{codeHint.text}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Address<FieldMark /></label>
          <textarea value={form.address} onChange={set('address')} rows={2} placeholder="123 Main St, Lagos, Nigeria" className={`${inputCls} resize-none`} />
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status<FieldMark /></label>
          <Select value={form.status} onChange={set('status')} className={inputCls}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Plan<FieldMark /></label>
          <Select value={form.plan} onChange={set('plan')} className={inputCls}>
            {PLAN_OPTIONS.map((plan) => (
              <option key={plan.value} value={plan.value}>{plan.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="button" onClick={handleSave} disabled={saving || !canSave}>
          {saving ? 'Saving…' : 'Save Company Details'}
        </Button>
        {!canSave && !saving && <span className="text-xs text-rose-500">Fix the company code before saving</span>}
      </div>
    </div>
  );
}

function AppearanceTab({ companyId, company, onToast }) {
  const [form, setForm] = useState({
    app_name: '',
    primary_color: '#2563eb',
    secondary_color: '#0f172a',
    dark_primary_color: '',
    dark_secondary_color: '',
    font_heading: 'Tomato Grotesk',
    font_body: 'Inter',
    font_ui: 'Inter',
    dark_mode: 'off',
    currency: 'USD',
    template: 'classic',
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    client.get('/settings', { params: { company_id: companyId, group: 'appearance' } })
      .then((res) => {
        if (!mounted) return;
        const d = res.data?.data || {};
        setForm({
          app_name: d.app_name || '',
          primary_color: d.primary_color || '#2563eb',
          secondary_color: d.secondary_color || '#0f172a',
          dark_primary_color: d.dark_primary_color || '',
          dark_secondary_color: d.dark_secondary_color || '',
          font_heading: d.font_heading || 'Tomato Grotesk',
          font_body: d.font_body || 'Inter',
          font_ui: d.font_ui || 'Inter',
          dark_mode: d.dark_mode || 'off',
          currency: d.currency || 'USD',
          template: d.template || 'classic',
        });
        setLogoPreview(d.app_logo || null);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [companyId]);

  const typographyGroups = Array.isArray(FONT_CATEGORIES) && FONT_CATEGORIES.length
    ? FONT_CATEGORIES.map(({ key, label, description }) => ({ key, label, desc: description }))
    : FALLBACK_FONT_GROUPS.map(({ key, label, description }) => ({ key, label, desc: description }));

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        fd.append('company_id', String(companyId));
        await client.post('/settings/upload-logo', fd);
      }

      const settings = [
        { key: 'app_name', value: form.app_name },
        { key: 'primary_color', value: form.primary_color },
        { key: 'secondary_color', value: form.secondary_color },
        { key: 'dark_primary_color', value: form.dark_primary_color },
        { key: 'dark_secondary_color', value: form.dark_secondary_color },
        { key: 'font_heading', value: form.font_heading },
        { key: 'font_body', value: form.font_body },
        { key: 'font_ui', value: form.font_ui },
        { key: 'font_family', value: form.font_body },
        { key: 'dark_mode', value: form.dark_mode },
        { key: 'currency', value: form.currency },
        { key: 'template', value: form.template },
      ].map((setting) => ({ ...setting, company_id: companyId }));

      await client.post('/settings/bulk', { settings, group: 'appearance' });
      setLogoFile(null);
      onToast(`Appearance saved for ${company.name}.`, 'success');
    } catch (err) {
      onToast(err.userMessage || err.response?.data?.message || 'Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Layout Template</h2>
          <p className="mt-0.5 text-sm text-slate-500">Choose the overall look and feel of the application.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TEMPLATE_OPTIONS.map((t) => (
            <Button
              key={t.id}
              type="button"
              onClick={() => setForm((f) => ({ ...f, template: t.id }))}
              variant={form.template === t.id ? 'primary' : 'secondary'}
              size="sm"
              className="group relative h-auto flex-col items-stretch overflow-hidden p-0"
            >
              <div className="h-28 w-full bg-slate-100 overflow-hidden">
                <t.Preview />
              </div>
              <div className={`px-3 py-2 text-left ${form.template === t.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}>
                <div className="text-xs font-semibold">{t.label}</div>
                <div className={`mt-0.5 text-[10px] ${form.template === t.id ? 'text-blue-100' : 'text-slate-400'}`}>{t.description}</div>
              </div>
              {form.template === t.id && (
                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow">
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">App Name<FieldMark /></label>
          <Input value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })} placeholder={company.name} className="max-w-xs" />
          <p className="mt-1 text-xs text-slate-500">Shown in the sidebar and browser tab.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">App Logo<FieldMark /></label>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
              {logoPreview
                ? <img src={logoPreview} alt="logo" className="h-full w-full object-contain p-1" />
                : <span className="text-2xl text-slate-400">🖼</span>
              }
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                {logoPreview ? 'Change logo' : 'Upload logo'}
              </Button>
              <p className="mt-1 text-xs text-slate-500">PNG or SVG recommended.</p>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Primary Color<FieldMark /></label>
          <div className="flex flex-wrap items-center gap-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => setForm({ ...form, primary_color: c.value })}
                className="h-9 w-9 rounded-full border-4 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c.value,
                  borderColor: form.primary_color === c.value ? '#0f172a' : 'transparent',
                  boxShadow: form.primary_color === c.value ? '0 0 0 2px #fff, 0 0 0 4px #0f172a' : 'none',
                }}
              />
            ))}
            <div className="ml-2 flex items-center gap-2">
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="h-9 w-9 cursor-pointer rounded-lg border border-slate-300"
                title="Custom color"
              />
              <span className="font-mono text-sm text-slate-500">{form.primary_color}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Affects buttons, active links, and highlights.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Secondary Color<FieldMark /></label>
          <div className="flex flex-wrap items-center gap-3">
            {SECONDARY_PRESETS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => setForm({ ...form, secondary_color: c.value })}
                className="h-9 w-9 rounded-full border-4 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c.value,
                  borderColor: form.secondary_color === c.value ? '#2563eb' : 'transparent',
                  boxShadow: form.secondary_color === c.value ? '0 0 0 2px #fff, 0 0 0 4px #2563eb' : 'none',
                }}
              />
            ))}
            <div className="ml-2 flex items-center gap-2">
              <input
                type="color"
                value={form.secondary_color}
                onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                className="h-9 w-9 cursor-pointer rounded-lg border border-slate-300"
                title="Custom secondary color"
              />
              <span className="font-mono text-sm text-slate-500">{form.secondary_color}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Affects the sidebar background, brand band, and dark accent elements.</p>
        </div>

        <div className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Typography</h2>

          {typographyGroups.map(({ key, label, desc }) => (
            <div key={key}>
              <div className="mb-2">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <span className="ml-2 text-xs text-slate-400">{desc}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {FONT_CATALOGUE.map((entry) => {
                  const name = getFontName(entry);
                  const stack = getFontStack(entry);
                  const tag = getFontTag(entry);
                  const active = form[key] === name;
                  return (
                    <Button
                      key={name}
                      type="button"
                      onClick={() => setForm({ ...form, [key]: name })}
                      variant={active ? 'primary' : 'secondary'}
                      size="sm"
                      className="h-auto flex-col items-start px-4 py-2.5 text-left"
                      style={{ fontFamily: stack }}
                    >
                      <span className="text-sm font-semibold leading-none">{name}</span>
                      {tag && <span className="mt-1 text-[10px] font-normal opacity-60" style={{ fontFamily: 'Inter, sans-serif' }}>{tag}</span>}
                    </Button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400 italic" style={{ fontFamily: getSavedFontStack(form[key]) }}>
                The quick brown fox jumps over the lazy dog — {form[key]}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium">Dark Mode</p>
            <p className="mt-0.5 text-xs text-slate-500">Toggle dark/light theme across the app.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const turningOn = form.dark_mode !== 'on';
              const update = { dark_mode: turningOn ? 'on' : 'off' };
              if (turningOn) {
                if (!form.dark_primary_color) {
                  update.dark_primary_color = brightenForDark(form.primary_color);
                }
                if (!form.dark_secondary_color) {
                  update.dark_secondary_color = brightenForDark(form.secondary_color);
                }
              }
              setForm((f) => ({ ...f, ...update }));
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.dark_mode === 'on' ? 'bg-blue-600' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.dark_mode === 'on' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {form.dark_mode === 'on' && (
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-5 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Dark Mode Colors</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  These brighter colors replace your light-mode palette when dark mode is active.
                  Auto-generated from your primary/secondary colors — customize freely.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({
                  ...f,
                  dark_primary_color: brightenForDark(f.primary_color),
                  dark_secondary_color: brightenForDark(f.secondary_color),
                }))}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                ↺ Reset to auto
              </button>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Dark Mode Primary<FieldMark /></label>
              <div className="flex flex-wrap items-center gap-3">
                {DARK_PRIMARY_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setForm((f) => ({ ...f, dark_primary_color: c.value }))}
                    className="h-9 w-9 rounded-full border-4 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c.value,
                      borderColor: form.dark_primary_color === c.value ? '#0f172a' : 'transparent',
                      boxShadow: form.dark_primary_color === c.value ? '0 0 0 2px #fff, 0 0 0 4px #0f172a' : 'none',
                    }}
                  />
                ))}
                <div className="ml-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={form.dark_primary_color || '#60a5fa'}
                    onChange={(e) => setForm((f) => ({ ...f, dark_primary_color: e.target.value }))}
                    className="h-9 w-9 cursor-pointer rounded-lg border border-slate-300"
                    title="Custom dark primary"
                  />
                  <span className="font-mono text-sm text-slate-500">{form.dark_primary_color || '—'}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Dark Mode Secondary<FieldMark /></label>
              <div className="flex flex-wrap items-center gap-3">
                {DARK_SECONDARY_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setForm((f) => ({ ...f, dark_secondary_color: c.value }))}
                    className="h-9 w-9 rounded-full border-4 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c.value,
                      borderColor: form.dark_secondary_color === c.value ? '#0f172a' : 'transparent',
                      boxShadow: form.dark_secondary_color === c.value ? '0 0 0 2px #fff, 0 0 0 4px #0f172a' : 'none',
                    }}
                  />
                ))}
                <div className="ml-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={form.dark_secondary_color || '#94a3b8'}
                    onChange={(e) => setForm((f) => ({ ...f, dark_secondary_color: e.target.value }))}
                    className="h-9 w-9 cursor-pointer rounded-lg border border-slate-300"
                    title="Custom dark secondary"
                  />
                  <span className="font-mono text-sm text-slate-500">{form.dark_secondary_color || '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex overflow-hidden rounded-lg text-sm font-medium text-white">
              <div className="flex-1 p-3 text-center text-xs" style={{ backgroundColor: form.dark_primary_color || brightenForDark(form.primary_color) }}>
                Dark Primary
              </div>
              <div className="flex-1 p-3 text-center text-xs" style={{ backgroundColor: form.dark_secondary_color || brightenForDark(form.secondary_color), color: '#0f172a' }}>
                Dark Secondary
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium">Currency<FieldMark /></label>
          <Select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {CURRENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-500">Used to format all monetary values across the app.</p>
        </div>

        <div className="flex overflow-hidden rounded-lg text-sm font-medium text-white">
          <div className="flex-1 p-4" style={{ backgroundColor: form.primary_color }}>
            Primary — {form.primary_color}
          </div>
          <div className="flex-1 p-4" style={{ backgroundColor: form.secondary_color }}>
            Secondary — {form.secondary_color}
          </div>
        </div>
        {form.dark_mode === 'on' && (
          <p className="text-xs text-slate-500">
            🌙 Active palette in dark mode: <span className="font-mono">{form.dark_primary_color || brightenForDark(form.primary_color)}</span> / <span className="font-mono">{form.dark_secondary_color || brightenForDark(form.secondary_color)}</span>
          </p>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save & Apply'}
        </Button>
      </div>
    </div>
  );
}

function FieldTab({ tabKey, companyId, onToast }) {
  const fields = FIELD_GROUPS[tabKey] || [];
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    client.get('/settings', { params: { effective: true, company_id: companyId, group: tabKey } })
      .then((res) => {
        if (mounted) setValues(res.data?.data || {});
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tabKey, companyId]);

  const handleChange = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = fields.map(({ key }) => ({
        key,
        value: values[key] || '',
        company_id: companyId,
      }));
      await client.post('/settings/bulk', { settings, group: tabKey });
      onToast('Settings saved successfully.', 'success');
    } catch (err) {
      onToast(err.userMessage || err.response?.data?.message || 'Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-3">{fields.map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>;
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {fields.map(({ key, label, type, placeholder, options }) => (
        <div key={key}>
          <label className="mb-1 block text-sm font-medium">{label}<FieldMark /></label>
          {type === 'select' ? (
            <Select
              value={values[key] || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Not set</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          ) : (
            <Input type={type || 'text'} placeholder={placeholder} value={values[key] || ''} onChange={(e) => handleChange(key, e.target.value)} />
          )}
        </div>
      ))}
      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
    </div>
  );
}

export default function CompanySettingsPage() {
  const { id } = useParams();
  const companyId = Number(id);
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    client.get('/companies')
      .then((res) => {
        const rows = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data) ? res.data : [];
        const found = rows.find((row) => Number(row.id) === companyId);
        setCompany(found || null);
      })
      .catch(() => {})
      .finally(() => setLoadingCompany(false));
  }, [companyId]);

  if (loadingCompany) {
    return (
      <div className="space-y-4 p-6">
        {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-slate-500">Company not found.</p>
        <Button onClick={() => navigate('/superior/companies')} variant="primary" size="sm" className="mt-4">
          Back to Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Toast toast={toast} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button onClick={() => navigate('/superior/companies')} variant="secondary" size="sm" className="mb-3 justify-start">
            ← Back to Companies
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Settings configured here override platform-wide defaults for this company only.
          </p>
        </div>

        <div className={`self-start rounded-xl px-4 py-2 text-sm font-semibold ${
          company.status === 'active' ? 'bg-green-100 text-green-700'
            : company.status === 'suspended' ? 'bg-red-100 text-red-700'
              : 'bg-slate-100 text-slate-600'
        }`}>
          {company.status?.charAt(0).toUpperCase()}{company.status?.slice(1)}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 ring-1 ring-blue-200">
        <span className="text-lg leading-none">🌐</span>
        <div>
          <span className="font-semibold">Platform Admin — Company Override.</span>{' '}
          Changes here only affect <strong>{company.name}</strong>. Platform-wide defaults remain unchanged.
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-slate-200 -mx-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'details' ? (
          <CompanyDetailsTab
            key={`${companyId}-details`}
            companyId={companyId}
            company={company}
            onToast={showToast}
            onCompanyUpdated={(updated) => setCompany((current) => ({ ...current, ...updated }))}
          />
        ) : activeTab === 'appearance' ? (
          <AppearanceTab key={`${companyId}-appearance`} companyId={companyId} company={company} onToast={showToast} />
        ) : (
          <FieldTab key={`${companyId}-${activeTab}`} tabKey={activeTab} companyId={companyId} onToast={showToast} />
        )}
      </div>
    </div>
  );
}

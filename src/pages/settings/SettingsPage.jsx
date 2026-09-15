import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getSettings, bulkUpdateSettings, uploadLogo, getSystemConfig, saveSystemConfig,
} from '../../api/userApi';
import { listCompanies } from '../../api/companyApi';
import { stripeCreateIntent, flutterwaveVerify, paystackVerify } from '../../api/financeApi';
import { disable2FA, get2FAPolicy, me, set2FAPolicy, setup2FA, verifySetup2FA } from '../../api/authApi';
import { useAppearance } from '../../context/useAppearance';
import { FONT_CATALOGUE, FONT_CATEGORIES } from '../../config/fonts';
import useAuthStore from '../../store/authStore';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { brightenForDark } from '../../utils/colorUtils';
import { CURRENCIES, currencyOptionLabel } from '../../constants/currencies';
import Select from '../../components/ui/Select';

/**
 * Which company the settings on screen belong to.
 *
 * ── Why a context and not a prop ────────────────────────────────────────────
 *
 * Every tab reads and writes settings, and a platform admin editing on a
 * tenant's behalf has to have that target reach all of them — including the
 * ones nested several components deep. Threading it as a prop would mean
 * touching every tab signature, and the failure mode of missing one is the
 * worst available here: a save that silently lands on the platform defaults and
 * changes the configuration for every company at once.
 *
 * `null` is the platform-wide defaults, which is what a platform admin sees
 * until they pick a company, and what the server assumes when the parameter is
 * absent. A company admin is pinned to their own company by the server
 * regardless of this value.
 */
/** Every system-config field, empty — the shape a fresh target resets to. */
const BLANK_SYSTEM_CONFIG = {
  google_client_id: '',
  google_client_secret: '',
  google_callback_url: '',
  jwt_secret: '',
  jwt_access_expires: '',
  jwt_refresh_days: '',
  cloudinary_cloud_name: '',
  cloudinary_api_key: '',
  cloudinary_api_secret: '',
};

const SettingsTargetContext = createContext({ companyId: null, companyName: null });
const useSettingsTarget = () => useContext(SettingsTargetContext);

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

// Bright, vibrant presets designed for dark backgrounds
const DARK_PRIMARY_PRESETS = [
  { label: 'Sky Blue',    value: '#60a5fa' },
  { label: 'Violet',      value: '#a78bfa' },
  { label: 'Emerald',     value: '#34d399' },
  { label: 'Amber',       value: '#fbbf24' },
  { label: 'Rose',        value: '#fb7185' },
  { label: 'Teal',        value: '#2dd4bf' },
  { label: 'Orange',      value: '#fb923c' },
];

const DARK_SECONDARY_PRESETS = [
  { label: 'Slate Blue',  value: '#94a3b8' },
  { label: 'Indigo',      value: '#818cf8' },
  { label: 'Steel Blue',  value: '#7dd3fc' },
  { label: 'Mint',        value: '#6ee7b7' },
  { label: 'Lavender',    value: '#c4b5fd' },
  { label: 'Silver',      value: '#9ca3af' },
  { label: 'Peach',       value: '#fdba74' },
];

const FONT_OPTIONS = ['Tomato Grotesk', 'Inter', 'Poppins', 'Roboto', 'Lato', 'Nunito', 'System Sans'];

const SETTING_GROUPS = [
  {
    group: 'appearance',
    label: 'Appearance',
  },
  {
    group: 'general',
    label: 'General',
    fields: [
      { key: 'site_name', label: 'Site name', type: 'text' },
      { key: 'site_email', label: 'Site email', type: 'email' },
      { key: 'site_phone', label: 'Site phone', type: 'text' },
      // Code only. The symbol is derived from it, so there is nothing to type
      // and no way for the two to disagree.
      { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES.map((c) => ({ value: c.code, label: currencyOptionLabel(c) })) },
    ],
  },
  {
    group: 'email',
    label: 'Email',
    fields: [
      { key: 'mail_driver', label: 'Mail driver', type: 'text', placeholder: 'smtp' },
      { key: 'mail_host', label: 'SMTP host', type: 'text' },
      { key: 'mail_port', label: 'SMTP port', type: 'text', placeholder: '587' },
      { key: 'mail_username', label: 'SMTP username', type: 'text' },
      { key: 'mail_password', label: 'SMTP password', type: 'password' },
      { key: 'mail_from_name', label: 'From name', type: 'text' },
      { key: 'mail_from_address', label: 'From email', type: 'email' },
    ],
  },
  {
    group: 'payment',
    label: 'Payment Gateways',
    fields: [
      /**
       * Off unless switched on, and blank means off.
       *
       * With it on, an admin cannot approve a payment without attaching the
       * company's own receipt — enforced on the server, not only by the button
       * on the approvals screen. It applies from the moment it is switched on;
       * payments already approved are not reopened.
       */
      {
        key: 'require_company_receipt',
        label: 'Require a company receipt when approving a payment',
        type: 'select',
        options: [{ value: 'off', label: 'Optional' }, { value: 'on', label: 'Required' }],
      },
      { key: 'paystack_public_key', label: 'Paystack public key', type: 'text' },
      { key: 'paystack_secret_key', label: 'Paystack secret key', type: 'password' },
      { key: 'flutterwave_public_key', label: 'Flutterwave public key', type: 'text' },
      { key: 'flutterwave_secret_key', label: 'Flutterwave secret key', type: 'password' },
      { key: 'stripe_public_key', label: 'Stripe public key', type: 'text' },
      { key: 'stripe_secret_key', label: 'Stripe secret key', type: 'password' },
    ],
  },
  {
    group: 'assistant',
    label: 'AI Assistant',
    // Answers are composed on your own servers from your own data, so there is
    // no key to supply and nothing leaves your infrastructure.
    fields: [
      { key: 'assistant_enabled', label: 'Enabled', type: 'select', options: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] },
      { key: 'assistant_name', label: 'Assistant name', type: 'text', placeholder: 'Janet' },
    ],
  },
  {
    group: 'invoicing',
    label: 'Invoicing',
    // Payment terms for purchase invoices. Blank means inherit: a company that
    // sets nothing keeps the platform value, and failing that the built-in
    // 30/14 that these numbers replaced.
    fields: [
      { key: 'invoice_due_days_installment', label: 'Installment — days until due', type: 'number', placeholder: '30' },
      { key: 'invoice_due_days_outright', label: 'Outright — days until due', type: 'number', placeholder: '14' },
    ],
  },
  {
    group: 'inventory',
    label: 'Inventory & Holds',
    /**
     * When a payment takes property units off the market.
     *
     * Creating an invoice never reduces availability — a buyer who has not paid
     * has secured nothing. These settings decide how much of an approved
     * payment it takes before the invoiced units are actually held.
     *
     * Blank means inherit: a company that sets nothing gets the platform value,
     * and failing that the built-in default of holding on any payment.
     */
    fields: [
      {
        key: 'inventory_hold_policy',
        label: 'Hold units when',
        type: 'select',
        options: [
          { value: 'any_payment', label: 'Any approved payment (default)' },
          { value: 'threshold_amount', label: 'Payments reach a fixed amount' },
          { value: 'threshold_percentage', label: 'Payments reach a percentage of the invoice' },
        ],
      },
      {
        key: 'inventory_hold_threshold_amount',
        label: 'Threshold amount — for the fixed-amount policy',
        type: 'number',
        placeholder: '500000',
      },
      {
        key: 'inventory_hold_threshold_percentage',
        label: 'Threshold percentage — for the percentage policy',
        type: 'number',
        placeholder: '20',
      },
      {
        // Off by default: expiring invoices on a company that never asked for
        // it would cancel live purchases.
        key: 'invoice_expiry_days',
        label: 'Expire unpaid invoices after (days) — blank to never expire',
        type: 'number',
        placeholder: 'never',
      },
    ],
  },
  {
    group: 'security',
    label: 'Security',
  },
  {
    group: 'system_config',
    label: 'System Config',
  },
];

// ── Template preview components (tiny SVG mockups) ───────────────────────────

function PreviewClassic() {
  return (
    <svg viewBox="0 0 200 112" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      {/* Dark sidebar */}
      <rect width="48" height="112" fill="#0f172a" />
      {/* Logo area */}
      <rect x="8" y="8" width="32" height="8" rx="2" fill="#3b82f6" />
      {/* Nav items */}
      {[26, 38, 50, 62, 74, 86].map((y, i) => (
        <rect key={i} x="8" y={y} width={i === 0 ? 32 : 28} height="6" rx="2"
          fill={i === 0 ? '#2563eb' : '#334155'} />
      ))}
      {/* Top header */}
      <rect x="48" y="0" width="152" height="20" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <rect x="56" y="6" width="60" height="5" rx="2" fill="#94a3b8" />
      <rect x="176" y="5" width="16" height="10" rx="4" fill="#0f172a" />
      {/* Content area */}
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
      {/* Top nav bar */}
      <rect width="200" height="22" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      {/* Logo */}
      <rect x="8" y="7" width="20" height="8" rx="2" fill="#3b82f6" />
      {/* Nav items */}
      <rect x="36" y="8" width="20" height="6" rx="2" fill="#94a3b8" />
      <rect x="62" y="8" width="24" height="6" rx="2" fill="#94a3b8" />
      <rect x="92" y="8" width="18" height="6" rx="2" fill="#94a3b8" />
      <rect x="116" y="8" width="22" height="6" rx="2" fill="#94a3b8" />
      {/* User avatar right */}
      <circle cx="188" cy="11" r="7" fill="#2563eb" />
      {/* Content area */}
      <rect y="22" width="200" height="90" fill="#f8fafc" />
      {/* Cards row */}
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
      {/* Thin icon sidebar */}
      <rect width="18" height="112" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      {/* Icons */}
      {[8, 22, 36, 50, 64, 78, 92].map((y, i) => (
        <rect key={i} x="4" y={y} width="10" height="10" rx="3"
          fill={i === 0 ? '#2563eb' : '#cbd5e1'} />
      ))}
      {/* Top header bar */}
      <rect x="18" y="0" width="182" height="18" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <circle cx="190" cy="9" r="6" fill="#2563eb" />
      {/* Content */}
      <rect x="18" y="18" width="182" height="94" fill="#f8fafc" />
      {/* Cards */}
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
      {/* Light sidebar */}
      <rect width="52" height="112" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" />
      {/* Brand top band */}
      <rect width="52" height="22" fill="#2563eb" />
      <rect x="6" y="7" width="20" height="8" rx="2" fill="rgba(255,255,255,0.9)" />
      {/* Nav items with left accent */}
      <rect x="0" y="30" width="3" height="10" fill="#2563eb" />
      <rect x="6" y="32" width="36" height="6" rx="2" fill="#dbeafe" />
      {[46, 58, 70, 82, 94].map((y) => (
        <rect key={y} x="6" y={y + 2} width="32" height="5" rx="2" fill="#cbd5e1" />
      ))}
      {/* User profile at bottom */}
      <rect x="4" y="98" width="44" height="10" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <circle cx="12" cy="103" r="4" fill="#2563eb" />
      {/* Content header */}
      <rect x="52" y="0" width="148" height="18" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <rect x="60" y="6" width="50" height="6" rx="2" fill="#94a3b8" />
      {/* Content */}
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
      {/* White sidebar */}
      <rect width="56" height="112" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      {/* Logo area */}
      <rect x="6" y="6" width="24" height="8" rx="2" fill="#3b82f6" />
      {/* Dashboard item (active, filled) */}
      <rect x="4" y="20" width="48" height="8" rx="3" fill="#2563eb" />
      <rect x="9" y="23" width="22" height="2.5" rx="1" fill="rgba(255,255,255,0.85)" />
      {/* Divider */}
      <line x1="6" y1="32" x2="50" y2="32" stroke="#e2e8f0" strokeWidth="1" />
      {/* Section label "PROPERTY" */}
      <rect x="6" y="35" width="30" height="3" rx="1" fill="#cbd5e1" />
      {/* Indented items under Property */}
      <line x1="10" y1="42" x2="10" y2="62" stroke="#e2e8f0" strokeWidth="1" />
      {[42, 50, 58].map((y) => (
        <rect key={y} x="13" y={y + 1} width="32" height="4" rx="1.5" fill="#f1f5f9" />
      ))}
      {/* Section label "CRM" collapsed */}
      <rect x="6" y="68" width="20" height="3" rx="1" fill="#cbd5e1" />
      {/* Chevron right (collapsed) */}
      <path d="M48 68 L52 70 L48 72" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />
      {/* Section label "FINANCE" collapsed */}
      <rect x="6" y="76" width="26" height="3" rx="1" fill="#e2e8f0" />
      {/* User card at bottom */}
      <rect x="4" y="98" width="48" height="10" rx="3" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      <circle cx="11" cy="103" r="3.5" fill="#2563eb" />
      <rect x="17" y="101" width="22" height="2.5" rx="1" fill="#cbd5e1" />
      <rect x="17" y="105" width="14" height="2" rx="1" fill="#e2e8f0" />
      {/* Content area */}
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

function PreviewLauncher() {
  return (
    <svg viewBox="0 0 200 112" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      {/* Page */}
      <rect width="200" height="112" fill="#f8fafc" />
      {/* Utility bar — the only chrome this template has */}
      <rect width="200" height="16" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      {/* The launcher button, in the corner it actually occupies */}
      <rect x="5" y="5" width="7" height="7" rx="1.5" fill="#2563eb" />
      <rect x="16" y="6" width="18" height="4" rx="1.5" fill="#cbd5e1" />
      <circle cx="190" cy="8" r="4" fill="#e2e8f0" />
      <rect x="170" y="6" width="12" height="4" rx="2" fill="#e2e8f0" />
      {/* The launcher itself, open over the page */}
      <rect x="28" y="24" width="144" height="80" rx="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <rect x="34" y="30" width="100" height="7" rx="3" fill="#f1f5f9" />
      {[0, 1, 2, 3].map((col) => [0, 1].map((row) => (
        <g key={`${col}-${row}`}>
          <rect
            x={34 + col * 34} y={44 + row * 28} width="30" height="24" rx="3"
            fill="#ffffff" stroke="#e2e8f0" strokeWidth="1"
          />
          <rect x={45 + col * 34} y={50 + row * 28} width="8" height="8" rx="2" fill="#94a3b8" />
          <rect x={42 + col * 34} y={61 + row * 28} width="14" height="3" rx="1.5" fill="#e2e8f0" />
        </g>
      )))}
    </svg>
  );
}

const TEMPLATE_OPTIONS = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Dark sidebar + top header',
    Preview: PreviewClassic,
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Full-width top navigation',
    Preview: PreviewModern,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Icon-only collapsible sidebar',
    Preview: PreviewMinimal,
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'Light sidebar with brand accent',
    Preview: PreviewBold,
  },
  {
    id: 'grouped',
    label: 'Grouped',
    description: 'Collapsible grouped left sidebar',
    Preview: PreviewGrouped,
  },
  {
    id: 'launcher',
    label: 'Launcher',
    description: 'No sidebar — a module grid opened from the top bar',
    Preview: PreviewLauncher,
  },
];

function AppearanceTab() {
  const { app_name, app_logo, primary_color, secondary_color, dark_primary_color, dark_secondary_color, font_heading, font_body, font_ui, dark_mode, currency, template, refresh } = useAppearance();
  const [form, setForm] = useState({
    app_name: app_name || '',
    primary_color: primary_color || '#2563eb',
    secondary_color: secondary_color || '#0f172a',
    dark_primary_color: dark_primary_color || '',
    dark_secondary_color: dark_secondary_color || '',
    font_heading: font_heading || 'Tomato Grotesk',
    font_body: font_body || 'Inter',
    font_ui: font_ui || 'Inter',
    dark_mode: dark_mode || 'off',
    currency: currency || 'USD',
    template: template || 'classic',
  });
  const [logoPreview, setLogoPreview] = useState(app_logo || null);
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const fileRef = useRef();
  const { companyId, companyName } = useSettingsTarget();

  /*
   * The form follows the signed-in person's own appearance — which is right up
   * until a platform admin picks a company to configure. From then on it has to
   * show THAT company's branding, not the platform admin's own, or they would
   * be shown one company's colours and save them onto another's.
   */
  useEffect(() => {
    if (companyId) return;
    setForm({
      app_name: app_name || '',
      primary_color: primary_color || '#2563eb',
      secondary_color: secondary_color || '#0f172a',
      dark_primary_color: dark_primary_color || '',
      dark_secondary_color: dark_secondary_color || '',
      font_heading: font_heading || 'Tomato Grotesk',
      font_body: font_body || 'Inter',
      font_ui: font_ui || 'Inter',
      dark_mode: dark_mode || 'off',
      currency: currency || 'USD',
      template: template || 'classic',
    });
    setLogoPreview(app_logo || null);
  }, [companyId, app_name, app_logo, primary_color, secondary_color, dark_primary_color, dark_secondary_color, font_heading, font_body, font_ui, dark_mode, currency, template]);

  /** A chosen company's own appearance, read fresh. */
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoadingTarget(true);
    getSettings('appearance', { effective: true, companyId })
      .then((response) => {
        if (cancelled) return;
        const data = response?.data || {};
        setForm({
          app_name: data.app_name || '',
          primary_color: data.primary_color || '#2563eb',
          secondary_color: data.secondary_color || '#0f172a',
          dark_primary_color: data.dark_primary_color || '',
          dark_secondary_color: data.dark_secondary_color || '',
          font_heading: data.font_heading || 'Tomato Grotesk',
          font_body: data.font_body || 'Inter',
          font_ui: data.font_ui || 'Inter',
          dark_mode: data.dark_mode || 'off',
          currency: data.currency || 'USD',
          template: data.template || 'classic',
        });
        setLogoPreview(data.app_logo || null);
        setLogoFile(null);
      })
      .catch(() => { if (!cancelled) setMessage({ type: 'error', text: 'Could not load that company’s appearance.' }); })
      .finally(() => { if (!cancelled) setLoadingTarget(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (logoFile) await uploadLogo(logoFile, companyId);

      const settings = [
        { key: 'app_name', value: form.app_name },
        { key: 'primary_color', value: form.primary_color },
        { key: 'secondary_color', value: form.secondary_color },
        { key: 'dark_primary_color', value: form.dark_primary_color },
        { key: 'dark_secondary_color', value: form.dark_secondary_color },
        { key: 'font_heading', value: form.font_heading },
        { key: 'font_body', value: form.font_body },
        { key: 'font_ui', value: form.font_ui },
        // keep legacy key in sync so old consumers still work
        { key: 'font_family', value: form.font_body },
        { key: 'dark_mode', value: form.dark_mode },
        { key: 'currency', value: form.currency },
        { key: 'template', value: form.template },
      ];
      await bulkUpdateSettings(settings, 'appearance', companyId);

      /*
       * Only reload the live theme when the settings that were saved are the
       * ones this browser is painted with.
       *
       * `refresh()` re-reads the SIGNED-IN person's appearance and applies it.
       * After editing another company that would do two wrong things at once:
       * repaint nothing (their own theme has not changed) while resetting the
       * form back to the platform admin's own colours — making a successful
       * save look as though it had been discarded.
       */
      if (!companyId) await refresh();

      setLogoFile(null);
      setMessage({
        type: 'success',
        text: companyId
          ? `Appearance saved for ${companyName || 'that company'}. Your own theme is unchanged.`
          : 'Appearance saved and applied.',
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.userMessage });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Appearance</h1>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {/* ── Template Picker ─────────────────────────────────────────────── */}
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
              {/* SVG Preview */}
              <div className="h-28 w-full bg-slate-100 overflow-hidden">
                <t.Preview />
              </div>
              {/* Label */}
              <div className={`px-3 py-2 text-left ${form.template === t.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}>
                <div className="text-xs font-semibold">{t.label}</div>
                <div className={`text-[10px] mt-0.5 ${form.template === t.id ? 'text-blue-100' : 'text-slate-400'}`}>{t.description}</div>
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

      {/* ── Branding & Style ─────────────────────────────────────────────── */}
      <div className="space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">App Name</label>
          <Input value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })} placeholder="Realx8" className="max-w-xs" />
          <p className="mt-1 text-xs text-slate-500">Shown in the sidebar and browser tab.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">App Logo</label>
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
          <label className="mb-2 block text-sm font-medium">Primary Color</label>
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
          <label className="mb-2 block text-sm font-medium">Secondary Color</label>
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

          {[
            { key: 'font_heading', label: 'Headings', desc: 'h1 – h4 titles and section headers' },
            { key: 'font_body',    label: 'Body Text', desc: 'Paragraphs, lists, table cells' },
            { key: 'font_ui',      label: 'UI & Interface', desc: 'Buttons, inputs, labels, navigation' },
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
              {/* Live preview */}
              <p
                className="mt-2 text-xs text-slate-400 italic"
                style={{ fontFamily: FONT_CATALOGUE.find(e => e.name === form[key])?.stack || `'${form[key]}', sans-serif` }}
              >
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
              // Auto-generate bright dark-mode colors when enabling if not already set
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

        {/* Dark Mode Color Customisation — only shown when dark mode is on */}
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

            {/* Dark Primary */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Dark Mode Primary</label>
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

            {/* Dark Secondary */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Dark Mode Secondary</label>
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

            {/* Dark color preview swatch */}
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
          <label className="mb-2 block text-sm font-medium">Currency</label>
          <Select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{currencyOptionLabel(c)}</option>
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
function SecurityTab() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const setSession = useAuthStore((state) => state.setSession);
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!accessToken) return;
    me()
      .then((response) => setSession({ user: response.user, accessToken, refreshToken }))
      .catch(() => null);
  }, [accessToken, refreshToken, setSession]);

  const handleSetup = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await setup2FA();
      setSetupData(response);
      setVerifyCode('');
      setMessage({ type: 'success', text: 'Scan the QR code, then verify with a 6-digit code.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to start 2FA setup.' });
    } finally {
      setBusy(false);
    }
  };

  const handleVerifySetup = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await verifySetup2FA(verifyCode);
      setSession({ user: response.user, accessToken, refreshToken });
      setSetupData(null);
      setVerifyCode('');
      setMessage({ type: 'success', text: response.message || 'Two-factor authentication enabled.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to enable 2FA.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await disable2FA(disableCode);
      setSession({ user: response.user, accessToken, refreshToken });
      setDisableCode('');
      setSetupData(null);
      setMessage({ type: 'success', text: response.message || 'Two-factor authentication disabled.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to disable 2FA.' });
    } finally {
      setBusy(false);
    }
  };

  const isEnabled = Boolean(user?.two_factor_enabled);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Security</h1>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Two-factor authentication</p>
            <p className="mt-1 text-sm text-slate-500">
              Status: <span className={isEnabled ? 'font-semibold text-green-600' : 'font-semibold text-slate-700'}>{isEnabled ? 'Enabled' : 'Disabled'}</span>
            </p>
          </div>
          {!isEnabled && (
            <Button onClick={handleSetup} disabled={busy}>{busy ? 'Preparing…' : 'Enable 2FA'}</Button>
          )}
        </div>

        {!isEnabled && setupData && (
          <div className="space-y-4 rounded-lg border border-slate-200 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">1. Scan the QR code</p>
              <p className="mt-1 text-xs text-slate-500">Use Google Authenticator, 1Password, Authy, or any authenticator app.</p>
            </div>
            <img src={setupData.qrCodeUrl} alt="2FA QR code" className="h-48 w-48 rounded-lg border border-slate-200 bg-white p-2" />
            <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
              Manual setup key: <span className="break-all font-mono">{setupData.secret}</span>
            </div>
            <form onSubmit={handleVerifySetup} className="space-y-3">
              <Input
                label="2. Enter verification code"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
              <Button type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify & Enable'}</Button>
            </form>
          </div>
        )}

        {isEnabled && (
          <form onSubmit={handleDisable} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Disable two-factor authentication</p>
              <p className="mt-1 text-xs text-slate-500">Enter a current 6-digit code from your authenticator app to confirm.</p>
            </div>
            <Input
              label="Verification code"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
            <Button type="submit" variant="danger" disabled={busy}>{busy ? 'Disabling…' : 'Disable 2FA'}</Button>
          </form>
        )}
      </div>

      {/* ── Admin 2FA Policy (visible to super_admin and superior_admin only) ── */}
      {(user?.type === 'super_admin' || user?.type === 'superior_admin') && (
        <TwoFAPolicyPanel userType={user.type} />
      )}
    </div>
  );
}

function TwoFAPolicyPanel({ userType }) {
  const [policy, setPolicy] = useState(null); // { global_required, company_overrides }
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    get2FAPolicy()
      .then(setPolicy)
      .catch(() => setPolicy({ global_required: false, company_overrides: [] }));
  }, []);

  const toggle = async (required, companyId) => {
    setBusy(true);
    setMessage(null);
    try {
      await set2FAPolicy(required, companyId);
      const updated = await get2FAPolicy();
      setPolicy(updated);
      setMessage({ type: 'success', text: `2FA requirement ${required ? 'enabled' : 'disabled'}.` });
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to update 2FA policy.' });
    } finally {
      setBusy(false);
    }
  };

  const isSuperior = userType === 'superior_admin';
  const globalRequired = policy?.global_required ?? false;

  return (
    <div className="space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div>
        <p className="text-base font-semibold text-slate-900">2FA Enforcement Policy</p>
        <p className="mt-1 text-sm text-slate-500">
          {isSuperior
            ? 'As a platform administrator, you can require all users to use two-factor authentication.'
            : 'Manage two-factor authentication requirements for users in your company. You can override the platform setting.'}
        </p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {!policy ? (
        <p className="text-sm text-slate-400">Loading policy…</p>
      ) : (
        <div className="space-y-3">
          {isSuperior && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">Require 2FA for all platform users</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Status: <span className={globalRequired ? 'font-semibold text-green-600' : 'font-semibold text-slate-500'}>{globalRequired ? 'Required' : 'Not required'}</span>
                </p>
              </div>
              <Button onClick={() => toggle(!globalRequired, null)} disabled={busy} variant={globalRequired ? 'danger' : 'default'}>
                {globalRequired ? 'Disable globally' : 'Enable globally'}
              </Button>
            </div>
          )}

          {/* Company super admin: show their company override */}
          {!isSuperior && (
            (() => {
              const companyOverride = policy.company_overrides?.[0];
              const companyRequired = companyOverride?.required ?? null; // null = inherits global
              const effectivelyRequired = companyRequired !== null ? companyRequired : globalRequired;
              return (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Require 2FA for your company</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {globalRequired && companyRequired !== false
                        ? 'Platform requires 2FA for all users. You can override to exempt your company.'
                        : `Status: `}
                      {!(globalRequired && companyRequired !== false) && (
                        <span className={effectivelyRequired ? 'font-semibold text-green-600' : 'font-semibold text-slate-500'}>
                          {effectivelyRequired ? 'Required' : 'Not required'}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {globalRequired && companyRequired !== false ? (
                      <Button onClick={() => toggle(false, undefined)} disabled={busy} variant="danger">
                        Exempt my company
                      </Button>
                    ) : (
                      <Button onClick={() => toggle(!effectivelyRequired, undefined)} disabled={busy} variant={effectivelyRequired ? 'danger' : 'default'}>
                        {effectivelyRequired ? 'Disable for company' : 'Enable for company'}
                      </Button>
                    )}
                    {companyRequired !== null && (
                      <button
                        type="button"
                        onClick={() => toggle(globalRequired, undefined)}
                        disabled={busy}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Reset to platform default
                      </button>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

function SystemConfigTab() {
  const [form, setForm] = useState({
    google_client_id: '',
    google_client_secret: '',
    google_callback_url: '',
    jwt_secret: '',
    jwt_access_expires: '',
    jwt_refresh_days: '',
    cloudinary_cloud_name: '',
    cloudinary_api_key: '',
    cloudinary_api_secret: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const { companyId, companyName } = useSettingsTarget();

  /*
   * Re-read whenever the target changes. These are credentials, and showing one
   * company's Cloudinary keys under another company's name is the single worst
   * mix-up available on this page.
   */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSystemConfig(companyId)
      .then((res) => {
        if (cancelled) return;
        const d = res?.data || {};
        // Replaced, not merged: merging would leave the previous company's
        // values standing wherever this one has set nothing.
        setForm({ ...BLANK_SYSTEM_CONFIG, ...d });
      })
      .catch(() => { if (!cancelled) setForm({ ...BLANK_SYSTEM_CONFIG }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await saveSystemConfig(form, companyId);
      // Tell auth-service to pick up new config immediately
      await client.post('/auth/reload-config').catch(() => {});
      setMsg({
        type: 'success',
        text: companyName
          ? `System config saved for ${companyName}.`
          : 'System config saved and auth service notified.',
      });
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { section: 'Google OAuth', items: [
      { key: 'google_client_id', label: 'Google Client ID', type: 'text', placeholder: 'From Google Cloud Console' },
      { key: 'google_client_secret', label: 'Google Client Secret', type: 'password', placeholder: '••••••••' },
      { key: 'google_callback_url', label: 'Callback URL', type: 'text', placeholder: 'http://localhost:3000/api/auth/google/callback' },
    ]},
    { section: 'JWT Configuration', items: [
      { key: 'jwt_secret', label: 'JWT Secret', type: 'password', placeholder: 'Min 32 chars, keep secure' },
      { key: 'jwt_access_expires', label: 'Access Token Expiry', type: 'text', placeholder: '1h / 30m / 2h' },
      { key: 'jwt_refresh_days', label: 'Refresh Token Days', type: 'number', placeholder: '7' },
    ]},
    { section: 'Cloudinary (File Uploads)', items: [
      { key: 'cloudinary_cloud_name', label: 'Cloud Name', type: 'text', placeholder: 'your-cloud-name' },
      { key: 'cloudinary_api_key', label: 'API Key', type: 'text', placeholder: 'From Cloudinary dashboard' },
      { key: 'cloudinary_api_secret', label: 'API Secret', type: 'password', placeholder: '••••••••' },
    ]},
  ];

  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">System Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Google OAuth, JWT, and Cloudinary credentials. JWT and Cloudinary values apply
          straight away; <strong>Google OAuth is only read when the server starts, so restart
          it after changing these.</strong>
        </p>
      </div>
      {isSuperiorAdmin ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠ Anything set here overrides the server&apos;s own configuration file. Secrets are masked on screen and stored securely.
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="mt-0.5">🔒</span>
          <span>
            <strong>Platform defaults are active.</strong> Anything you set here applies to your
            company only. The platform&apos;s own credentials stay hidden.
          </span>
        </div>
      )}
      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg.text}
        </div>
      )}
      <form onSubmit={handleSave} className="space-y-6">
        {fields.map(({ section, items }) => (
          <div key={section} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
            <h2 className="font-medium text-slate-700 border-b border-slate-100 pb-2">{section}</h2>
            {items.map(({ key, label, type, placeholder, options }) => (
              <div key={key}>
                <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
                {/*
                  * `select` needs its own branch — rendering it through the input
                  * below produces <input type="select">, which the browser falls
                  * back to a plain text box and silently accepts any value.
                  *
                  * The blank option is meaningful, not padding: an empty setting
                  * means "inherit the platform value" everywhere in this form.
                  */}
                {type === 'select' ? (
                  <Select
                    value={form[key] || ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  >
                    <option value="">Use the platform default</option>
                    {(options || []).map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                ) : (
                  <input
                    type={type}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={form[key] || ''}
                    placeholder={placeholder}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}
            >
            {saving ? 'Saving…' : 'Save & Apply'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * The company a platform admin is configuring.
 *
 * Rendered only for them — a company admin has exactly one target and a
 * dropdown listing it would be furniture. The default is Platform defaults,
 * because that is what a platform admin most often means and because it is what
 * the server assumes if the choice were ever lost in transit.
 */
function CompanyTargetPicker({ companyId, onChange }) {
  const [companies, setCompanies] = useState([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // The endpoint is superior-admin gated and returns every company
    // unpaginated, so there is nothing to ask it for. Sorted by name here
    // because it answers in id order — newest first, which is not an order
    // anybody looks a company up in.
    listCompanies()
      .then((response) => {
        const rows = Array.isArray(response?.data) ? response.data : (response || []);
        setCompanies(
          (Array.isArray(rows) ? rows : [])
            .slice()
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
        );
      })
      .catch(() => setFailed(true));
  }, []);

  const selected = companies.find((company) => String(company.id) === String(companyId));

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      {/*
        The label belongs to the Select, which renders its own <label> wrapper.
        A second one outside it would associate two labels with one control.
      */}
      <Select
        id="settings-target"
        label="Configuring"
        value={companyId === null ? '' : String(companyId)}
        onChange={(event) => {
          const value = event.target.value;
          const picked = companies.find((company) => String(company.id) === value);
          onChange(value === '' ? null : value, picked?.name ?? null);
        }}
        options={[
          { value: '', label: 'Platform defaults — every company' },
          ...companies.map((company) => ({ value: String(company.id), label: company.name })),
        ]}
      />
      <p className="mt-2 text-xs text-slate-500">
        {selected
          ? `Saving writes to ${selected.name} alone. Anything left blank there keeps falling back to the platform defaults.`
          : 'Saving writes the platform-wide defaults, used by every company that has not set its own.'}
      </p>
      {/*
        A failed list is said out loud. Silently showing only "Platform
        defaults" would look like a platform with no companies on it, and the
        next save would go somewhere the person did not intend.
      */}
      {failed && (
        <p className="mt-2 text-xs text-rose-600">
          The company list could not be loaded, so only the platform defaults can be edited here.
        </p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [activeGroup, setActiveGroup] = useState('appearance');
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [paymentTestMessage, setPaymentTestMessage] = useState(null);
  const [paymentTesting, setPaymentTesting] = useState('');
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);

  /**
   * The company being configured. Only a platform admin can move it; for
   * everybody else it stays null and the server pins them to their own company.
   */
  const [targetCompanyId, setTargetCompanyId] = useState(null);
  const [targetCompanyName, setTargetCompanyName] = useState(null);
  const target = useMemo(
    () => ({ companyId: targetCompanyId, companyName: targetCompanyName }),
    [targetCompanyId, targetCompanyName],
  );

  useEffect(() => {
    if (isSuperiorAdmin) {
      /*
       * Platform admin. With no company chosen this is the platform defaults;
       * with one chosen it is that company's effective configuration — what its
       * own admin would see, defaults and overrides merged, which is the only
       * view in which "is this already set?" can be answered.
       */
      getSettings(null, { effective: Boolean(targetCompanyId), companyId: targetCompanyId })
        .then((res) => setValues(res.data || {}))
        .catch(() => setValues({}));
    } else {
      // Company admin: effective for appearance/general (OK to inherit branding/name),
      // but own-rows-only for email/payment (never show global secrets)
      Promise.all([
        getSettings(null, { effective: true, group: 'general' }),
        getSettings(null, { group: 'email' }),    // own rows only — empty if not configured
        getSettings(null, { group: 'payment' }),  // own rows only — empty if not configured
        // Own rows only, like the other company-scoped groups. Blank means
        // "inheriting"; the field placeholders show what that inherits to.
        getSettings(null, { group: 'invoicing' }),
        getSettings(null, { group: 'inventory' }),
        getSettings(null, { group: 'assistant' }),
      ]).then(([gen, email, payment, invoicing, inventory, aiAssistant]) => {
        setValues({
          ...(gen.data || {}),
          ...(email.data || {}),
          ...(payment.data || {}),
          ...(invoicing.data || {}),
          ...(inventory.data || {}),
          ...(aiAssistant.data || {}),
        });
      });
    }
  }, [isSuperiorAdmin, targetCompanyId]);

  const handleChange = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (group) => {
    const groupDef = SETTING_GROUPS.find((g) => g.group === group);
    if (!groupDef?.fields) return;
    setSaving(true);
    setMessage(null);
    try {
      const settings = groupDef.fields.map(({ key }) => ({ key, value: values[key] || '' }));
      await bulkUpdateSettings(settings, group, targetCompanyId);
      setMessage({ type: 'success', text: 'Settings saved successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.userMessage });
    } finally {
      setSaving(false);
    }
  };

  const currentGroup = SETTING_GROUPS.find((g) => g.group === activeGroup);

  const handlePaymentGatewayTest = async (gateway) => {
    const gatewayActions = {
      stripe: stripeCreateIntent,
      flutterwave: flutterwaveVerify,
      paystack: paystackVerify,
    };

    const action = gatewayActions[gateway];
    if (!action) return;

    setPaymentTesting(gateway);
    setPaymentTestMessage(null);

    try {
      const response = await action({ test: true });
      setPaymentTestMessage({
        type: 'success',
        text: response?.message || `${gateway.charAt(0).toUpperCase() + gateway.slice(1)} test completed successfully.`,
      });
    } catch (error) {
      setPaymentTestMessage({
        type: 'error',
        text: error?.response?.data?.message || error?.userMessage || `Failed to test ${gateway}.`,
      });
    } finally {
      setPaymentTesting('');
    }
  };

  return (
    <SettingsTargetContext.Provider value={target}>
    <div className="flex flex-col gap-6">
      {/*
        The platform admin picks who they are configuring before anything else
        on the page, because every field below means something different
        depending on the answer.
      */}
      {isSuperiorAdmin && (
        <CompanyTargetPicker
          companyId={targetCompanyId}
          onChange={(id, name) => { setTargetCompanyId(id); setTargetCompanyName(name ?? null); }}
        />
      )}

      {/* Role-aware banner */}
      {isSuperiorAdmin ? (
        targetCompanyName ? (
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <span className="text-lg leading-none">🏢</span>
            <div>
              <span className="font-semibold">Editing {targetCompanyName}.</span>{' '}
              You are changing one company’s configuration on its behalf. Saving affects that
              company alone, and nothing here changes your own account or the platform defaults.
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 ring-1 ring-blue-200">
            <span className="text-lg leading-none">🌐</span>
            <div>
              <span className="font-semibold">Global defaults mode.</span>{' '}
              Changes you make here become the platform-wide defaults applied to all companies
              that haven’t configured their own values.
            </div>
          </div>
        )
      ) : (
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 ring-1 ring-blue-200">
          <span className="text-lg leading-none">🏢</span>
          <div>
            <span className="font-semibold">Company settings.</span>{' '}
            Values shown are your company’s configuration. Fields you haven’t customized
            fall back to platform-wide defaults. Saving here only affects your company.
          </div>
        </div>
      )}

      {/*
        The tabs WRAP rather than scroll sideways.

        As one scrolling row, how many tabs you could see depended on how much
        width your layout left for the content — so Invoicing and AI Assistant,
        which sit fifth and sixth, were off the right-hand edge in every layout
        with a sidebar and there was no scrollbar to suggest otherwise. A
        setting you cannot see is a setting you do not have, and which ones
        those were came down to a theme choice.
      */}
      <div className="flex flex-wrap border-b border-slate-200">
        {SETTING_GROUPS.map((g) => (
          <button
            key={g.group}
            type="button"
            onClick={() => { setActiveGroup(g.group); setMessage(null); }}
            className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
              activeGroup === g.group
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {activeGroup === 'appearance' ? (
          <AppearanceTab />
        ) : activeGroup === 'security' ? (
          <SecurityTab />
        ) : activeGroup === 'system_config' ? (
          <SystemConfigTab />
        ) : (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">{currentGroup?.label} Settings</h1>

            {/* Company admins: inform them that global defaults are active if they haven't configured their own values */}
            {!isSuperiorAdmin && ['email', 'payment', 'invoicing', 'inventory', 'assistant'].includes(activeGroup) && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span className="mt-0.5">🔒</span>
                <span>
                  <strong>Platform defaults are active.</strong> Your company hasn't configured custom {currentGroup?.label} settings yet. Values you enter here will override the platform defaults for your company only.
                </span>
              </div>
            )}

            {message && (
              <div className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {message.text}
              </div>
            )}

            <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              {currentGroup?.fields?.map(({ key, label, type, placeholder, options }) => (
                <div key={key}>
                  <label className="mb-1 block text-sm font-medium">{label}</label>
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

              {activeGroup === 'payment' && isSuperiorAdmin && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Payment Gateway Test</h2>
                    <p className="text-sm text-slate-500">Send a test request to each configured gateway.</p>
                  </div>

                  {paymentTestMessage && (
                    <div className={`rounded-lg px-4 py-2 text-sm ${paymentTestMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      {paymentTestMessage.text}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => handlePaymentGatewayTest('stripe')} disabled={paymentTesting === 'stripe'}>
                      {paymentTesting === 'stripe' ? 'Testing Stripe...' : 'Test Stripe'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => handlePaymentGatewayTest('flutterwave')} disabled={paymentTesting === 'flutterwave'}>
                      {paymentTesting === 'flutterwave' ? 'Testing Flutterwave...' : 'Test Flutterwave'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => handlePaymentGatewayTest('paystack')} disabled={paymentTesting === 'paystack'}>
                      {paymentTesting === 'paystack' ? 'Testing Paystack...' : 'Test Paystack'}
                    </Button>
                  </div>
                </div>
              )}

              <Button onClick={() => handleSave(activeGroup)} disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
    </SettingsTargetContext.Provider>
  );
}

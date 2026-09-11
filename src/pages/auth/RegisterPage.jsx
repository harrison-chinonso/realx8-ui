import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { register } from '../../api/authApi';
import { listRoles } from '../../api/rolesApi';
import useAuthStore from '../../store/authStore';
import useSharedBrand from '../../hooks/useSharedBrand';
import PropertyCarousel from '../../components/common/PropertyCarousel';
import { useAppearance } from '../../context/useAppearance';
import Select from '../../components/ui/Select';
import { apiUrl } from '../../api/apiBase';

/**
 * A full-page redirect, not an XHR, so it has to be a URL the BROWSER can
 * follow — derived from the API base rather than hardcoded, for the reason
 * LoginPage gives: a pinned localhost:3000 broke Google in every deployment
 * but a local one.
 */
const GOOGLE_AUTH_URL = apiUrl('/auth/google');

/* ── Google icon — matched to the one on the sign-in page ── */
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5h-1.9V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.2 5.2C39.9 36.6 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

const PUBLIC_ROLE_NAMES = ['client', 'realtor'];

/* ── Brand ── */
function RealtoBrand() {
  const { app_name, app_logo, nameLoaded } = useAppearance();

  if (!nameLoaded) {
    return (
      <span
        className="inline-block h-6 w-32 rounded animate-pulse"
        style={{ background: 'rgba(255,255,255,0.15)' }}
      />
    );
  }

  if (app_logo) {
    return (
      <div
        className="inline-flex items-center justify-center rounded-lg px-2 py-1"
        style={{ background: 'rgba(255,255,255,0.08)', maxWidth: 200 }}
      >
        <img
          src={app_logo}
          alt={app_name || 'Platform'}
          className="object-contain"
          style={{ height: 40, maxWidth: 180 }}
        />
      </div>
    );
  }
  const name = app_name || 'Platform';
  const lastSpace = name.lastIndexOf(' ');
  const head = lastSpace > 0 ? name.slice(0, lastSpace + 1) : '';
  const tail = lastSpace > 0 ? name.slice(lastSpace + 1) : name;
  return (
    <span className="text-xl font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
      {head}<span style={{ color: 'var(--primary)' }}>{tail}</span>
    </span>
  );
}

/* ── Eye icon ── */
function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.178-3.416M6.53 6.53A9.97 9.97 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.003 10.003 0 01-4.132 5.411M3 3l18 18" />
    </svg>
  );
}

/* ── Dark-theme field ── */
function Field({ label, type = 'text', value, onChange, placeholder, required }) {
  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPwd ? 'text' : 'password') : type;

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{label}</label>
      <div className="flex items-center h-11 w-full rounded-lg border border-white/10 bg-white/5 pr-3 overflow-hidden transition-all focus-within:border-white/30">
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="flex-1 h-full px-3.5 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
        />
        {isPassword && (
          <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)} className="text-white/30 hover:text-white/60 transition-colors">
            <EyeIcon open={showPwd} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Dark-theme select ── */
function DarkSelect({ label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{label}</label>
      <div className="h-11 w-full rounded-lg border border-white/10 bg-white/5 overflow-hidden transition-all focus-within:border-white/30">
        <Select
          value={value}
          onChange={onChange}
          className="w-full h-full px-3.5 bg-transparent text-sm text-white focus:outline-none appearance-none cursor-pointer"
          style={{ WebkitAppearance: 'none' }}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-[#07080c] text-white">
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  // Set when the visitor arrived from a shared property while trying to buy.
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  // Arriving from a shared link. A sealed `?ref=` token also brands this page
  // for the company that shared it; the hook still honours the older plain
  // `company_code` / `code` / `realtor_code` parameters, which cannot brand
  // but must keep working for links already in circulation.
  const {
    company: sharedCompanyName,
    companyCode: presetCompanyCode,
    realtorCode: referringRealtorCode,
    realtorName: referringRealtorName,
  } = useSharedBrand();
  const setSession = useAuthStore((state) => state.setSession);
  // Someone can reach this form while still signed in — a referral link is an
  // explicit request to create a new account, so the route allows it. Say what
  // will happen rather than silently swapping their session on submit.
  const signedInAs = useAuthStore((state) => state.user);
  const signedInName = useAuthStore((state) => state.accessToken) ? (signedInAs?.name || signedInAs?.email || null) : null;
  const { app_name, refresh: refreshAppearance } = useAppearance();
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: 'client',
    company_code: (() => {
      const q = new URLSearchParams(window.location.search);
      return (q.get('company_code') || q.get('code') || '').toUpperCase();
    })(),
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileState, setMobileState] = useState('splash'); // 'splash' | 'form'

  useEffect(() => {
    listRoles().then((response) => setRoles(response.data || [])).catch(() => setRoles([]));
  }, []);

  // A sealed link resolves over the network, so the code arrives after the
  // form's initial state was built from the URL. Sync it when it lands.
  useEffect(() => {
    if (!presetCompanyCode) return;
    setForm((prev) => (prev.company_code === presetCompanyCode
      ? prev
      : { ...prev, company_code: presetCompanyCode }));
  }, [presetCompanyCode]);

  const roleOptions = useMemo(
    () => roles
      .filter((role) => PUBLIC_ROLE_NAMES.includes(role.name))
      .map((role) => ({ value: role.name, label: role.display_name || role.name })),
    [roles]
  );
  const resolvedRoleOptions = roleOptions.length ? roleOptions : [{ value: 'client', label: 'Client' }];

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await register({
        ...form,
        type: form.role,
        role: form.role,
        ...(referringRealtorCode ? { realtor_code: referringRealtorCode } : {}),
      });
      setSession(response);
      await refreshAppearance();
      navigate(redirectTo || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to register');
    } finally {
      setLoading(false);
    }
  };

  /* ── Shared form content ── */
  const formContent = (
    <div className="flex flex-col justify-center flex-1 px-8 py-10 max-w-sm mx-auto w-full lg:max-w-none lg:mx-0 lg:px-10 lg:py-0">
      <div className="mb-6">
        <p className="text-xl font-semibold text-white">Create account</p>
        <p className="text-sm text-white/40 mt-1">Join {app_name || 'the platform'} to manage properties &amp; deals.</p>
      </div>

      {signedInName && (
        <div className="mb-5 rounded-lg bg-amber-500/10 px-4 py-3 text-xs text-amber-200 ring-1 ring-amber-400/30">
          You are signed in as <span className="font-semibold">{signedInName}</span>. Creating an account
          here will sign you out of that one.
          <button
            type="button"
            onClick={() => navigate('/')}
            className="ml-1 font-semibold underline underline-offset-2"
          >
            Go back instead
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Jane Doe"
            required
          />
          <Field
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+234 800 000 0000"
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            required
          />
          <DarkSelect
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={resolvedRoleOptions}
          />
          <div className="sm:col-span-2">
            <Field
              label="Company Code"
              value={form.company_code}
              onChange={(e) => setForm({ ...form, company_code: e.target.value.toUpperCase() })}
              placeholder="e.g. AB12C"
              required
              readOnly={!!presetCompanyCode}
            />
            {presetCompanyCode && (
              <p className="mt-1 text-xs text-slate-500">
                Your account will be linked to {sharedCompanyName || 'the company that shared this link'}
                {referringRealtorName
                  ? `, and to ${referringRealtorName}, who invited you`
                  : referringRealtorCode ? ', and to the realtor who sent you the link' : ''}.
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: `var(--primary)` }}
        >
          {loading ? 'Creating account…' : 'Create Account'}
        </button>

        <div className="flex items-center gap-3 text-xs text-white/25">
          <span className="h-px flex-1 bg-white/10" />
          or continue with
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {/*
          Same control as the sign-in page, and the same endpoint: /auth/google
          creates the account on first use, so one route serves both. An <a>
          rather than a button because this is a full-page redirect the browser
          must follow, not something fetch can do.
        */}
        <a
          href={GOOGLE_AUTH_URL}
          className="flex w-full items-center justify-center gap-2 h-11 rounded-lg border border-white/10 bg-white/5 text-sm font-medium text-white/70 hover:bg-white/10 transition"
        >
          <GoogleIcon />
          Sign up with Google
        </a>

        <p className="text-sm text-white/35 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-white/70 hover:text-white font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </form>

      <p className="text-xs text-white/20 text-center mt-8">
        Secure &amp; encrypted · © {new Date().getFullYear()} {app_name || 'Platform'}
      </p>
    </div>
  );

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#07080c]">

      {/* ══ MOBILE: full-screen carousel with splash buttons ══ */}
      <div className="lg:hidden relative w-full h-full">
        <PropertyCarousel className="absolute inset-0" />

        {/* Splash state */}
        {mobileState === 'splash' && (
          <div className="absolute inset-0 z-10 flex flex-col">
            {/* Brand — top right */}
            <div className="flex justify-end px-6 pt-10">
              <RealtoBrand />
            </div>

            {/* Buttons — vertically centered */}
            <div className="flex flex-1 flex-col items-center justify-center px-8 gap-3">
              <button
                onClick={() => setMobileState('form')}
                className="w-full max-w-xs h-12 rounded-xl text-sm font-semibold text-white shadow-lg"
                style={{ backgroundColor: `var(--primary)` }}
              >
                Create Account
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full max-w-xs h-12 rounded-xl text-sm font-semibold text-white/80 border border-white/25 backdrop-blur-md bg-white/5"
              >
                Sign In
              </button>
            </div>

            {/* Spacer so carousel bottom text stays visible */}
            <div className="h-28" />
          </div>
        )}

        {/* Form state */}
        {mobileState === 'form' && (
          <div className="absolute inset-0 z-20 bg-[#07080c] overflow-y-auto flex flex-col">
            <div className="px-6 pt-10 pb-4 flex items-center justify-between">
              <button
                onClick={() => { setMobileState('splash'); setError(''); }}
                className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <RealtoBrand />
            </div>
            {formContent}
          </div>
        )}
      </div>

      {/* ══ DESKTOP: left form panel (2/4) + right carousel (2/4) ══ */}
      <div className="hidden lg:flex w-full h-full">

        {/* Left: form panel — 2/4 = 50% */}
        <div className="w-1/2 shrink-0 flex flex-col bg-[#07080c] overflow-y-auto">
          <div className="px-10 pt-8 pb-4">
            <RealtoBrand />
          </div>
          <div className="flex-1 flex flex-col justify-center">
            {formContent}
          </div>
          <div className="px-10 pb-6 text-xs text-white/20">
            <a href="mailto:support@realto.app" className="hover:text-white/50 transition-colors">Get Help</a>
          </div>
        </div>

        {/* Right: full-height carousel — 2/4 = 50% */}
        <div className="w-1/2">
          <PropertyCarousel />
        </div>
      </div>
    </div>
  );
}

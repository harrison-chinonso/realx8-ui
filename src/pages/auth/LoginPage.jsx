import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { forgotPassword, forcedSetup2FA, forcedVerify2FA, login, resetPassword, verify2FA, verifyResetOtp } from '../../api/authApi';
import Modal from '../../components/common/Modal';
import PropertyCarousel from '../../components/common/PropertyCarousel';
import useAuthStore from '../../store/authStore';
import { useAppearance } from '../../context/useAppearance';
import { apiUrl } from '../../api/apiBase';

// A full-page redirect, not an XHR, so it has to be a URL the BROWSER can
// follow. Derived from the API base rather than hardcoded: pinned to
// localhost:3000, Google login broke in every deployment but a local one.
const GOOGLE_AUTH_URL = apiUrl('/auth/google');

/* ── Brand logo — uses DB-backed platform/company name ── */
function RealtoBrand({ light = false }) {
  const { app_name, app_logo, nameLoaded } = useAppearance();

  // Skeleton placeholder while name is loading
  if (!nameLoaded) {
    return (
      <span
        className="inline-block h-6 w-32 rounded animate-pulse"
        style={{ background: light ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }}
      />
    );
  }

  if (app_logo) {
    // Wrap in a small pill so white-background logos look intentional on dark panels
    return (
      <div
        className="inline-flex items-center justify-center rounded-lg px-2 py-1"
        style={{ background: light ? 'rgba(255,255,255,0.08)' : 'transparent', maxWidth: 200 }}
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
  const baseColor = light ? 'rgba(255,255,255,0.9)' : '#160D3A';
  return (
    <span className="text-xl font-bold tracking-tight" style={{ color: baseColor }}>
      {head}<span style={{ color: 'var(--primary)' }}>{tail}</span>
    </span>
  );
}

/* ── Google icon ── */
function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.29h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.58-5.15 3.58-8.63Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.86-3c-1.07.72-2.44 1.14-4.09 1.14-3.14 0-5.79-2.12-6.74-4.97H1.27v3.09A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.26 14.26A7.2 7.2 0 0 1 4.88 12c0-.79.14-1.56.38-2.26V6.65H1.27A12 12 0 0 0 0 12c0 1.94.46 3.78 1.27 5.35l3.99-3.09Z" />
      <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.17 15.24 0 12 0A11.99 11.99 0 0 0 1.27 6.65l3.99 3.09C6.21 6.89 8.86 4.77 12 4.77Z" />
    </svg>
  );
}

/* ── Eye toggle icon ── */
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

/* ── Field for dark panel ── */
function Field({ label, type = 'text', value, onChange, placeholder, required, inputMode, maxLength, pattern, autoComplete, light = false }) {
  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPwd ? 'text' : 'password') : type;

  if (light) {
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</label>
        <div className="flex items-center h-11 w-full rounded-lg border border-slate-200 bg-white pr-3 overflow-hidden transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
          <input
            type={inputType}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            inputMode={inputMode}
            maxLength={maxLength}
            pattern={pattern}
            autoComplete={autoComplete}
            className="flex-1 h-full px-3.5 bg-transparent text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none"
          />
          {isPassword && (
            <button type="button" tabIndex={-1} onClick={() => setShowPwd((v) => !v)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <EyeIcon open={showPwd} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{label}</label>
      <div className="flex items-center h-11 w-full rounded-lg border border-white/10 bg-white/5 pr-3 overflow-hidden transition-all focus-within:border-white/30 focus-within:bg-white/8">
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          inputMode={inputMode}
          maxLength={maxLength}
          pattern={pattern}
          autoComplete={autoComplete}
          className="flex-1 h-full px-3.5 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPwd((v) => !v)}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <EyeIcon open={showPwd} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Main LoginPage
══════════════════════════════════════════════ */
export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const { app_name, refresh: refreshAppearance } = useAppearance();

  const [form, setForm] = useState({ identifier: '', password: '', remember: true });
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' | 'phone'
  const [totpToken, setTotpToken] = useState('');
  const [tempToken, setTempToken] = useState('');
  // authStep: 'credentials' | '2fa' | '2fa-setup' | '2fa-setup-verify'
  const [authStep, setAuthStep] = useState('credentials');
  const [setupData, setSetupData] = useState(null); // { qrCodeUrl, secret } from forced setup
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  // forgotStep: 'request' | 'otp' | 'reset' | 'done'
  const [forgotStep, setForgotStep] = useState('request');
  const [forgotForm, setForgotForm] = useState({ email: '', otp: '', password: '', confirmPassword: '', reset_token: '' });
  const [forgotMessage, setForgotMessage] = useState({ type: '', text: '' });
  const [forgotLoading, setForgotLoading] = useState(false);
  const [mobileState, setMobileState] = useState('splash'); // 'splash' | 'form'

  const googleError = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('error');
    if (code === 'account_inactive') return 'Your account is inactive.';
    if (code) return 'Google sign-in failed. Please try again.';
    return '';
  }, [location.search]);

  useEffect(() => {
    if (googleError) setError(googleError);
  }, [googleError]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login({ identifier: form.identifier, password: form.password });
      if (res.requires_2fa) { setTempToken(res.temp_token); setAuthStep('2fa'); return; }
      if (res.requires_2fa_setup) {
        setTempToken(res.temp_token);
        setAuthStep('2fa-setup');
        setLoading(true);
        try {
          const data = await forcedSetup2FA(res.temp_token);
          setSetupData(data);
        } catch {
          setError('Unable to start 2FA setup. Please try again.');
          setAuthStep('credentials');
        } finally {
          setLoading(false);
        }
        return;
      }
      setSession(res);
      await refreshAppearance();
      navigate(redirectTo || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to login');
    } finally {
      setLoading(false);
    }
  };

  const submit2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await verify2FA(tempToken, totpToken);
      setSession(res);
      await refreshAppearance();
      navigate(redirectTo || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to verify code');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password: step 1 — send OTP ──
  const requestOtp = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage({ type: '', text: '' });
    try {
      const res = await forgotPassword(forgotForm.email);
      setForgotStep('otp');
      setForgotMessage({ type: 'success', text: res.message });
    } catch (err) {
      setForgotMessage({ type: 'error', text: err.response?.data?.message || 'Unable to send OTP. Try again.' });
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Forgot password: step 2 — verify OTP ──
  const verifyOtp = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage({ type: '', text: '' });
    try {
      const res = await verifyResetOtp(forgotForm.email, forgotForm.otp);
      setForgotForm((c) => ({ ...c, reset_token: res.reset_token }));
      setForgotStep('reset');
      setForgotMessage({ type: 'success', text: 'OTP verified. Set your new password below.' });
    } catch (err) {
      setForgotMessage({ type: 'error', text: err.response?.data?.message || 'Invalid or expired OTP.' });
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Forgot password: step 3 — set new password ──
  const submitPasswordReset = async (e) => {
    e.preventDefault();
    if (forgotForm.password !== forgotForm.confirmPassword) {
      setForgotMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setForgotLoading(true);
    setForgotMessage({ type: '', text: '' });
    try {
      const res = await resetPassword({ reset_token: forgotForm.reset_token, password: forgotForm.password });
      setForgotStep('done');
      setForgotMessage({ type: 'success', text: res.message || 'Password reset successful. You can now sign in.' });
      setTimeout(closeForgotModal, 2000);
    } catch (err) {
      setForgotMessage({ type: 'error', text: err.response?.data?.message || 'Unable to reset password. The code may have expired.' });
    } finally {
      setForgotLoading(false);
    }
  };

  const resetToCredentials = () => { setAuthStep('credentials'); setTempToken(''); setTotpToken(''); setSetupData(null); setError(''); };

  const submitForcedSetupVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await forcedVerify2FA(tempToken, totpToken);
      setSession(res);
      await refreshAppearance();
      navigate(redirectTo || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep('request');
    setForgotForm({ email: '', otp: '', password: '', confirmPassword: '', reset_token: '' });
    setForgotMessage({ type: '', text: '' });
  };

  /* ── Shared form card JSX (used in both mobile and desktop) ── */
  const formCard = (
    <div className="flex flex-col justify-center flex-1 px-8 py-10 max-w-sm mx-auto w-full lg:max-w-none lg:mx-0 lg:px-10 lg:py-0">
      <div className="mb-6">
        <p className="text-xl font-semibold text-white">
          {authStep === '2fa' ? 'Verify sign in' : authStep === '2fa-setup' || authStep === '2fa-setup-verify' ? 'Set up two-factor auth' : 'Welcome back'}
        </p>
        <p className="text-sm text-white/40 mt-1">
          {authStep === '2fa'
            ? 'Enter the 6-digit code from your authenticator app.'
            : authStep === '2fa-setup'
            ? 'Your organisation requires 2FA. Scan the QR code with your authenticator app.'
            : authStep === '2fa-setup-verify'
            ? 'Enter the 6-digit code from your authenticator app to confirm setup.'
            : 'Sign in to your account to continue.'}
        </p>
      </div>

      {/* Credentials form */}
      {authStep === 'credentials' && (
        <form onSubmit={submit} className="space-y-4">
          {/* Login method toggle */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => { setLoginMethod('email'); setForm((f) => ({ ...f, identifier: '' })); }}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${loginMethod === 'email' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod('phone'); setForm((f) => ({ ...f, identifier: '' })); }}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${loginMethod === 'phone' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              Phone Number
            </button>
          </div>

          {loginMethod === 'email' ? (
            <Field
              label="Email"
              type="email"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          ) : (
            <Field
              label="Phone Number"
              type="tel"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              placeholder="+1 555 000 0000"
              required
              inputMode="tel"
              autoComplete="tel"
            />
          )}
          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-sm text-white/50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.remember}
                onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-white/20 accent-[var(--primary)]"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Forgot password?
            </button>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 mt-2"
            style={{ backgroundColor: `var(--primary)` }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="flex items-center gap-3 text-xs text-white/25">
            <span className="h-px flex-1 bg-white/10" />
            or continue with
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <a
            href={GOOGLE_AUTH_URL}
            className="flex w-full items-center justify-center gap-2 h-11 rounded-lg border border-white/10 bg-white/5 text-sm font-medium text-white/70 hover:bg-white/10 transition"
          >
            <GoogleIcon />
            Sign in with Google
          </a>

          <p className="text-sm text-white/35 text-center pt-1">
            Don't have an account?{' '}
            <Link to="/register" className="text-white/70 hover:text-white font-medium transition-colors">
              Create one
            </Link>
          </p>
        </form>
      )}

      {/* 2FA form */}
      {authStep === '2fa' && (
        <form onSubmit={submit2FA} className="space-y-4">
          <Field
            label="Authentication code"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="123456"
            value={totpToken}
            onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: `var(--primary)` }}
          >
            {loading ? 'Verifying…' : 'Verify code'}
          </button>
          <button
            type="button"
            onClick={resetToCredentials}
            className="w-full h-11 rounded-lg text-sm font-medium text-white/50 border border-white/10 hover:bg-white/5 transition"
          >
            Back
          </button>
        </form>
      )}

      {/* Forced 2FA setup — QR code step */}
      {authStep === '2fa-setup' && (
        <div className="space-y-4">
          {loading && <p className="text-sm text-white/50">Generating QR code…</p>}
          {!loading && setupData && (
            <>
              <div className="flex justify-center">
                <img src={setupData.qrCodeUrl} alt="2FA QR code" className="h-44 w-44 rounded-lg bg-white p-2" />
              </div>
              <p className="text-xs text-white/35 text-center">
                Can't scan? Use code: <span className="font-mono text-white/60">{setupData.secret}</span>
              </p>
              {error && <p className="text-sm text-rose-400">{error}</p>}
              <button
                type="button"
                onClick={() => { setAuthStep('2fa-setup-verify'); setTotpToken(''); setError(''); }}
                className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity"
                style={{ backgroundColor: `var(--primary)` }}
              >
                I've scanned the code
              </button>
              <button
                type="button"
                onClick={resetToCredentials}
                className="w-full h-11 rounded-lg text-sm font-medium text-white/50 border border-white/10 hover:bg-white/5 transition"
              >
                Back
              </button>
            </>
          )}
        </div>
      )}

      {/* Forced 2FA setup — verify step */}
      {authStep === '2fa-setup-verify' && (
        <form onSubmit={submitForcedSetupVerify} className="space-y-4">
          <Field
            label="Verification code"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="123456"
            value={totpToken}
            onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: `var(--primary)` }}
          >
            {loading ? 'Confirming…' : 'Confirm & Sign In'}
          </button>
          <button
            type="button"
            onClick={() => setAuthStep('2fa-setup')}
            className="w-full h-11 rounded-lg text-sm font-medium text-white/50 border border-white/10 hover:bg-white/5 transition"
          >
            Back to QR code
          </button>
        </form>
      )}

      <p className="text-xs text-white/20 text-center mt-8">
        Secure &amp; encrypted · © {new Date().getFullYear()} {app_name || 'Platform'}
      </p>
    </div>
  );

  return (
    <>
      <div className="h-screen w-full flex overflow-hidden bg-[#07080c]">

        {/* ══ MOBILE: full-screen carousel with splash buttons ══ */}
        <div className="lg:hidden relative w-full h-full">
          <PropertyCarousel className="absolute inset-0" />

          {/* Splash state: logo + CTA buttons */}
          {mobileState === 'splash' && (
            <div className="absolute inset-0 z-10 flex flex-col">
              {/* Brand — top right */}
              <div className="flex justify-end px-6 pt-10">
                <RealtoBrand light />
              </div>

              {/* Buttons — vertically centered */}
              <div className="flex flex-1 flex-col items-center justify-center px-8 gap-3">
                <button
                  onClick={() => setMobileState('form')}
                  className="w-full max-w-xs h-12 rounded-xl text-sm font-semibold text-white shadow-lg"
                  style={{ backgroundColor: `var(--primary)` }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="w-full max-w-xs h-12 rounded-xl text-sm font-semibold text-white/80 border border-white/25 backdrop-blur-md bg-white/5"
                >
                  Create Account
                </button>
              </div>

              {/* Spacer so carousel bottom text stays visible */}
              <div className="h-28" />
            </div>
          )}

          {/* Form state: full-screen form */}
          {mobileState === 'form' && (
            <div className="absolute inset-0 z-20 bg-[#07080c] overflow-y-auto flex flex-col">
              <div className="px-6 pt-10 pb-4 flex items-center justify-between">
                <button
                  onClick={() => { setMobileState('splash'); setAuthStep('credentials'); setError(''); }}
                  className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <RealtoBrand light />
              </div>
              {formCard}
            </div>
          )}
        </div>

        {/* ══ DESKTOP: left form panel + right full-height carousel ══ */}
        <div className="hidden lg:flex w-full h-full">

          {/* Left: form panel — 1.5/4 = 37.5% */}
          <div className="w-[37.5%] shrink-0 flex flex-col bg-[#07080c] overflow-y-auto">
            <div className="px-10 pt-8 pb-4">
              <RealtoBrand light />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              {formCard}
            </div>
            <div className="px-10 pb-6 text-xs text-white/20">
              <a href="mailto:support@realto.app" className="hover:text-white/50 transition-colors">Get Help</a>
            </div>
          </div>

          {/* Right: full-height image carousel — 2.5/4 = 62.5% */}
          <div className="flex-1">
            <PropertyCarousel />
          </div>
        </div>
      </div>

      {/* ── Forgot password modal ── */}
      <Modal open={showForgotModal} onClose={closeForgotModal} title="Forgot password">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {['request', 'otp', 'reset'].map((step, i) => {
            const steps = ['request', 'otp', 'reset'];
            const currentIdx = steps.indexOf(forgotStep === 'done' ? 'reset' : forgotStep);
            const stepIdx = i;
            const done = stepIdx < currentIdx || forgotStep === 'done';
            const active = stepIdx === currentIdx;
            return (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${done ? 'bg-green-500 text-white' : active ? 'text-white' : 'bg-slate-200 text-slate-500'}`}
                  style={active ? { backgroundColor: 'var(--primary)' } : undefined}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-xs ${active ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                  {['Email', 'Verify OTP', 'New Password'][i]}
                </span>
                {i < 2 && <span className="flex-1 h-px bg-slate-200" />}
              </div>
            );
          })}
        </div>

        {forgotMessage.text && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${forgotMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {forgotMessage.text}
          </div>
        )}

        {/* Step 1: Enter email */}
        {forgotStep === 'request' && (
          <form onSubmit={requestOtp} className="space-y-4">
            <Field
              light
              label="Email address"
              type="email"
              value={forgotForm.email}
              onChange={(e) => setForgotForm((c) => ({ ...c, email: e.target.value }))}
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
            <p className="text-xs text-slate-400">We'll send a 6-digit code to this email.</p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={forgotLoading}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: `var(--primary)` }}
              >
                {forgotLoading ? 'Sending…' : 'Send OTP'}
              </button>
              <button type="button" onClick={closeForgotModal} className="flex-1 h-10 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Enter OTP */}
        {forgotStep === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-slate-600">Enter the 6-digit code sent to <strong>{forgotForm.email}</strong>.</p>
            <Field
              light
              label="6-digit OTP"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="123456"
              value={forgotForm.otp}
              onChange={(e) => setForgotForm((c) => ({ ...c, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={forgotLoading || forgotForm.otp.length !== 6}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: `var(--primary)` }}
              >
                {forgotLoading ? 'Verifying…' : 'Verify code'}
              </button>
              <button
                type="button"
                onClick={() => { setForgotStep('request'); setForgotForm((c) => ({ ...c, otp: '' })); setForgotMessage({ type: '', text: '' }); }}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                Back
              </button>
            </div>
            <button
              type="button"
              disabled={forgotLoading}
              onClick={async () => {
                setForgotLoading(true);
                setForgotMessage({ type: '', text: '' });
                try {
                  const res = await forgotPassword(forgotForm.email);
                  setForgotMessage({ type: 'success', text: 'New OTP sent.' + (res.message ? ' ' + res.message : '') });
                } catch { setForgotMessage({ type: 'error', text: 'Unable to resend. Try again.' }); }
                finally { setForgotLoading(false); }
              }}
              className="w-full text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50"
            >
              Didn't receive it? Resend OTP
            </button>
          </form>
        )}

        {/* Step 3: New password */}
        {(forgotStep === 'reset' || forgotStep === 'done') && (
          <form onSubmit={submitPasswordReset} className="space-y-4">
            <Field
              light
              label="New password"
              type="password"
              value={forgotForm.password}
              onChange={(e) => setForgotForm((c) => ({ ...c, password: e.target.value }))}
              placeholder="Min. 6 characters"
              required
              autoComplete="new-password"
            />
            <Field
              light
              label="Confirm new password"
              type="password"
              value={forgotForm.confirmPassword}
              onChange={(e) => setForgotForm((c) => ({ ...c, confirmPassword: e.target.value }))}
              placeholder="Repeat password"
              required
              autoComplete="new-password"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={forgotLoading || forgotStep === 'done'}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: `var(--primary)` }}
              >
                {forgotLoading ? 'Saving…' : 'Set new password'}
              </button>
              <button
                type="button"
                onClick={() => { setForgotStep('otp'); setForgotMessage({ type: '', text: '' }); }}
                disabled={forgotStep === 'done'}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                Back
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

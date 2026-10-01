import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import {
  forgotPassword, forcedSetup2FA, forcedVerify2FA, login, loginToCompany, passcodeLogin, resetPassword, verify2FA, verifyResetOtp,
} from '../../api/authApi';
import Modal from '../../components/common/Modal';
import useAuthStore from '../../store/authStore';
import { useAppearance } from '../../context/useAppearance';
import { googleAuthUrl, codesFromLocation } from '../../utils/googleAuthUrl';
import FieldMark from '../../components/ui/FieldMark';
import { PASSWORD_HINT } from '../../constants/password';
import Select from '../../components/ui/Select';
import useCompanyCode from '../../hooks/useCompanyCode';
import {
  forgetAccount, initialsOf, maskEmail, passcodeLikelyOpen, readKnownAccount, rememberAccount,
} from '../../lib/knownAccount';
import { enumLabel } from '../../utils/enumLabel';
import {
  AuthBrand, AuthField, AuthShell, PasscodeInput, PasswordField, ShowcasePanel, ghostButton, primaryButton, primaryInk,
} from '../../components/auth/AuthKit';

/*
 * The sign-in page, for the platform and for each company.
 *
 * /login is the platform's page; /login/<company code> is a company's — its
 * logo, colours and fonts from the first paint, and its own listings and
 * offers beside the form where the stock photographs used to be. A device
 * that was told to keep its owner signed in greets them by name next time.
 * Every way in is unchanged: email or phone and password, the passcode, Google,
 * a choice of company, two-factor and its forced enrolment, and the password
 * reset below.
 */

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
        <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}<FieldMark required={Boolean(required)} /></label>
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
      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{label}<FieldMark required={Boolean(required)} /></label>
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
  const { companyCode: codeInPath } = useParams();
  const setSession = useAuthStore((state) => state.setSession);
  const { app_name, refresh: refreshAppearance } = useAppearance();

  /**
   * Whose sign-in page this is, most specific first: the code in the path
   * (/login/<code>, the link a company hands its people), one on the query
   * string (older links), then the company this device last signed in to.
   * None of them: the platform's own page, exactly as before — which is also
   * what a platform admin, who belongs to no company, always sees.
   */
  const [known, setKnown] = useState(() => readKnownAccount());
  const linkCode = (codeInPath || searchParams.get('company_code') || searchParams.get('code') || '').toUpperCase() || null;
  const companyCode = linkCode || known?.company_code || null;
  const { company, properties } = useCompanyCode(companyCode, { showcase: true });
  // A link naming a DIFFERENT company than the remembered account is a request
  // to sign in there, so the greeting stands aside.
  const greeting = known && (!linkCode || !known.company_code || known.company_code === linkCode) ? known : null;

  const [form, setForm] = useState(() => ({ identifier: greeting?.email || '', password: '', remember: true }));
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' | 'phone'
  const [totpToken, setTotpToken] = useState('');
  const [passcode, setPasscode] = useState('');
  const [tempToken, setTempToken] = useState('');
  /*
   * Somebody this device signed in IN FULL less than two hours ago, who has a
   * passcode, starts on the passcode: six digits and they are back in. The
   * password is one tap away for anyone who has forgotten it, and is what
   * everybody else starts on.
   */
  // authStep: 'credentials' | 'passcode' | 'company' | '2fa' | '2fa-setup' | '2fa-setup-verify'
  const [authStep, setAuthStep] = useState(() => (greeting && passcodeLikelyOpen(greeting) ? 'passcode' : 'credentials'));
  const [setupData, setSetupData] = useState(null); // { qrCodeUrl, secret } from forced setup
  /**
   * The companies this password opened, and the token that proves it did.
   *
   * Only ever set when there is more than one — somebody with a single company
   * is never shown a choice, because being asked to pick between one thing
   * reads as a fault.
   */
  const [companyChoice, setCompanyChoice] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  // forgotStep: 'request' | 'otp' | 'reset' | 'done'
  const [forgotStep, setForgotStep] = useState('request');
  const [forgotForm, setForgotForm] = useState({ email: '', otp: '', password: '', confirmPassword: '', reset_token: '', company_id: 'all' });
  /** Only ever more than one for somebody who deals with several companies. */
  const [resetCompanies, setResetCompanies] = useState([]);
  const [forgotMessage, setForgotMessage] = useState({ type: '', text: '' });
  const [forgotLoading, setForgotLoading] = useState(false);

  /**
   * What actually went wrong with Google, in words somebody can act on.
   *
   * This used to answer "Google sign-in failed. Please try again." for every
   * cause — including the ones where trying again could never work, such as
   * arriving without a company code. The server now names the reason and
   * supplies the sentence; that sentence is preferred, and the cases below are
   * the fallback for an older server that does not send one.
   */
  const googleError = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('error');
    if (!code) return '';

    const fromServer = params.get('message');
    if (fromServer) return fromServer;

    if (code === 'account_inactive') return 'Your account is inactive.';
    if (code === 'company_code_missing') {
      return 'To create an account with Google, open the link your company or agent sent you — '
        + 'it carries the company code we need.';
    }
    if (code === 'company_code_invalid') {
      return 'That company code was not recognised. Check it with whoever sent you the link.';
    }
    if (code === 'company_suspended') return 'That company account is currently suspended.';
    return 'Google sign-in failed. Please try again.';
  }, [location.search]);

  useEffect(() => {
    if (googleError) setError(googleError);
  }, [googleError]);

  /**
   * A Google sign-in that landed on a person with several companies.
   *
   * The callback route has no screen of its own, so it hands the choice back
   * here as URL parameters. From this point the flow is identical to a password
   * sign-in that produced a choice — same step, same list, same second call —
   * which is the reason it is routed here rather than answered there.
   */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('company_token');
    if (!token) return;
    let companies = [];
    try { companies = JSON.parse(params.get('companies') || '[]'); } catch { companies = []; }
    setCompanyChoice({ token, companies });
    setAuthStep('company');
  }, [location.search]);

  /*
   * A Google sign-in that still owes its second factor (GoogleCallbackPage):
   * straight to the same code step, or forced set-up, a password reaches.
   */
  useEffect(() => {
    const pending = location.state?.pendingTwoFactor;
    if (!pending?.temp_token) return;
    navigate(location.pathname + location.search, { replace: true, state: null });
    applyAuthResponse(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * A session, finished: stored, remembered on this device if asked, and on
   * to wherever the visitor was going.
   *
   * The session carries the company's look and feel now, so there is nothing
   * to wait for before the next screen — it is already in the right colours.
   * An older server that does not send it still gets the separate read.
   */
  const finishSession = async (res, { viaPasscode = false } = {}) => {
    // Read before setSession, whose sign-in wipe clears the remembered account.
    const before = readKnownAccount();
    setSession(res);
    /*
     * A passcode sign-in keeps the device's record of the last FULL sign-in,
     * as the server keeps its own clock: the passcode window is two hours from
     * the password, not from the last passcode.
     */
    if (form.remember) rememberAccount(res, { passwordAt: viaPasscode ? before?.password_at : Date.now() });
    else forgetAccount();
    if (!res.appearance) await refreshAppearance();
    navigate(redirectTo || '/');
  };

  /**
   * What the server answered, whichever step asked.
   *
   * Shared because a sign-in can now arrive here from three places — the
   * password form, the passcode, and the company choice that may follow either
   * — and the two-factor rules must not differ between them. The policy
   * belongs to the company being signed in to, so it is only knowable after
   * the choice has been made, which is exactly why this cannot live in the
   * password handler alone.
   */
  const applyAuthResponse = async (res, finish = {}) => {
    if (res.requires_company) {
      setCompanyChoice({ token: res.company_token, companies: res.companies || [] });
      setAuthStep('company');
      return;
    }
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
    await finishSession(res, finish);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await applyAuthResponse(await login({ identifier: form.identifier, password: form.password }));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to login');
    } finally {
      setLoading(false);
    }
  };

  /**
   * The 6-digit passcode, for somebody who signed in with their password in the
   * last few hours. Outside that window the server says so, and the password
   * form comes back with the reason on it.
   */
  /*
   * No second factor here, by design: the passcode is only accepted within two
   * hours of a full sign-in, and that sign-in already asked for the code.
   */
  const submitPasscode = async (e) => {
    e?.preventDefault();
    if (loading || passcode.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await applyAuthResponse(await passcodeLogin({ identifier: form.identifier, passcode }), { viaPasscode: true });
    } catch (err) {
      setError(err.response?.data?.message || 'That passcode did not work. Sign in with your password.');
      setPasscode('');
      if (err.response?.data?.reason === 'window_expired') setAuthStep('credentials');
    } finally {
      setLoading(false);
    }
  };

  // The sixth digit signs in — there is nothing else on the form to press.
  useEffect(() => {
    if (authStep === 'passcode' && passcode.length === 6 && form.identifier) submitPasscode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passcode]);

  /** Finish a sign-in against the company that was picked. */
  const chooseCompany = async (companyId) => {
    setLoading(true);
    setError('');
    try {
      await applyAuthResponse(await loginToCompany(companyChoice.token, companyId));
    } catch (err) {
      /*
       * The token behind the choice is short-lived. When it has run out there
       * is nothing to retry here — the password has to be given again — so the
       * form comes back rather than leaving a list of companies that will
       * refuse every one of them.
       */
      if (err.response?.data?.reason === 'company_choice_expired') {
        setCompanyChoice(null);
        setAuthStep('credentials');
      }
      setError(err.response?.data?.message || 'Unable to sign in to that company.');
    } finally {
      setLoading(false);
    }
  };

  const submit2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await finishSession(await verify2FA(tempToken, totpToken));
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
      /*
       * The companies this address holds accounts with, disclosed only now
       * that the code has been proved. A password belongs to ONE company
       * account, so the step below has to ask which — otherwise resetting a
       * forgotten password for one company would silently change the others.
       */
      setResetCompanies(Array.isArray(res.companies) ? res.companies : []);
      setForgotForm((c) => ({ ...c, reset_token: res.reset_token, company_id: 'all' }));
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
      const res = await resetPassword({
        reset_token: forgotForm.reset_token,
        password: forgotForm.password,
        company_id: forgotForm.company_id || 'all',
      });
      setForgotStep('done');
      setForgotMessage({ type: 'success', text: res.message || 'Password reset successful. You can now sign in.' });
      setTimeout(closeForgotModal, 2000);
    } catch (err) {
      setForgotMessage({ type: 'error', text: err.response?.data?.message || 'Unable to reset password. The code may have expired.' });
    } finally {
      setForgotLoading(false);
    }
  };

  const resetToCredentials = () => { setAuthStep('credentials'); setTempToken(''); setTotpToken(''); setPasscode(''); setSetupData(null); setCompanyChoice(null); setError(''); };

  const submitForcedSetupVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await finishSession(await forcedVerify2FA(tempToken, totpToken));
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

  /**
   * "Not you?" — forget the remembered account and give the page back to
   * whoever is at the keyboard. When the company came only from that memory
   * (no code in the link), the platform's own look comes back with it.
   */
  const notYou = () => {
    forgetAccount();
    setKnown(null);
    setForm({ identifier: '', password: '', remember: true });
    resetToCredentials();
    if (!linkCode) refreshAppearance();
  };

  const companyName = company?.name || greeting?.company_name || null;
  const registerHref = company?.code || linkCode ? `/register?company_code=${encodeURIComponent(company?.code || linkCode)}` : '/register';
  const errorLine = error && <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200 ring-1 ring-rose-400/30" role="alert">{error}</p>;
  const backButton = (onClick, label = 'Back') => (
    <button type="button" onClick={onClick} className={ghostButton}>{label}</button>
  );

  const heading = authStep === '2fa' ? 'Verify sign in'
    : authStep === 'company' ? 'Choose a company'
    : authStep === '2fa-setup' || authStep === '2fa-setup-verify' ? 'Set up two-factor auth'
    : authStep === 'passcode' ? (greeting?.name ? `Welcome back, ${greeting.name.trim().split(/\s+/)[0]}` : 'Sign in with your passcode')
    : greeting ? 'Good to see you again'
    : 'Welcome back';
  const subheading = authStep === '2fa'
    ? 'Enter the 6-digit code from your authenticator app.'
    : authStep === 'company'
    ? 'You have an account with more than one company. Pick the one to work in — you can switch at any time afterwards.'
    : authStep === '2fa-setup'
    ? 'Your organization requires 2FA. Scan the QR code with your authenticator app.'
    : authStep === '2fa-setup-verify'
    ? 'Enter the 6-digit code from your authenticator app to confirm setup.'
    : authStep === 'passcode'
    ? (greeting ? 'Enter your 6-digit passcode to carry on where you left off.' : 'The 6-digit passcode works for two hours after you last signed in with your password.')
    : greeting ? 'This device remembers you, so there is only your password left.'
    : companyName ? `Sign in to your ${companyName} account.`
    : 'Sign in to your account to continue.';

  const googleHref = googleAuthUrl({
    ...codesFromLocation(),
    ...(company?.code || linkCode ? { companyCode: company?.code || linkCode } : {}),
    redirect: searchParams.get('redirect'),
  });

  const content = (
    <>
      <div className="space-y-2">
        <h1 className="font-heading text-[30px] font-extrabold leading-tight tracking-tight sm:text-[34px]">{heading}</h1>
        <p className="text-[15px] text-[#A6ADBD]">{subheading}</p>
      </div>

      {/* The remembered account — who, which company, and a way out. */}
      {greeting && (authStep === 'credentials' || authStep === 'passcode') && (
        <div className="flex items-center gap-3.5 rounded-2xl border border-[#2B3350] bg-[#161B2C] p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#262D44] font-heading font-bold" aria-hidden="true">
            {initialsOf(greeting.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{greeting.name || greeting.email}</p>
            <p className="truncate text-[13px] text-[#A6ADBD]">
              {maskEmail(greeting.email)}{greeting.type ? ` · ${enumLabel(greeting.type)}` : ''}
            </p>
          </div>
          <button type="button" onClick={notYou} className="shrink-0 px-1 py-3 text-[13px] font-bold text-[#E9D8C4] hover:underline">
            Not you?
          </button>
        </div>
      )}

      {authStep === 'credentials' && (
        <form onSubmit={submit} className="space-y-4">
          {!greeting && (
            <>
              <div role="group" aria-label="Sign in with" className="grid grid-cols-2 rounded-xl bg-[#161B2C] p-1">
                {[['email', 'Email'], ['phone', 'Phone number']].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={loginMethod === value}
                    onClick={() => { setLoginMethod(value); setForm((f) => ({ ...f, identifier: '' })); }}
                    className={`h-10 rounded-[9px] text-sm font-semibold transition ${loginMethod === value ? 'bg-[#262D44] text-[#F3F1EC]' : 'text-[#A6ADBD] hover:text-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {loginMethod === 'email' ? (
                <AuthField
                  id="login-email"
                  label="Email"
                  type="email"
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              ) : (
                <AuthField
                  id="login-phone"
                  label="Phone number"
                  type="tel"
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  placeholder="+234 803 000 0000"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                />
              )}
            </>
          )}
          <PasswordField
            id="login-password"
            label="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            autoFocus={Boolean(greeting)}
            action={(
              <button type="button" onClick={() => setShowForgotModal(true)} className="text-[13px] font-semibold text-[#E9D8C4] hover:underline">
                Forgot password?
              </button>
            )}
          />

          <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-[#D5D9E2]">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(e) => setForm({ ...form, remember: e.target.checked })}
              className="h-[18px] w-[18px] accent-[var(--primary)]"
            />
            Keep me signed in on this device
          </label>

          {errorLine}

          <button type="submit" disabled={loading} className={primaryButton} style={primaryInk}>
            {loading ? 'Signing in…' : (greeting && companyName ? `Continue to ${companyName}` : 'Sign in')}
          </button>

          <div className="flex items-center gap-3 text-xs text-[#7C8497]" aria-hidden="true">
            <span className="h-px flex-1 bg-[#262D44]" />or<span className="h-px flex-1 bg-[#262D44]" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <a href={googleHref} className={ghostButton}>
              <GoogleIcon />
              Google
            </a>
            <button type="button" onClick={() => { setError(''); setAuthStep('passcode'); }} className={ghostButton}>
              <Lock size={16} aria-hidden="true" />
              Passcode
            </button>
          </div>
        </form>
      )}

      {authStep === 'passcode' && (
        <form onSubmit={submitPasscode} className="space-y-4">
          {!greeting && (
            <AuthField
              id="passcode-identifier"
              label="Email or phone number"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              placeholder="you@example.com"
              required
              autoComplete="username"
            />
          )}
          <PasscodeInput
            id="passcode"
            label="Passcode"
            value={passcode}
            onChange={setPasscode}
            autoFocus
            disabled={loading}
          />
          {errorLine}
          <button type="submit" disabled={loading || passcode.length !== 6} className={primaryButton} style={primaryInk}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          {backButton(resetToCredentials, "Forgot it? Use my password instead")}
        </form>
      )}

      {/* Which company, for somebody who belongs to several */}
      {authStep === 'company' && (
        <div className="space-y-3">
          {(companyChoice?.companies || []).map((entry) => {
            /*
             * A company that cannot be entered is shown and disabled rather
             * than hidden. Somebody looking for the agency they signed up with
             * needs to see that it is there and why it will not open — an
             * absent entry reads as "we lost your account".
             */
            const blocked = !entry.is_active
              ? 'Your account here is not active'
              : entry.company_status === 'suspended' ? 'This company is suspended' : null;
            return (
              <button
                key={entry.account_id}
                type="button"
                disabled={loading || Boolean(blocked)}
                onClick={() => chooseCompany(entry.company_id)}
                className="w-full rounded-2xl border border-[#2B3350] bg-[#161B2C] px-4 py-3.5 text-left transition hover:border-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="block text-[15px] font-semibold">{entry.company_name}</span>
                <span className="mt-0.5 block text-[13px] text-[#A6ADBD]">
                  {blocked || `Signed in as ${entry.type}`}
                </span>
              </button>
            );
          })}
          {errorLine}
          {backButton(resetToCredentials)}
        </div>
      )}

      {authStep === '2fa' && (
        <form onSubmit={submit2FA} className="space-y-4">
          <AuthField
            id="totp"
            label="Authentication code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="123456"
            value={totpToken}
            onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            autoFocus
            inputClassName="text-center font-mono text-xl tracking-[0.4em]"
          />
          {errorLine}
          <button type="submit" disabled={loading} className={primaryButton} style={primaryInk}>
            {loading ? 'Verifying…' : 'Verify code'}
          </button>
          {backButton(resetToCredentials)}
        </form>
      )}

      {/* Forced 2FA setup — QR code step */}
      {authStep === '2fa-setup' && (
        <div className="space-y-4">
          {loading && <p className="text-sm text-[#A6ADBD]">Generating QR code…</p>}
          {!loading && setupData && (
            <>
              <div className="flex justify-center">
                <img src={setupData.qrCodeUrl} alt="2FA QR code" className="h-44 w-44 rounded-xl bg-white p-2" />
              </div>
              <p className="text-center text-xs text-[#A6ADBD]">
                Can’t scan? Use code: <span className="font-mono text-[#F3F1EC]">{setupData.secret}</span>
              </p>
              {errorLine}
              <button
                type="button"
                onClick={() => { setAuthStep('2fa-setup-verify'); setTotpToken(''); setError(''); }}
                className={primaryButton}
                style={primaryInk}
              >
                I’ve scanned the code
              </button>
              {backButton(resetToCredentials)}
            </>
          )}
        </div>
      )}

      {/* Forced 2FA setup — verify step */}
      {authStep === '2fa-setup-verify' && (
        <form onSubmit={submitForcedSetupVerify} className="space-y-4">
          <AuthField
            id="totp-setup"
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="123456"
            value={totpToken}
            onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            autoFocus
            inputClassName="text-center font-mono text-xl tracking-[0.4em]"
          />
          {errorLine}
          <button type="submit" disabled={loading} className={primaryButton} style={primaryInk}>
            {loading ? 'Confirming…' : 'Confirm & Sign In'}
          </button>
          {backButton(() => setAuthStep('2fa-setup'), 'Back to QR code')}
        </form>
      )}
    </>
  );

  const footer = (
    <>
      {authStep === 'credentials' && (
        <p>
          {greeting
            ? <>Signing in somewhere else? <button type="button" onClick={notYou} className="font-bold text-[#E9D8C4] hover:underline">Use another account</button></>
            : <>New{companyName ? ` to ${companyName}` : ' here'}? <Link to={registerHref} className="font-bold text-[#E9D8C4] hover:underline">Create an account</Link></>}
        </p>
      )}
      <p className="text-xs text-[#7C8497]">
        Secure &amp; encrypted · © {new Date().getFullYear()} {app_name || 'Realx8'} ·{' '}
        <a href="mailto:support@realto.app" className="text-[#A6ADBD] hover:text-white">Get help</a>
      </p>
    </>
  );

  return (
    <>
      <AuthShell
        brand={<AuthBrand company={company || (greeting?.company_name ? { name: greeting.company_name } : null)} />}
        aside={<ShowcasePanel properties={properties} />}
        mobileTop={(
          <div className="relative h-64">
            <ShowcasePanel properties={properties} compact />
            <div className="absolute left-5 top-5 z-20 rounded-2xl bg-[rgba(14,18,32,0.7)] px-3 py-2">
              <AuthBrand company={company || (greeting?.company_name ? { name: greeting.company_name } : null)} />
            </div>
          </div>
        )}
        footer={footer}
      >
        {content}
      </AuthShell>

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
            <p className="text-xs text-slate-400">We’ll send a 6-digit code to this email.</p>
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
              Didn’t receive it? Resend OTP
            </button>
          </form>
        )}

        {/* Step 3: New password */}
        {(forgotStep === 'reset' || forgotStep === 'done') && (
          <form onSubmit={submitPasswordReset} className="space-y-4">
            {/*
              Which company this password is for.
              A password belongs to one company account now, so resetting
              without saying which would change them all — and somebody who has
              forgotten the password for one company has not asked to have the
              others changed. Shown only when there is a genuine choice; "All of
              them" stays available for whoever has lost track of the lot.
            */}
            {resetCompanies.length > 1 && (
              <Select
                label="Which company is this password for?"
                value={forgotForm.company_id}
                onChange={(e) => setForgotForm((c) => ({ ...c, company_id: e.target.value }))}
                options={[
                  { value: 'all', label: 'All of them' },
                  ...resetCompanies.map((entry) => ({
                    value: String(entry.company_id),
                    label: entry.company_name,
                  })),
                ]}
              />
            )}
            <Field
              light
              label="New password"
              type="password"
              value={forgotForm.password}
              onChange={(e) => setForgotForm((c) => ({ ...c, password: e.target.value }))}
              placeholder={PASSWORD_HINT}
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

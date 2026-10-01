import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Home, UserCheck } from 'lucide-react';
import { register } from '../../api/authApi';
import { listRoles } from '../../api/rolesApi';
import useAuthStore from '../../store/authStore';
import useSharedBrand from '../../hooks/useSharedBrand';
import useCompanyCode from '../../hooks/useCompanyCode';
import {
  resolveReferralAttribution,
  saveReferralAttribution,
  clearReferralAttribution,
} from '../../utils/referralAttribution';
import { useAppearance } from '../../context/useAppearance';
import { googleAuthUrl } from '../../utils/googleAuthUrl';
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from '../../constants/password';
import {
  AsidePanel, AuthBrand, AuthField, AuthShell, PasswordField, PasswordStrength, ghostButton, primaryButton, primaryInk,
} from '../../components/auth/AuthKit';

/**
 * Creating an account, in two steps: which company and what for, then who you
 * are.
 *
 * The company is settled first because everything else depends on it. From an
 * invite link it is already known (and locked — a visitor must never be able
 * to type over the company or realtor a link established); without one, the
 * code is checked as it is typed and the company's name and logo come back to
 * confirm it, instead of a five-character field the server rejects only after
 * the whole form has been filled in.
 */

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

/** What each public profile is for, in the words of somebody choosing one. */
const ROLE_COPY = {
  client: {
    title: "I'm buying",
    body: 'Browse listings, buy outright or in installments, and keep your receipts and documents in one place.',
    icon: Home,
    aside: {
      kicker: 'For buyers',
      title: 'Own a home on terms that suit you.',
      points: ['Pay outright or over a monthly plan', 'Your unit is secured once you pay', 'Receipts and title documents, always to hand'],
    },
  },
  realtor: {
    title: "I'm a realtor",
    body: 'Share listings with your own link, refer clients and track the commission you earn.',
    note: 'You will verify your identity before you can refer clients.',
    icon: UserCheck,
    aside: {
      kicker: 'For realtors',
      title: 'Your listings, your link, your commission.',
      points: ['A personal share link for every property', 'See how often your links are opened', 'Request payouts when commission is due'],
    },
  },
};

const NEXT_STEPS = [
  ['You are signed in straight away', 'In your company’s colours, on its listings.'],
  ['Pick a unit and a way to pay', 'Outright, or a monthly plan where one is offered.'],
  ['Pay and upload your proof', 'Receipts and documents land in My Properties.'],
];

/** Waits for typing to pause before a code is looked up — one request per code, not per key. */
const useDebounced = (value, ms = 400) => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  // Set when the visitor arrived from a shared property while trying to buy.
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  /*
   * A buyer mid-purchase: they pressed Purchase on a shared property. The
   * company is known from the link and the reason is buying, so the first
   * step has nothing to ask — they go straight to their details, as a client,
   * and the new account lands on the purchase screen (`redirect`). Purchase,
   * Create account, choose the unit: three clicks.
   */
  const buyingNow = searchParams.get('intent') === 'purchase';
  // Arriving from a shared link. A sealed `?ref=` token also brands this page
  // for the company that shared it; the hook still honours the older plain
  // `company_code` / `code` / `realtor_code` parameters.
  const {
    company: sharedCompanyName,
    companyCode: presetCompanyCode,
    realtorCode: referringRealtorCode,
    realtorName: referringRealtorName,
    loading: resolvingSealedLink,
    hasSealedLink,
  } = useSharedBrand();
  /**
   * The plain codes/names a referral link now always carries (see
   * ReferralLinkPanel / ReferralCodeCard), merged with whatever a previous
   * page load already stored — so a refresh that, for whatever reason,
   * arrives with no query string at all still has what an earlier load on
   * this browser established. Computed once, synchronously, on first render:
   * it has to be ready before the form's initial state is built, not after.
   */
  const [attribution] = useState(() => resolveReferralAttribution());
  const referralCompanyCode = attribution.company_code || null;
  const referralRealtorCode = attribution.realtor_code || null;
  const referralRealtorName = attribution.realtor_name || referringRealtorName || null;
  const referralCompanyName = attribution.company_name || sharedCompanyName || null;
  // Locked whenever ANY attribution source — this load's URL, a resolved
  // sealed token, or a prior load's storage — says who this visitor belongs
  // to. A visitor should never be able to type over a code that was already
  // established for them; that would silently discard the referral.
  const isCompanyCodeLocked = !!(presetCompanyCode || referralCompanyCode);
  const isRealtorLinked = !!(referringRealtorCode || referralRealtorCode);
  const setSession = useAuthStore((state) => state.setSession);
  // Someone can reach this form while still signed in — a referral link is an
  // explicit request to create a new account, so the route allows it. Say what
  // will happen rather than silently swapping their session on submit.
  const signedInAs = useAuthStore((state) => state.user);
  const signedInName = useAuthStore((state) => state.accessToken) ? (signedInAs?.name || signedInAs?.email || null) : null;
  const { app_name, refresh: refreshAppearance } = useAppearance();
  const [roles, setRoles] = useState([]);
  // Skipped straight to details for a buyer whose company the link already settled.
  const [step, setStep] = useState(() => (buyingNow && isCompanyCodeLocked ? 'details' : 'company')); // 'company' | 'details'
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirm: '',
    role: 'client', // and always client for a buyer mid-purchase (buyingNow): see the role step
    company_code: (() => {
      const q = new URLSearchParams(window.location.search);
      const fromUrl = (q.get('company_code') || q.get('code') || '').toUpperCase();
      return fromUrl || (referralCompanyCode || '').toUpperCase();
    })(),
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listRoles().then((response) => setRoles(response.data || [])).catch(() => setRoles([]));
  }, []);

  // A sealed link resolves over the network, so the code arrives after the
  // form's initial state was built from the URL. Sync it when it lands, and
  // save it — server-confirmed data is worth persisting too, in case a later
  // refresh has no ref token to re-resolve.
  useEffect(() => {
    if (!presetCompanyCode) return;
    setForm((prev) => (prev.company_code === presetCompanyCode
      ? prev
      : { ...prev, company_code: presetCompanyCode }));
    saveReferralAttribution({
      company_code: presetCompanyCode,
      company_name: sharedCompanyName || undefined,
      realtor_code: referringRealtorCode || undefined,
      realtor_name: referringRealtorName || undefined,
    });
  }, [presetCompanyCode, sharedCompanyName, referringRealtorCode, referringRealtorName]);

  /*
   * The company behind the code, checked as it is typed (or once, for a code
   * the link supplied) — its name and logo confirm it, and the page takes on
   * its colours. Five characters is the shortest code there is, so nothing
   * shorter is sent.
   */
  const typedCode = useDebounced(form.company_code.trim());
  const lookupCode = isCompanyCodeLocked ? form.company_code : (typedCode.length >= 5 ? typedCode : '');
  const lookup = useCompanyCode(lookupCode, { brand: !hasSealedLink });
  const companyName = lookup.company?.name || referralCompanyName || null;
  const companyConfirmed = isCompanyCodeLocked || lookup.status === 'found';

  const roleOptions = useMemo(
    () => roles
      .filter((role) => PUBLIC_ROLE_NAMES.includes(role.name))
      // Buyers first: most people signing up are buying.
      .sort((a, b) => PUBLIC_ROLE_NAMES.indexOf(a.name) - PUBLIC_ROLE_NAMES.indexOf(b.name))
      .map((role) => ({ value: role.name, label: role.display_name || role.name })),
    [roles]
  );
  const resolvedRoleOptions = roleOptions.length ? roleOptions : [{ value: 'client', label: 'Client' }];
  const roleCopy = ROLE_COPY[form.role] || ROLE_COPY.client;

  const waitingForInvite = hasSealedLink && resolvingSealedLink && !referralRealtorCode && !referralCompanyCode;
  const mismatch = Boolean(form.confirm) && form.confirm !== form.password;

  const continueToDetails = (event) => {
    event.preventDefault();
    if (!form.company_code.trim()) { setError('Enter your company code to continue.'); return; }
    if (!companyConfirmed && lookup.status === 'missing') { setError('No company uses that code. Check it, or ask for an invite link.'); return; }
    setError('');
    setStep('details');
  };

  const submit = async (event) => {
    event.preventDefault();
    /**
     * Older links (or a sealed `?ref=` that a caller opened without any
     * plain-param fallback yet in circulation) still depend on the network
     * response `useSharedBrand` is fetching. Only block on that when there is
     * truly nothing else to go on — if the plain codes already resolved
     * `referralRealtorCode`/`referralCompanyCode` (from the URL or from a
     * prior page load's storage), submitting need not wait on the sealed
     * token at all: it exists solely to confirm branding at this point, and
     * attribution is already secured.
     */
    if (waitingForInvite) {
      setError('Still preparing your invite — please try again in a moment.');
      return;
    }
    if (mismatch) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const realtorCode = referringRealtorCode || referralRealtorCode;
      const { confirm: _confirm, ...fields } = form;
      const response = await register({
        ...fields,
        type: form.role,
        role: form.role,
        ...(realtorCode ? { realtor_code: realtorCode } : {}),
      });
      setSession(response);
      // The referral has done its job — an account now exists carrying it
      // server-side. Clearing storage stops it from being replayed onto a
      // second, unrelated sign-up later on the same browser.
      clearReferralAttribution();
      // The session carries its company's look; only an older server needs the read.
      if (!response.appearance) await refreshAppearance();
      navigate(redirectTo || '/');
    } catch (err) {
      /*
       * userMessage, not data.message: a short password comes back as a 422
       * whose top-level message is the word "Validation failed" and whose
       * useful sentence is in errors[0]. extractError knows to prefer it.
       */
      setError(err.userMessage || 'Unable to register');
    } finally {
      setLoading(false);
    }
  };

  const linkClass = 'font-bold text-[#E9D8C4] hover:underline';
  const errorLine = error && <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200 ring-1 ring-rose-400/30" role="alert">{error}</p>;

  const progress = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs text-[#A6ADBD]">
        {step === 'details' ? (
          <button type="button" onClick={() => { setStep('company'); setError(''); }} className="-ml-1 flex items-center gap-1.5 py-2 font-semibold text-[#E9D8C4]">
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
        ) : <span>Create your account</span>}
        <span>Step {step === 'company' ? 1 : 2} of 2{step === 'details' && companyName ? ` · ${form.role === 'realtor' ? 'Selling' : 'Buying'} with ${companyName}` : ''}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5" aria-hidden="true">
        <span className="h-1 rounded-full bg-primary" />
        <span className={`h-1 rounded-full ${step === 'details' ? 'bg-primary' : 'bg-[#262D44]'}`} />
      </div>
    </div>
  );

  const signedInNotice = signedInName && (
    <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-200 ring-1 ring-amber-400/30">
      You are signed in as <span className="font-semibold">{signedInName}</span>. Creating an account
      here will sign you out of that one.
      <button type="button" onClick={() => navigate('/')} className="ml-1 font-semibold underline underline-offset-2">
        Go back instead
      </button>
    </div>
  );

  const companyStep = (
    <form onSubmit={continueToDetails} className="space-y-6">
      {isCompanyCodeLocked ? (
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 px-4 py-3.5 ring-1 ring-emerald-400/40">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
          <p className="text-sm text-[#D5D9E2]">
            You&apos;re joining <strong className="text-[#F3F1EC]">{companyName || 'the company that shared this link'}</strong>
            {isRealtorLinked && (
              <>, invited by <strong className="text-[#F3F1EC]">{referralRealtorName || referringRealtorCode || referralRealtorCode}</strong></>
            )}
            . No company code needed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AuthField
            id="company-code"
            label="Company code"
            value={form.company_code}
            onChange={(e) => setForm({ ...form, company_code: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '') })}
            placeholder="e.g. AB12C"
            required
            autoComplete="off"
            autoCapitalize="characters"
            inputClassName="font-semibold tracking-[0.12em]"
            aria-describedby="company-code-status"
          />
          <div id="company-code-status" aria-live="polite">
            {lookup.status === 'found' && lookup.company && (
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 p-3.5 ring-1 ring-emerald-400/40">
                <AuthBrand company={lookup.company} />
                <CheckCircle2 size={20} className="ml-auto shrink-0 text-emerald-300" aria-hidden="true" />
              </div>
            )}
            {lookup.status === 'missing' && (
              <p className="rounded-2xl bg-rose-500/10 p-3.5 text-sm text-rose-200 ring-1 ring-rose-400/30">
                No company uses <strong>{lookupCode}</strong>. Check the code, or ask your realtor for their invite link, which fills this in for you.
              </p>
            )}
            {lookup.status === 'loading' && <p className="text-xs text-[#A6ADBD]">Checking the code…</p>}
            {lookup.status === 'idle' && (
              <p className="text-xs text-[#A6ADBD]">No code? Ask your company or realtor for an invite link — it fills this in for you.</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h1 className="text-xl font-semibold leading-tight">
          How will you use {companyName || app_name || 'your account'}?
        </h1>
        <p className="text-sm text-[#A6ADBD]">You can add the other profile later from your account.</p>
      </div>

      <div role="radiogroup" aria-label="Account type" className="space-y-3">
        {resolvedRoleOptions.filter((option) => !buyingNow || option.value === 'client').map((option) => {
          const copy = ROLE_COPY[option.value] || { title: option.label, body: '', icon: Home };
          const selected = form.role === option.value;
          const Icon = copy.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setForm({ ...form, role: option.value })}
              className={`flex w-full items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition ${selected ? 'border-[color:var(--primary)] bg-[#161B2C]' : 'border-[#2B3350] hover:border-[#3B4566]'}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#262D44]">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="flex flex-1 flex-col gap-1">
                <span className="text-base font-bold">{copy.title}</span>
                {copy.body && <span className="text-sm leading-relaxed text-[#A6ADBD]">{copy.body}</span>}
                {selected && copy.note && <span className="mt-1 text-xs text-amber-300">{copy.note}</span>}
              </span>
              <span className={`mt-1 h-5 w-5 shrink-0 rounded-full ${selected ? 'border-[6px] border-[color:var(--primary)]' : 'border-2 border-[#56607A]'}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {errorLine}
      <button type="submit" className={primaryButton} style={primaryInk} disabled={!isCompanyCodeLocked && lookup.status !== 'found'}>
        Continue
      </button>
    </form>
  );

  const detailsStep = (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold leading-tight">Create your account</h1>
        {buyingNow && (
          <p className="text-sm text-[#A6ADBD]">
            You&apos;ll be signed in straight away and taken back to choose your unit
            {companyName ? ` with ${companyName}` : ''}.
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField
          id="reg-name"
          label="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Jane Doe"
          required
          autoComplete="name"
        />
        <AuthField
          id="reg-phone"
          label="Phone"
          note="(for payment reminders)"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+234 800 000 0000"
          autoComplete="tel"
        />
      </div>
      <AuthField
        id="reg-email"
        label="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <PasswordField
        id="reg-password"
        label="Password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        placeholder={PASSWORD_HINT}
        minLength={MIN_PASSWORD_LENGTH}
        required
        autoComplete="new-password"
        hint={<PasswordStrength password={form.password} />}
      />
      <PasswordField
        id="reg-confirm"
        label="Confirm password"
        value={form.confirm}
        onChange={(e) => setForm({ ...form, confirm: e.target.value })}
        required
        autoComplete="new-password"
        invalid={mismatch}
        hint={mismatch
          ? <p className="text-xs text-rose-300">The two passwords don&apos;t match yet.</p>
          : (form.confirm && <p className="text-xs text-emerald-300">Passwords match.</p>)}
      />

      {errorLine}

      <button type="submit" disabled={loading || waitingForInvite || mismatch} className={primaryButton} style={primaryInk}>
        {loading ? 'Creating account…' : (waitingForInvite ? 'Preparing your invite…' : (buyingNow ? 'Create account and continue' : 'Create account'))}
      </button>

      {/*
        Same control as the sign-in page, and the same endpoint: /auth/google
        creates the account on first use, so one route serves both. An <a>
        rather than a button because this is a full-page redirect the browser
        must follow, not something fetch can do.
      */}
      <a
        href={googleAuthUrl({
          companyCode: form.company_code || presetCompanyCode || referralCompanyCode,
          realtorCode: referringRealtorCode || referralRealtorCode,
          redirect: redirectTo,
        })}
        className={ghostButton}
      >
        <GoogleIcon />
        Sign up with Google instead
      </a>
    </form>
  );

  const aside = step === 'company' ? (
    <AsidePanel kicker={roleCopy.aside.kicker} title={roleCopy.aside.title}>
      <ul className="space-y-3">
        {roleCopy.aside.points.map((point) => (
          <li key={point} className="flex items-center gap-3 rounded-2xl bg-[rgba(14,18,32,0.7)] px-4 py-3.5 text-sm text-[#D5D9E2]">
            <CheckCircle2 size={18} className="shrink-0 text-[color:var(--primary)]" aria-hidden="true" /> {point}
          </li>
        ))}
      </ul>
    </AsidePanel>
  ) : (
    <AsidePanel kicker="What happens next">
      <ol className="space-y-3">
        {NEXT_STEPS.map(([title, body], index) => (
          <li key={title} className="flex gap-3.5 rounded-2xl bg-[rgba(14,18,32,0.7)] p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold" style={primaryInk}>{index + 1}</span>
            <span className="flex flex-col gap-1">
              <strong className="text-sm">{title}</strong>
              <span className="text-sm text-[#A6ADBD]">{body}</span>
            </span>
          </li>
        ))}
      </ol>
    </AsidePanel>
  );

  return (
    <AuthShell
      wide
      brand={<AuthBrand company={lookup.company || (companyName ? { name: companyName } : null)} />}
      aside={aside}
      footer={(
        <>
          <p>
            Already have an account?{' '}
            <Link
              to={`${form.company_code && companyConfirmed ? `/login/${encodeURIComponent(form.company_code)}` : '/login'}${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
              className={linkClass}
            >
              Sign in{buyingNow ? ' to buy' : ''}
            </Link>
          </p>
          <p className="text-xs text-[#7C8497]">
            Secure &amp; encrypted · © {new Date().getFullYear()} {app_name || 'Platform'} ·{' '}
            <Link to={form.company_code && companyConfirmed ? `/help?c=${encodeURIComponent(form.company_code)}` : '/help'} className="text-[#A6ADBD] hover:text-white">Get help</Link>
          </p>
        </>
      )}
    >
      {signedInNotice}
      {progress}
      {step === 'company' ? companyStep : detailsStep}
    </AuthShell>
  );
}

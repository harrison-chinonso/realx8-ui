import { useEffect, useState } from 'react';
import { acceptTerms, getTerms, getTermsStatus } from '../../api/legalApi';
import useAuthStore from '../../store/authStore';
import TermsDocument from './TermsDocument';
import TermsConsent, { EMPTY_CONSENT, consentComplete } from './TermsConsent';

/**
 * Asks a signed-in realtor or client to agree to the Terms of Use and Privacy
 * Policy when they have not agreed to the version that needs it: an account
 * created before the terms existed, a material update (clause 67.2), or a
 * first sign-up through Google, whose account is created on Google's return.
 *
 * For that last case the boxes ticked on the sign-up page travel through the
 * Google redirect in sessionStorage (PENDING_KEY), and are recorded here the
 * moment the person lands — so they agree once, before the account was made,
 * and are not asked again. Everyone else (staff, platform admins) is never
 * asked; the server says so.
 */
export const PENDING_KEY = 'rx-pending-terms-consent';

export const rememberPendingConsent = (versionId, consent) => {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ version_id: versionId, ...consent })); } catch { /* no storage */ }
};

const takePendingConsent = () => {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function TermsGate() {
  const token = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const [status, setStatus] = useState(null);
  const [terms, setTerms] = useState(null);
  const [consent, setConsent] = useState(EMPTY_CONSENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      const current = await getTermsStatus().catch(() => null);
      if (cancelled || !current?.required) { if (!cancelled) setStatus(current); return; }
      // Ticked on the sign-up page before a Google redirect: record it now.
      const pending = takePendingConsent();
      if (pending && Number(pending.version_id) === Number(current.current?.id) && consentComplete(pending)) {
        const ok = await acceptTerms({
          version_id: pending.version_id, accept_terms: true, accept_privacy: true,
          marketing_opt_in: Boolean(pending.marketing), context: 'google_signup',
        }).then(() => true, () => false);
        if (ok) { if (!cancelled) setStatus({ ...current, required: false }); return; }
      }
      const text = await getTerms().catch(() => null);
      if (!cancelled) { setTerms(text); setStatus(current); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (!status?.required) return null;

  const agree = async () => {
    if (!consentComplete(consent) || !terms) return;
    setBusy(true);
    setError('');
    try {
      await acceptTerms({
        version_id: terms.id, accept_terms: true, accept_privacy: true, marketing_opt_in: consent.marketing,
      });
      setStatus({ ...status, required: false });
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === 'TERMS_CHANGED') {
        // Replaced while open: show the new version and ask again.
        setTerms(await getTerms().catch(() => terms));
        setConsent(EMPTY_CONSENT);
      }
      setError(data?.message || err?.userMessage || 'Could not record your agreement. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const updated = Boolean(status.accepted);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl">
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <h2 id="terms-gate-title" className="text-base font-semibold text-slate-900">
            {updated ? 'We have updated our Terms of Use and Privacy Policy' : 'Please review our Terms of Use and Privacy Policy'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {updated
              ? 'Please read the updated agreement and confirm you agree to continue using Realx8.'
              : 'Before you continue, please read the agreement and confirm you agree.'}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {terms ? <TermsDocument terms={terms} /> : <p className="text-sm text-slate-500">Loading…</p>}
        </div>
        <div className="shrink-0 space-y-4 border-t border-slate-100 px-5 py-4">
          <TermsConsent
            value={consent}
            onChange={setConsent}
            disabled={busy}
            onRead={(section) => document.getElementById(section)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
          />
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={logout} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Sign out
            </button>
            <button
              type="button"
              onClick={agree}
              disabled={busy || !consentComplete(consent) || !terms}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: 'var(--primary-ink, #fff)' }}
            >
              {busy ? 'Saving…' : 'I agree'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

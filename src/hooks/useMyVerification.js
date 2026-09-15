import { useEffect, useState } from 'react';
import { getMyKyc } from '../api/userApi';
import useAuthStore from '../store/authStore';

/**
 * Whether the signed-in realtor has been verified.
 *
 * ── Why the screens ask at all ──────────────────────────────────────────────
 *
 * The server already refuses an unverified realtor a payout, a share link and a
 * referral — that is the boundary, and it holds whatever the browser does. This
 * is not a second gate; it is so the buttons do not lie. Offering "Request
 * payout" to somebody who will be refused wastes their click and teaches them
 * that the application is broken rather than that they have something to do.
 *
 * ── Asked once per sign-in ──────────────────────────────────────────────────
 *
 * Verification changes when an administrator reviews it, which is not during a
 * page transition — so this is fetched once and shared, rather than by each of
 * the three screens that need it. The dependency is the BOOLEAN of being signed
 * in, not the token: depending on the token turns one 401 into a refresh loop,
 * which this codebase has already been bitten by once on the assistant widget.
 *
 * ── Unknown is not unverified ───────────────────────────────────────────────
 *
 * A failed request returns `status: null` and `loading: false`, and callers
 * treat that as "do not know" rather than "not verified". Hiding somebody's
 * payout button because a request timed out would be the application inventing
 * a restriction nobody applied — and the server is still there to refuse the
 * click if it really should be refused.
 */
export default function useMyVerification() {
  const token = useAuthStore((s) => s.accessToken);
  const isRealtor = useAuthStore((s) => s.effectiveType()) === 'realtor';
  const signedIn = Boolean(token);

  const [state, setState] = useState({ loading: true, status: null, known: false });

  useEffect(() => {
    if (!signedIn || !isRealtor) {
      setState({ loading: false, status: null, known: false });
      return undefined;
    }
    let cancelled = false;
    getMyKyc()
      .then((response) => {
        if (cancelled) return;
        // No submission at all is a real answer, not a failure: it means they
        // have not started, which is exactly what the screens need to say.
        const record = response?.data ?? response ?? null;
        setState({ loading: false, status: record?.status ?? 'none', known: true });
      })
      .catch(() => { if (!cancelled) setState({ loading: false, status: null, known: false }); });
    return () => { cancelled = true; };
  }, [signedIn, isRealtor]);

  return {
    ...state,
    isRealtor,
    verified: state.status === 'approved',
    /**
     * The one a screen should branch on. False while loading and when the
     * answer could not be fetched, so a button is never hidden on a guess —
     * only on a known "no".
     */
    blocked: isRealtor && state.known && state.status !== 'approved',
  };
}

import { useEffect, useState } from 'react';
import { createShareToken } from '../api/shareApi';
import useAuthStore from '../store/authStore';

/**
 * The signed-in user's sealed share token, fetched once.
 *
 * Every panel that hands out a link — company sign-up code, realtor referral,
 * property share — needs the same token, and it depends only on who is signed
 * in, so it is fetched here rather than three times over.
 *
 * `ready` distinguishes "still fetching" from "cannot be minted". Callers must
 * not build a link until it is true, or a user who copies quickly gets the
 * unbranded fallback.
 *
 * A PLATFORM ADMIN has no company of their own, so a *branded* token is
 * ambiguous — whose branding? The endpoint answers 400 and says to name a
 * company, which is correct. The request is therefore not made at all in that
 * case: it used to fire on every page load and fail, so the console and network
 * tab showed a 400 on the Clients and Realtors pages that looked like a fault
 * but was the API declining an impossible question.
 *
 * Pass `companyId` where the caller does know which company — a platform admin
 * on a company-scoped screen — and a real branded token is minted.
 */
export function useShareToken(companyId = null) {
  const [token, setToken] = useState(null);
  /**
   * The short code, which is what links should actually carry.
   *
   * `token` is the sealed ~200-character payload the links used to use. It is
   * still returned by the API so that a client which has not been updated keeps
   * working, and it is still honoured when resolving, but nothing new should
   * build a URL out of it: pasted into WhatsApp it was long enough that people
   * hesitated to send it.
   */
  const [code, setCode] = useState(null);
  const [ready, setReady] = useState(false);
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const ownCompanyId = useAuthStore((s) => s.company_id);

  // Which company the token would be for. A platform admin has none of their
  // own, so only an explicitly supplied one counts.
  const scope = companyId ?? (isSuperiorAdmin ? null : ownCompanyId);

  useEffect(() => {
    let cancelled = false;

    if (!scope) {
      // Nothing to mint against. Resolve as "no token" without a round trip;
      // the panels fall back to plain-code links.
      setToken(null);
      setCode(null);
      setReady(true);
      return undefined;
    }

    setReady(false);
    createShareToken(isSuperiorAdmin ? { company_id: scope } : undefined)
      .then((data) => {
        if (cancelled) return;
        setToken(data?.token || null);
        setCode(data?.code || null);
      })
      // Can still fail — a suspended company, a deleted one. The panels fall
      // back to plain-code links.
      .catch(() => { if (!cancelled) { setToken(null); setCode(null); } })
      .finally(() => { if (!cancelled) setReady(true); });

    return () => { cancelled = true; };
  }, [scope, isSuperiorAdmin]);

  return { token, code, ready };
}

export default useShareToken;

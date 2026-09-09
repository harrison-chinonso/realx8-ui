import { useEffect, useState } from 'react';
import { createShareToken } from '../api/shareApi';

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
 */
export function useShareToken() {
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createShareToken()
      .then((data) => { if (!cancelled) setToken(data?.token || null); })
      // Minting can legitimately fail — a platform admin has no company of
      // their own. The panels fall back to plain-code links.
      .catch(() => { if (!cancelled) setToken(null); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  return { token, ready };
}

export default useShareToken;

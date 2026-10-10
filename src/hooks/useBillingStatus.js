import { useEffect } from 'react';
import useAuthStore from '../store/authStore';
import useBillingStore from '../store/billingStore';
import { BILLING_ADMIN_TYPES } from '../utils/billing';

/**
 * The company's subscription status, fetched once per session and re-read on
 * window focus when it is more than five minutes old.
 *
 * Safe to call from as many components as like: the request lives in
 * billingStore, so a second caller shares the first one's answer.
 *
 * `enabled` is the gate. When the server's flag is off it is false and every
 * caller draws nothing — no nav item, no banner, no page content.
 */
export default function useBillingStatus() {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const status = useBillingStore((state) => state.status);
  const storeKey = useBillingStore((state) => state.key);
  const fetchedAt = useBillingStore((state) => state.fetchedAt);
  const inflight = useBillingStore((state) => state.inflight);
  const load = useBillingStore((state) => state.load);
  const refreshIfStale = useBillingStore((state) => state.refreshIfStale);

  // The account, not the token: a token refresh is the same account and must
  // not cost a request, while switching company is a different one.
  const key = token && user ? `${user.id}:${user.company_id ?? ''}` : null;

  useEffect(() => { load(key); }, [key, load]);

  /*
   * Loading until THIS account's answer is in. On the first render the store
   * has not even been asked yet (the effect above runs after it), and reading
   * that as "not loading, not enabled" sent /billing straight back to the
   * dashboard before the status arrived.
   */
  const loading = Boolean(key) && (storeKey !== key || !fetchedAt || Boolean(inflight));

  useEffect(() => {
    if (!key) return undefined;
    window.addEventListener('focus', refreshIfStale);
    return () => window.removeEventListener('focus', refreshIfStale);
  }, [key, refreshIfStale]);

  const enabled = status?.enabled === true;
  return {
    ...(status || {}),
    enabled,
    loading,
    // Only a company account has a subscription; platform staff get 'platform'.
    isCompanyUser: enabled && !isSuperiorAdmin && status?.status !== 'platform' && status?.status !== 'off',
    isBillingAdmin: enabled && !isSuperiorAdmin && BILLING_ADMIN_TYPES.includes(user?.type),
    refresh: () => load(key, { force: true }),
  };
}

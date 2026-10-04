import { useEffect, useState } from 'react';
import { companyShowcase, lookupCompanyCode } from '../api/shareApi';
import { useAppearance } from '../context/useAppearance';

/**
 * A company code → the company, its look, and (optionally) its showcase.
 *
 * Powers the branded sign-in page (/login/<code>) and the sign-up form's
 * live code check. With `brand`, a found company's colours, logo and fonts are
 * applied to the page at once, the way a share link brands the page it opens.
 * Both requests are cached on the server and public by design: a company code
 * is what its staff hand out.
 *
 * status: 'idle' (no code) | 'loading' | 'found' | 'missing'
 */
export default function useCompanyCode(code, { brand = true, showcase = false } = {}) {
  const { applyBrand, releaseBrand } = useAppearance();
  const normalized = String(code || '').trim().toUpperCase();
  const [state, setState] = useState({ status: normalized ? 'loading' : 'idle', company: null, properties: [] });

  useEffect(() => {
    if (!normalized) {
      setState({ status: 'idle', company: null, properties: [] });
      return undefined;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, status: 'loading' }));
    lookupCompanyCode(normalized)
      .then((data) => {
        if (cancelled || !data?.company) return;
        if (brand && data.branding) applyBrand(data.branding, { code: normalized });
        setState((prev) => ({ ...prev, status: 'found', company: { ...data.company, logo: data.branding?.app_logo || null } }));
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ status: 'missing', company: null, properties: [] });
        // No such company: the page falls back to the platform's look. Only on
        // a real "not found" — a network blip must not repaint a company's page.
        if (brand && error?.response?.status === 404) releaseBrand?.();
      });
    if (showcase) {
      companyShowcase(normalized)
        .then((data) => { if (!cancelled) setState((prev) => ({ ...prev, properties: data?.properties || [] })); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [normalized, brand, showcase, applyBrand, releaseBrand]);

  return state;
}

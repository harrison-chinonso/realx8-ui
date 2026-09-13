import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { resolveShareToken } from '../api/shareApi';
import { useAppearance } from '../context/useAppearance';

/**
 * Reads the `?ref=` sealed token on a public page and brands the page for the
 * company that shared it.
 *
 * Used by the sign-up and public property pages, the two places a prospect can
 * land without an account. Both need the same three things — company name,
 * colours, and who to attribute the referral to — so the logic lives here once.
 *
 * Links shared before this existed carried the codes as plain query parameters.
 * Those still work: `company_code` / `realtor_code` on sign-up, `c` / `r` on a
 * property link. They simply cannot brand the page, because a plain code in a
 * URL is editable and could be pointed at any company.
 */
/**
 * @param {string|null} codeFromPath  a share code that arrived in the PATH
 *        rather than in `?ref=`. A shared property is now `/p/K7M2QXV` and
 *        nothing else, so the code that brands the page is the same code that
 *        names the property — there is no query parameter left to read it from.
 */
export function useSharedBrand(codeFromPath = null) {
  const [searchParams] = useSearchParams();
  const { applyBrand } = useAppearance();

  // An explicit `?ref=` wins: it is the more specific statement of who shared
  // this, and a link may legitimately carry both.
  const ref = searchParams.get('ref') || codeFromPath || null;
  const [state, setState] = useState({
    loading: !!ref,
    company: null,
    companyCode: null,
    realtorCode: null,
    realtorName: null,
  });

  useEffect(() => {
    if (!ref) return undefined;
    let cancelled = false;

    resolveShareToken(ref)
      .then((data) => {
        if (cancelled || !data) return;
        applyBrand(data.branding);
        setState({
          loading: false,
          company: data.company?.name || null,
          companyCode: data.company?.code || null,
          realtorCode: data.realtor?.code || null,
          realtorName: data.realtor?.name || null,
        });
      })
      // A revoked, expired or tampered link should still let the visitor sign
      // up — it just falls back to unbranded, with no attribution.
      .catch(() => { if (!cancelled) setState((s) => ({ ...s, loading: false })); });

    return () => { cancelled = true; };
  }, [ref, applyBrand]);

  // Plain-parameter links keep working for attribution, without branding.
  const fallbackCompany = (searchParams.get('company_code') || searchParams.get('code') || searchParams.get('c') || '').toUpperCase();
  const fallbackRealtor = (searchParams.get('realtor_code') || searchParams.get('r') || '').toUpperCase();

  return {
    ...state,
    companyCode: state.companyCode || fallbackCompany || null,
    realtorCode: state.realtorCode || fallbackRealtor || null,
    hasSealedLink: !!ref,
  };
}

export default useSharedBrand;

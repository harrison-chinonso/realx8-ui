import { apiUrl } from '../api/apiBase';

/**
 * Where "Continue with Google" should send somebody.
 *
 * ── Why the codes have to be on this URL ────────────────────────────────────
 *
 * Every account belongs to a company, and a buyer who followed an agent's
 * shared link belongs to that agent. Typing a password carries both — the form
 * posts them. Pressing the Google button used to carry neither, so a client who
 * arrived through an agent's link and chose Google ended up either unattributed
 * or, once the platform began requiring a company on every account, unable to
 * sign up at all.
 *
 * The server packs whatever is here into the signed OAuth `state`, which is the
 * only thing that survives the round trip to Google and back.
 */
export const googleAuthUrl = ({ companyCode, realtorCode, redirect } = {}) => {
  const params = new URLSearchParams();
  if (companyCode) params.set('company_code', String(companyCode).toUpperCase());
  if (realtorCode) params.set('realtor_code', String(realtorCode).toUpperCase());
  if (redirect) params.set('redirect', redirect);

  const query = params.toString();
  return query ? `${apiUrl('/auth/google')}?${query}` : apiUrl('/auth/google');
};

/**
 * The codes on the current URL, under any of the spellings a shared link uses.
 *
 * `code` and `company_code` are the same thing; `ref` and `realtor_code` are
 * the same thing. Both pairs exist because links have been shared in the wild
 * with each, and a buyer following an old one should not silently lose their
 * attribution.
 */
export const codesFromLocation = (search = window.location.search) => {
  const q = new URLSearchParams(search);
  return {
    companyCode: (q.get('company_code') || q.get('code') || '').toUpperCase() || null,
    realtorCode: (q.get('realtor_code') || q.get('ref') || '').toUpperCase() || null,
    redirect: q.get('redirect') || null,
  };
};

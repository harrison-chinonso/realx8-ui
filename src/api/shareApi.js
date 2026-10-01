import client from './client';

/**
 * Mint a sealed share token for the signed-in user.
 *
 * The payload is built from the CALLER's own identity — a realtor gets their
 * code, a company admin gets their company — so nothing here can ask for
 * someone else's attribution.
 *
 * `params` carries only `company_id`, and only for a platform admin, who has no
 * company of their own and must name the one they are minting for. The server
 * ignores it for everybody else.
 */
export const createShareToken = (params) =>
  client.post('/share/token', undefined, { params }).then((r) => r.data?.data);

/** Public — resolves a sealed token to company branding. No auth required. */
export const resolveShareToken = (token) =>
  client.get(`/share/brand/${encodeURIComponent(token)}`).then((r) => r.data?.data);

/**
 * Public — a company code (the one typed at sign-up) → { company: { name, code },
 * branding }. For the branded /login/<code> page and the sign-up code check.
 * Rejects (404) for an unknown or suspended company.
 */
export const lookupCompanyCode = (code) =>
  client.get(`/share/company/${encodeURIComponent(String(code).trim().toUpperCase())}`).then((r) => r.data?.data);

/**
 * Public — a few of a company's publicly shared listings and the offer on
 * each, for the sign-in page's side panel. Cached server-side.
 */
export const companyShowcase = (code) =>
  client.get(`/public/companies/${encodeURIComponent(String(code).trim().toUpperCase())}/showcase`).then((r) => r.data?.data);

/**
 * Who to contact for help: { email, phone, whatsapp, hours, company }. Public —
 * the signed-in user's company when there is one, else the company the page
 * was opened for (`code`), else the platform's own.
 */
export const getSupportContacts = (code) =>
  client.get('/settings/support', { params: code ? { c: String(code).trim().toUpperCase() } : {} }).then((r) => r.data?.data || {});

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

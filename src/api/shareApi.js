import client from './client';

/**
 * Mint a sealed share token for the signed-in user.
 *
 * Takes no arguments on purpose: the server builds the payload from the
 * caller's own identity, so a realtor gets their code and a company admin gets
 * their company. Nothing here can ask for someone else's attribution.
 */
export const createShareToken = () =>
  client.post('/share/token').then((r) => r.data?.data);

/** Public — resolves a sealed token to company branding. No auth required. */
export const resolveShareToken = (token) =>
  client.get(`/share/brand/${encodeURIComponent(token)}`).then((r) => r.data?.data);

/**
 * The one call this site makes: send an onboarding request or an enquiry to
 * Realx8-Core (POST /public/website/requests). Plain JSON, no session.
 */
const API_URL = String(import.meta.env.VITE_API_URL || 'https://realx8-core.onrender.com').replace(/\/+$/, '');
export const APP_URL = String(import.meta.env.VITE_APP_URL || 'https://beta.realx8.net').replace(/\/+$/, '');

export async function sendRequest(payload) {
  let response;
  try {
    response = await fetch(`${API_URL}/public/website/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('We could not reach our servers. Check your connection and try again.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Something went wrong. Please try again.');
  return body.data || {};
}

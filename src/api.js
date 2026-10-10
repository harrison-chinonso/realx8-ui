/**
 * The two calls this site makes to Realx8-Core, plain JSON with no session:
 * send an onboarding request, trial request or enquiry
 * (POST /public/website/requests), and read the plans (GET /public/plans).
 */
import { normalisePlans } from './content/plans.js';

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

/**
 * The plans as the app has them, as { plans, trialDays } — or null on any
 * failure, so the caller simply keeps showing the built-in copy. Never throws:
 * a pricing page that cannot reach the API should still show prices.
 */
export async function fetchPlans() {
  try {
    const response = await fetch(`${API_URL}/public/plans`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return normalisePlans(await response.json());
  } catch {
    return null;
  }
}

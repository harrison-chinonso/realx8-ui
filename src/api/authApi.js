import client from './client';
import { lockedCompanyCode } from '../lib/nativeShell';

/**
 * Sent as `company_code` from a white-label app, so the server signs in to that
 * company's account alone (Realx8-Core companyPin.js) rather than offering every
 * company the address belongs to.
 */
const pinned = () => {
  const code = lockedCompanyCode();
  return code ? { company_code: code } : {};
};

export const login = async (payload) => (await client.post('/auth/login', { ...payload, ...pinned() })).data;
/**
 * Registration's own `company_code` is the company being joined, so the app's
 * company goes as `pin_company_code` — the server refuses the two disagreeing
 * and holds the new session to it, as it does for a sign-in.
 */
export const register = async (payload) => {
  const code = lockedCompanyCode();
  return (await client.post('/auth/register', code ? { ...payload, pin_company_code: code } : payload)).data;
};
/**
 * Sign in with the 6-digit passcode. Only accepted within a few hours of the
 * last password sign-in; outside that the server answers with a reason of
 * `window_expired` and the password is needed again.
 */
export const passcodeLogin = async ({ identifier, passcode }) =>
  (await client.post('/auth/passcode/login', { identifier, passcode, ...pinned() })).data;

/**
 * The second half of a sign-in for somebody who belongs to more than one
 * company.
 *
 * The company token is what proves the password was already given — the id
 * beside it only names which of the accounts that password opened is wanted.
 */
export const loginToCompany = async (company_token, company_id) =>
  (await client.post('/auth/login/company', { company_token, company_id, ...pinned() })).data;
export const verify2FA = async (temp_token, totp_token) => (await client.post('/auth/2fa/verify', { temp_token, totp_token })).data;
export const setup2FA = async () => (await client.post('/auth/2fa/setup')).data;
export const verifySetup2FA = async (token) => (await client.post('/auth/2fa/verify-setup', { token })).data;
export const disable2FA = async (token) => (await client.post('/auth/2fa/disable', { token })).data;
// Forced 2FA setup during login flow (uses temp_token instead of session)
export const forcedSetup2FA = async (temp_token) => (await client.post('/auth/2fa/forced-setup', { temp_token })).data;
export const forcedVerify2FA = async (temp_token, totp_token) => (await client.post('/auth/2fa/forced-verify', { temp_token, totp_token })).data;
// Admin 2FA policy
export const get2FAPolicy = async () => (await client.get('/auth/admin/2fa-policy')).data;
export const set2FAPolicy = async (required, company_id) => (await client.post('/auth/admin/2fa-policy', { required, company_id })).data;
export const forgotPassword = async (email) => (await client.post('/auth/forgot-password', { email })).data;
export const verifyResetOtp = async (email, otp) => (await client.post('/auth/verify-reset-otp', { email, otp })).data;
/**
 * `payload` carries `company_id` when the address has accounts with more than
 * one company — a password belongs to one company account now, so a reset that
 * did not say which would quietly change them all.
 */
export const resetPassword = async (payload) => (await client.post('/auth/reset-password', payload)).data;
export const me = async () => (await client.get('/auth/me')).data;
export const logout = async (refreshToken) => (await client.post('/auth/logout', { refreshToken })).data;
export const switchRoleApi = async (roleId) => (await client.post('/auth/switch-role', { roleId })).data;
export const enableProfileApi = async (profile) => (await client.post('/auth/profiles/enable', { profile })).data;

/** The companies this person holds an account with. */
export const listMyCompanies = async () => (await client.get('/auth/companies')).data;

/**
 * Move into the account this person holds at another company.
 *
 * Returns a WHOLE new session — a different account, with its own permissions,
 * its own profile and its own branding — which is why the store replaces the
 * session with it rather than patching a company id into the old one.
 */
export const switchCompanyApi = async (company_id, password) =>
  (await client.post('/auth/switch-company', { company_id, password })).data;

/**
 * Open an account with another company, using its code, from inside the app.
 *
 * Returns the company and the refreshed switcher list — NOT a session. Adding
 * a company and moving into one are separate, because the move has guards the
 * addition does not need; see the server's joinCompany.
 */
export const joinCompanyApi = async ({ company_code, role, realtor_code, password }) =>
  (await client.post('/auth/companies/join', { company_code, role, realtor_code, password })).data;

/**
 * What would happen if this account were deleted, asked before anything is
 * typed: which company is being left, how it must be confirmed, and anything
 * outstanding that stands in the way.
 */
export const accountDeletionCheckApi = async () =>
  (await client.get('/auth/account/deletion-check')).data;

/**
 * Delete the account held with the CURRENT session's company. Other companies
 * the same email holds accounts with are untouched.
 *
 * Takes a password, or `confirmation: 'DELETE'` for a Google account that never
 * chose one. The server decides which it will accept.
 */
export const deleteAccountApi = async ({ password, confirmation } = {}) =>
  (await client.post('/auth/account/delete', { password, confirmation })).data;

/** The signed-in account's passcode: whether one is set, and whether it would work right now. */
export const getPasscodeStatus = async () => (await client.get('/auth/passcode')).data?.data;
/** Set or replace the 6-digit passcode. The current password is required. */
export const setPasscode = async ({ passcode, password }) => (await client.post('/auth/passcode', { passcode, password })).data;
export const removePasscode = async () => (await client.delete('/auth/passcode')).data;

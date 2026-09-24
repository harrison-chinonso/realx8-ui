import client from './client';

export const login = async (payload) => (await client.post('/auth/login', payload)).data;
export const register = async (payload) => (await client.post('/auth/register', payload)).data;

/**
 * The second half of a sign-in for somebody who belongs to more than one
 * company.
 *
 * The company token is what proves the password was already given — the id
 * beside it only names which of the accounts that password opened is wanted.
 */
export const loginToCompany = async (company_token, company_id) =>
  (await client.post('/auth/login/company', { company_token, company_id })).data;
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
export const switchCompanyApi = async (company_id) =>
  (await client.post('/auth/switch-company', { company_id })).data;

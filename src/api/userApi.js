import client from './client';

// Users
export const listUsers = (params) => client.get('/users', { params }).then(r => r.data);
export const createUser = (payload) => client.post('/users', payload).then(r => r.data);
export const getUser = (id) => client.get(`/users/${id}`).then(r => r.data);
export const updateUser = (id, payload) => client.put(`/users/${id}`, payload).then(r => r.data);
export const deleteUser = (id) => client.delete(`/users/${id}`).then(r => r.data);
export const assignRole = (userId, roleId) => client.post(`/users/${userId}/roles`, { role_id: roleId }).then(r => r.data);

// By type
export const listEmployees = (params) => client.get('/users/employees', { params }).then(r => r.data);
export const listClients = (params) => client.get('/users/clients', { params }).then(r => r.data);
export const listRealtors = (params) => client.get('/users/realtors', { params }).then(r => r.data);

// Roles
export const listRoles = () => client.get('/roles').then(r => r.data);
export const createRole = (payload) => client.post('/roles', payload).then(r => r.data);
export const deleteRole = (id) => client.delete(`/roles/${id}`).then(r => r.data);

// Commissions
export const listCommissions = (params) => client.get('/commissions', { params }).then(r => r.data);
export const createCommission = (payload) => client.post('/commissions', payload).then(r => r.data);
export const updateCommission = (id, payload) => client.put(`/commissions/${id}`, payload).then(r => r.data);
export const deleteCommission = (id) => client.delete(`/commissions/${id}`).then(r => r.data);
export const getUserCommissions = (userId) => client.get(`/users/${userId}/commissions`).then(r => r.data);

// Referral
export const getReferralSetting = () => client.get('/referral/setting').then(r => r.data);
export const upsertReferralSetting = (payload) => client.post('/referral/setting', payload).then(r => r.data);
export const listReferralTransactions = (params) => client.get('/referral/transactions', { params }).then(r => r.data);

// Settings — company users receive merged global-defaults + company overrides (company wins)
export const getSettings = (group, { effective = false } = {}) =>
  client.get('/settings', { params: { ...(group ? { group } : {}), ...(effective ? { effective: 'true' } : {}) } }).then(r => r.data);
export const upsertSetting = (payload) => client.post('/settings', payload).then(r => r.data);
export const bulkUpdateSettings = (settings, group) => client.post('/settings/bulk', { settings, group }).then(r => r.data);
export const uploadLogo = (file) => {
  const fd = new FormData();
  fd.append('logo', file);
  return client.post('/settings/upload-logo', fd).then(r => r.data);
};


// Public — no auth token required
export const fetchPlatformName = () =>
  client.get('/settings/platform-name').then(r => r.data);

/** Role-scoped dashboard aggregates for realtors and clients. */
export const getDashboardSummary = () => client.get('/dashboard/summary').then((r) => r.data);

/** Clients and realtors the signed-in realtor referred. */
export const listMyReferrals = () => client.get('/dashboard/referrals').then((r) => r.data);

/** Another user's business summary. The server decides who may read whom. */
export const getUserSummary = (id) => client.get(`/dashboard/summary/${id}`).then((r) => r.data);

/** Clients a realtor is responsible for — referred to them or assigned via a lead. */
export const listMyClients = () => client.get('/dashboard/my-clients').then((r) => r.data);

/** Commissions earned from one referral, and what that referral purchased. */
export const getReferralEarnings = (id) => client.get(`/dashboard/referrals/${id}/earnings`).then((r) => r.data);

/** Admin view of one realtor's referrals — upline chain and direct downline. */
export const getRealtorReferrals = (realtorId) =>
  client.get(`/realtors/${realtorId}/referrals`).then((r) => r.data);

// ── Realtor KYC ───────────────────────────────────────────────────────────────
export const getMyKyc = () => client.get('/realtor-kyc/me').then((r) => r.data);
export const submitKyc = (payload) => client.post('/realtor-kyc', payload).then((r) => r.data);
export const listKycSubmissions = (params) => client.get('/realtor-kyc', { params }).then((r) => r.data);
export const approveKyc = (id, payload) => client.post(`/realtor-kyc/${id}/approve`, payload).then((r) => r.data);
export const rejectKyc = (id, payload) => client.post(`/realtor-kyc/${id}/reject`, payload).then((r) => r.data);

import client from './client';

export const listCompanies = (params) => client.get('/companies', { params }).then((r) => r.data);

/** The signed-in user's own company (includes referral_code). Returns null for superior admins. */
export const getMyCompany = () => client.get('/my-company').then((r) => r.data);

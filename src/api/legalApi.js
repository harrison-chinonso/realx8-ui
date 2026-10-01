import client from './client';

/**
 * The Terms of Use and Privacy Policy (user-service, controllers/legalController).
 * Reading the current version is public; agreeing needs a session; the admin
 * calls are for platform administrators only.
 */
export const getTerms = () => client.get('/legal/terms').then((r) => r.data?.data || null);
export const getTermsStatus = () => client.get('/legal/terms/status').then((r) => r.data?.data || null);
/** { version_id, accept_terms, accept_privacy, marketing_opt_in, context? } */
export const acceptTerms = (payload) => client.post('/legal/terms/accept', payload).then((r) => r.data?.data);

export const getLegalDocument = () => client.get('/legal/admin/document').then((r) => r.data?.data);
export const saveLegalDraft = (payload) => client.put('/legal/admin/draft', payload).then((r) => r.data?.data);
/** { requires_acceptance, change_note } */
export const publishLegalDocument = (payload) => client.post('/legal/admin/publish', payload).then((r) => r.data?.data);
export const getLegalVersion = (id) => client.get(`/legal/admin/versions/${id}`).then((r) => r.data?.data);
export const listTermsAcceptances = (params) => client.get('/legal/admin/acceptances', { params }).then((r) => r.data);
export const exportTermsAcceptances = (params) => client.get('/legal/admin/acceptances/export', { params, responseType: 'blob' }).then((r) => r.data);

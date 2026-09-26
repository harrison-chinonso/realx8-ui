import client from './client';

/**
 * Promotions.
 *
 * `preview` and `validate` take a configuration rather than an id, so the
 * wizard can test a campaign that has not been saved — which is when a mistake
 * is cheapest to fix, and the only moment an admin is actually thinking about
 * whether the rules hold together.
 */
export const listPromotions = (params) => client.get('/promotions', { params }).then((r) => r.data?.data);
export const getPromotion = (id) => client.get(`/promotions/${id}`).then((r) => r.data?.data);
export const createPromotion = (payload) => client.post('/promotions', payload).then((r) => r.data?.data);
export const updatePromotion = (id, payload) => client.put(`/promotions/${id}`, payload).then((r) => r.data?.data);

/** Lifecycle moves are actions, not a status field — see the controller. */
export const setPromotionStatus = (id, status) =>
  client.post(`/promotions/${id}/status`, { status }).then((r) => r.data?.data);

export const previewPromotion = (payload) => client.post('/promotions/preview', payload).then((r) => r.data);
export const validatePromotionDraft = (config) =>
  client.post('/promotions/validate', { config }).then((r) => r.data?.data);

export const promotionAnalytics = (id, params) =>
  client.get(id ? `/promotions/${id}/analytics` : '/promotions/analytics', { params }).then((r) => r.data?.data);

/** What a buyer would pay for one unit right now. Not staff-only. */
export const unitPrice = (unitId, params) =>
  client.get(`/units/${unitId}/price`, { params }).then((r) => r.data?.data);

/**
 * What this company is promoting to buyers right now, for the dashboard
 * advert: one entry per promoted property, with the offer attached.
 *
 * Distinct from listPromotions, which is the administrator's view of every
 * campaign in every state. This returns only ACTIVE, in-date campaigns over
 * approved and available properties, and is readable by clients and realtors.
 */
export const listPromotionShowcase = () =>
  client.get('/promotions/showcase').then((r) => r.data?.data || []);

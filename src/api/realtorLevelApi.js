import client from './client';

/** params.company_id lets a superior admin inspect one company's levels alongside the global ladder. */
export const listRealtorLevels = (params) => client.get('/realtor-levels', { params }).then((r) => r.data);
/**
 * Save the WHOLE ladder, lowest rung first.
 *
 * There is no per-level create, update, delete or reorder any more. Every real
 * change to a ladder touches several rungs at once, and as four separate calls
 * an admin's single intention could half-happen. One call, one outcome.
 *
 * An entry with an `id` from the platform ladder is an instruction to adopt
 * that rung as the company's own; the server copies it and moves everything
 * that pointed at the original.
 */
export const saveRealtorLadder = (levels) => client.put('/realtor-levels', { levels }).then((r) => r.data);
export const assignRealtorLevel = (userId, levelId) =>
  client.put(`/realtors/${userId}/level`, { level_id: levelId }).then((r) => r.data);

export const listLevelRequests = (params) => client.get('/realtor-levels/requests', { params }).then((r) => r.data);
export const requestLevelUpgrade = (payload) => client.post('/realtor-levels/requests', payload).then((r) => r.data);
export const approveLevelRequest = (id, payload) => client.post(`/realtor-levels/requests/${id}/approve`, payload).then((r) => r.data);
export const rejectLevelRequest = (id, payload) => client.post(`/realtor-levels/requests/${id}/reject`, payload).then((r) => r.data);

import client from './client';

/** params.company_id lets a superior admin inspect one company's levels alongside the global ladder. */
export const listRealtorLevels = (params) => client.get('/realtor-levels', { params }).then((r) => r.data);
export const createRealtorLevel = (payload) => client.post('/realtor-levels', payload).then((r) => r.data);
export const updateRealtorLevel = (id, payload) => client.put(`/realtor-levels/${id}`, payload).then((r) => r.data);
export const deleteRealtorLevel = (id) => client.delete(`/realtor-levels/${id}`).then((r) => r.data);
/** ids: level ids lowest-rank first. */
export const reorderRealtorLevels = (ids) => client.put('/realtor-levels/reorder', { ids }).then((r) => r.data);
export const assignRealtorLevel = (userId, levelId) =>
  client.put(`/realtors/${userId}/level`, { level_id: levelId }).then((r) => r.data);

export const listLevelRequests = (params) => client.get('/realtor-levels/requests', { params }).then((r) => r.data);
export const requestLevelUpgrade = (payload) => client.post('/realtor-levels/requests', payload).then((r) => r.data);
export const approveLevelRequest = (id, payload) => client.post(`/realtor-levels/requests/${id}/approve`, payload).then((r) => r.data);
export const rejectLevelRequest = (id, payload) => client.post(`/realtor-levels/requests/${id}/reject`, payload).then((r) => r.data);

import client from './client';

export const listInspections = (params) => client.get('/inspections', { params }).then((r) => r.data);
export const createInspection = (payload) => client.post('/inspections', payload).then((r) => r.data);
export const updateInspection = (id, payload) => client.put(`/inspections/${id}`, payload).then((r) => r.data);
export const confirmInspection = (id) => client.post(`/inspections/${id}/confirm`).then((r) => r.data);
export const completeInspection = (id, payload) => client.post(`/inspections/${id}/complete`, payload).then((r) => r.data);
export const cancelInspection = (id) => client.post(`/inspections/${id}/cancel`).then((r) => r.data);
export const listMyClients = () => client.get('/inspections/my-clients').then((r) => r.data);
export const approveInspection = (id, payload) => client.post(`/inspections/${id}/approve`, payload).then((r) => r.data);
export const rejectInspection = (id, payload) => client.post(`/inspections/${id}/reject`, payload).then((r) => r.data);
export const listSelectableLeads = () => client.get('/inspections/leads').then((r) => r.data);

import client from './client';

export const listVipClients = (params) => client.get('/care/vip', { params }).then((r) => r.data);
export const createVipClient = (payload) => client.post('/care/vip', payload).then((r) => r.data);
export const updateVipClient = (id, payload) => client.put(`/care/vip/${id}`, payload).then((r) => r.data);

export const listCommunications = (params) => client.get('/care/communications', { params }).then((r) => r.data);
export const createCommunication = (payload) => client.post('/care/communications', payload).then((r) => r.data);

export const listAlerts = (params) => client.get('/care/alerts', { params }).then((r) => r.data);
export const createAlert = (payload) => client.post('/care/alerts', payload).then((r) => r.data);

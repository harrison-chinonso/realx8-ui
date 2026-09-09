import client from './client';

export const listVisitors = (params) => client.get('/visitors', { params }).then((r) => r.data);
export const createVisitor = (payload) => client.post('/visitors', payload).then((r) => r.data);
export const checkoutVisitor = (id) => client.put(`/visitors/${id}/checkout`).then((r) => r.data);

export const listAttendance = (params) => client.get('/attendance', { params }).then((r) => r.data);
export const createAttendance = (payload) => client.post('/attendance', payload).then((r) => r.data);

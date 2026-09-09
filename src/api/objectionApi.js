import client from './client';

export const listObjections = (params) => client.get('/objections', { params }).then(r => r.data);
export const createObjection = (payload) => client.post('/objections', payload).then(r => r.data);
export const deleteObjection = (id) => client.delete(`/objections/${id}`).then(r => r.data);

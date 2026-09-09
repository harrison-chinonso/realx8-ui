import client from './client';

export const listTickets = (params) => client.get('/support', { params }).then(r => r.data);
export const getTicket = (id) => client.get(`/support/${id}`).then(r => r.data);
export const createTicket = (payload) => client.post('/support', payload).then(r => r.data);
export const updateTicket = (id, payload) => client.put(`/support/${id}`, payload).then(r => r.data);
export const deleteTicket = (id) => client.delete(`/support/${id}`).then(r => r.data);
export const updateTicketStatus = (id, status) => client.put(`/support/${id}/status`, { status }).then(r => r.data);
export const getReplies = (id) => client.get(`/support/${id}/replies`).then(r => r.data);
export const addReply = (id, payload) => client.post(`/support/${id}/replies`, payload).then(r => r.data);

import client from './client';

// Requests from the public website (realx8.net) — platform administrators only.
export const listWebsiteRequests = (params) => client.get('/website-requests', { params }).then((r) => r.data);
export const updateWebsiteRequest = (id, payload) => client.patch(`/website-requests/${id}`, payload).then((r) => r.data?.data);

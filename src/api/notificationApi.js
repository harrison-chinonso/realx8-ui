import client from './client';

export const listNotifications = (params) => client.get('/notifications', { params }).then(r => r.data);
export const markRead = (id) => client.put(`/notifications/${id}/read`).then(r => r.data);
export const markAllRead = () => client.put('/notifications/read-all').then(r => r.data);
export const sendNotification = (payload) => {
  const { message, ...rest } = payload || {};
  return client.post('/notifications/send', { ...rest, body: rest.body ?? message }).then(r => r.data);
};
export const sendBulkNotification = (payload) => client.post('/notifications/send-bulk', payload).then(r => r.data);
export const listSentNotifications = () => client.get('/notifications/sent').then(r => r.data);
export const sendEmail = (payload) => client.post('/notifications/email', payload).then(r => r.data);
export const listNotificationTemplates = (params) => client.get('/notification-templates', { params }).then(r => r.data);
export const createNotificationTemplate = (payload) => client.post('/notification-templates', payload).then(r => r.data);
export const updateNotificationTemplate = (id, payload) => client.put(`/notification-templates/${id}`, payload).then(r => r.data);
export const deleteNotificationTemplate = (id) => client.delete(`/notification-templates/${id}`).then(r => r.data);

// ── Notification configuration (purchase-journey events) ─────────────────────
// A company either has its own configuration or inherits the platform's — the
// resolution is per company, not per event, so these are always saved as a set.
export const getNotificationConfig = (params) =>
  client.get('/notification-configs', { params }).then(r => r.data);
export const saveNotificationConfig = (events, params) =>
  client.put('/notification-configs', { events, ...(params || {}) }).then(r => r.data);
export const resetNotificationConfig = (params) =>
  client.delete('/notification-configs', { params }).then(r => r.data);
// Who the currently-selected permissions actually resolve to.
export const previewNotificationRecipients = (eventKey, params) =>
  client.get(`/notification-configs/${eventKey}/recipients`, { params }).then(r => r.data);

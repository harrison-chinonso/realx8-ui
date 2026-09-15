import client from './client';

export const pushPublicKey = () => client.get('/notifications/push/public-key').then((r) => r.data?.data);
export const pushSubscribe = (subscription) =>
  client.post('/notifications/push/subscribe', subscription).then((r) => r.data?.data);
export const pushUnsubscribe = (endpoint) =>
  client.post('/notifications/push/unsubscribe', { endpoint }).then((r) => r.data?.data);
export const pushSubscriptions = () => client.get('/notifications/push/subscriptions').then((r) => r.data?.data);
/** Push is the one channel whose "is it working" cannot be answered on screen. */
export const pushTest = () => client.post('/notifications/push/test').then((r) => r.data?.data);

import client from './client';

export const listTrainingModules = (params) => client.get('/training/modules', { params }).then((r) => r.data);
export const createTrainingModule = (payload) => client.post('/training/modules', payload).then((r) => r.data);
export const updateTrainingModule = (id, payload) => client.put(`/training/modules/${id}`, payload).then((r) => r.data);
export const deleteTrainingModule = (id) => client.delete(`/training/modules/${id}`).then((r) => r.data);
export const enrollTrainingModule = (id, payload) => client.post(`/training/modules/${id}/enroll`, payload).then((r) => r.data);
export const submitTrainingQuiz = (id, payload) => client.post(`/training/modules/${id}/submit`, payload).then((r) => r.data);
export const listTrainingProgress = (params) => client.get('/training/progress', { params }).then((r) => r.data);
export const getTrainingCertificate = (id, params) => client.get(`/training/modules/${id}/certificate`, { params }).then((r) => r.data);

export const listRecruits = (params) => client.get('/recruitment/recruits', { params }).then((r) => r.data);
export const createRecruit = (payload) => client.post('/recruitment/recruits', payload).then((r) => r.data);
export const updateRecruit = (id, payload) => client.put(`/recruitment/recruits/${id}`, payload).then((r) => r.data);
export const deleteRecruit = (id) => client.delete(`/recruitment/recruits/${id}`).then((r) => r.data);

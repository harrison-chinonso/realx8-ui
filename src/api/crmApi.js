import client from './client';

// Leads
export const listLeads = (params) => client.get('/leads', { params }).then(r => r.data);
export const createLead = (payload) => client.post('/leads', payload).then(r => r.data);
export const createChatbotLead = (payload) => client.post('/leads/from-chatbot', payload).then(r => r.data);
export const getLead = (id) => client.get(`/leads/${id}`).then(r => r.data);
export const getLeadActivities = (id) => client.get(`/leads/${id}/activities`).then(r => r.data);
export const autoAssignLead = (id) => client.post(`/leads/${id}/auto-assign`).then(r => r.data);
export const getLeadScoreDetails = (id) => client.get(`/leads/${id}/score-details`).then(r => r.data);
export const getFollowUpSuggestion = (id) => client.get(`/leads/${id}/follow-up-suggestion`).then(r => r.data);
export const updateLead = (id, payload) => client.put(`/leads/${id}`, payload).then(r => r.data);
export const deleteLead = (id) => client.delete(`/leads/${id}`).then(r => r.data);

// Deals
export const listDeals = (params) => client.get('/deals', { params }).then(r => r.data);
export const createDeal = (payload) => client.post('/deals', payload).then(r => r.data);
export const getDeal = (id) => client.get(`/deals/${id}`).then(r => r.data);
export const updateDeal = (id, payload) => client.put(`/deals/${id}`, payload).then(r => r.data);
export const deleteDeal = (id) => client.delete(`/deals/${id}`).then(r => r.data);
export const getDealTasks = (id) => client.get(`/deals/${id}/tasks`).then(r => r.data);

// Tasks
export const listTasks = (params) => client.get('/tasks', { params }).then(r => r.data);
export const createTask = (payload) => client.post('/tasks', payload).then(r => r.data);
export const updateTask = (id, payload) => client.put(`/tasks/${id}`, payload).then(r => r.data);
export const deleteTask = (id) => client.delete(`/tasks/${id}`).then(r => r.data);

// Pipelines
export const listPipelines = (params) => client.get('/pipelines', { params }).then(r => r.data);
export const createPipeline = (payload) => client.post('/pipelines', payload).then(r => r.data);
export const updatePipeline = (id, payload) => client.put(`/pipelines/${id}`, payload).then(r => r.data);
export const deletePipeline = (id) => client.delete(`/pipelines/${id}`).then(r => r.data);

// Stages
export const listStages = (params) => client.get('/stages', { params }).then(r => r.data);
export const createStage = (payload) => client.post('/stages', payload).then(r => r.data);
export const updateStage = (id, payload) => client.put(`/stages/${id}`, payload).then(r => r.data);
export const deleteStage = (id) => client.delete(`/stages/${id}`).then(r => r.data);

// Lead Stages (custom stages separate from pipeline stages)
export const listLeadStages = () => client.get('/lead-stages').then(r => r.data);
export const createLeadStage = (payload) => client.post('/lead-stages', payload).then(r => r.data);
export const deleteLeadStage = (id) => client.delete(`/lead-stages/${id}`).then(r => r.data);

// Activities
export const logActivity = (payload) => client.post('/activities', payload).then(r => r.data);
export const getActivities = (params) => client.get('/activities', { params }).then(r => r.data);

// Sources
export const listSources = (params) => client.get('/sources', { params }).then(r => r.data);
export const createSource = (payload) => client.post('/sources', payload).then(r => r.data);
export const deleteSource = (id) => client.delete(`/sources/${id}`).then(r => r.data);

// Labels
export const listLabels = (params) => client.get('/labels', { params }).then(r => r.data);
export const createLabel = (payload) => client.post('/labels', payload).then(r => r.data);
export const deleteLabel = (id) => client.delete(`/labels/${id}`).then(r => r.data);

// Analytics
export const getSalesAnalytics = () => client.get('/crm/analytics').then(r => r.data);
export const getAgentPerformance = (params) => client.get('/analytics/agent-performance', { params }).then(r => r.data);

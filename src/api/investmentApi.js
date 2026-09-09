import client from './client';

// Investment Plans
export const listInvestmentPlans = (params) => client.get('/investment-plans', { params }).then(r => r.data);
export const createInvestmentPlan = (payload) => client.post('/investment-plans', payload).then(r => r.data);
export const updateInvestmentPlan = (id, payload) => client.put(`/investment-plans/${id}`, payload).then(r => r.data);
export const deleteInvestmentPlan = (id) => client.delete(`/investment-plans/${id}`).then(r => r.data);

// Investment Categories
export const listInvestmentCategories = (params) => client.get('/investment-categories', { params }).then(r => r.data);
export const createInvestmentCategory = (payload) => client.post('/investment-categories', payload).then(r => r.data);
export const deleteInvestmentCategory = (id) => client.delete(`/investment-categories/${id}`).then(r => r.data);

// Investment Periods
export const listInvestmentPeriods = (params) => client.get('/investment-periods', { params }).then(r => r.data);
export const createInvestmentPeriod = (payload) => client.post('/investment-periods', payload).then(r => r.data);
export const deleteInvestmentPeriod = (id) => client.delete(`/investment-periods/${id}`).then(r => r.data);

// Investments
export const listInvestments = (params) => client.get('/investments', { params }).then(r => r.data);
export const getInvestment = (id) => client.get(`/investments/${id}`).then(r => r.data);
export const createInvestment = (payload) => client.post('/investments', payload).then(r => r.data);
export const updateInvestment = (id, payload) => client.put(`/investments/${id}`, payload).then(r => r.data);
export const deleteInvestment = (id) => client.delete(`/investments/${id}`).then(r => r.data);
export const activateInvestment = (id) => client.post(`/investments/${id}/activate`).then(r => r.data);
export const createInvestmentPayout = (id, payload) => client.post(`/investments/${id}/payouts`, payload).then(r => r.data);
export const getInvestmentTransactions = (id) => client.get(`/investments/${id}/transactions`).then(r => r.data);
export const getInvestmentPayouts = (id) => client.get(`/investments/${id}/payouts`).then(r => r.data);
export const getRetentionAlerts = () => client.get('/investments/retention-alerts').then(r => r.data);

// Cash-out workflow
export const requestCashOut = (id, payload) => client.post(`/investments/${id}/request-cashout`, payload).then(r => r.data);
export const approveCashOut = (id) => client.post(`/investments/${id}/approve-cashout`).then(r => r.data);
export const rejectCashOut = (id, payload) => client.post(`/investments/${id}/reject-cashout`, payload).then(r => r.data);

/** Active plans a client may subscribe to. */
export const listOpenPlans = () => client.get('/investments/open-plans').then((r) => r.data);

/** Subscribes the signed-in client to a plan. user_id is taken from the session. */
export const subscribeToPlan = (payload) => client.post('/investments/subscribe', payload).then((r) => r.data);

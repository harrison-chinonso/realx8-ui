import client from './client';

// Invoices
export const listInvoices = (params) => client.get('/invoices', { params }).then(r => r.data);
export const createInvoice = (payload) => client.post('/invoices', payload).then(r => r.data);
export const getInvoice = (id) => client.get(`/invoices/${id}`).then(r => r.data);
export const updateInvoice = (id, payload) => client.put(`/invoices/${id}`, payload).then(r => r.data);
export const deleteInvoice = (id) => client.delete(`/invoices/${id}`).then(r => r.data);
export const sendInvoice = (id) => client.post(`/invoices/${id}/send`).then(r => r.data);
export const payInvoice = (id, payload) => client.post(`/invoices/${id}/pay`, payload).then(r => r.data);

/** Settle the whole outstanding balance in one entry. */
export const markInvoicePaid = (id, payload) => client.post(`/invoices/${id}/mark-paid`, payload || {}).then(r => r.data);
export const getInvoicePayments = (id) => client.get(`/invoices/${id}/payments`).then(r => r.data);

/**
 * Every invoice and payment for one user, with totals.
 * Serves a client asking for their own record and an admin or upline realtor
 * inspecting a client's — the server decides who may ask about whom.
 */
export const getPaymentAnalysis = (userId) => client.get(`/payment-analysis/${userId}`).then(r => r.data);

/** How a buyer may pay this invoice: bank details and/or a configured gateway. */
export const getPaymentOptions = (invoiceId) => client.get(`/invoices/${invoiceId}/payment-options`).then(r => r.data);

/** Buyer submits proof of payment; moves the invoice to payment under review. */
export const submitInvoiceReceipt = (invoiceId, payload) =>
  client.post(`/invoices/${invoiceId}/receipts`, payload).then(r => r.data);

// Taxes
export const listTaxes = (params) => client.get('/taxes', { params }).then(r => r.data);
export const createTax = (payload) => client.post('/taxes', payload).then(r => r.data);
export const updateTax = (id, payload) => client.put(`/taxes/${id}`, payload).then(r => r.data);
export const deleteTax = (id) => client.delete(`/taxes/${id}`).then(r => r.data);

// Transactions
export const listTransactions = (params) => client.get('/transactions', { params }).then(r => r.data);
export const createTransaction = (payload) => client.post('/transactions', payload).then(r => r.data);
export const updateTransaction = (id, payload) => client.put(`/transactions/${id}`, payload).then(r => r.data);
export const deleteTransaction = (id) => client.delete(`/transactions/${id}`).then(r => r.data);

// Payment Plans
export const listPaymentPlans = (params) => client.get('/payment-plans', { params }).then(r => r.data);
export const createPaymentPlan = (payload) => client.post('/payment-plans', payload).then(r => r.data);
export const updatePaymentPlan = (id, payload) => client.put(`/payment-plans/${id}`, payload).then(r => r.data);
export const deletePaymentPlan = (id) => client.delete(`/payment-plans/${id}`).then(r => r.data);

// Credit / Debit Notes
export const listCreditNotes = (params) => client.get('/credit-notes', { params }).then(r => r.data);
export const createCreditNote = (payload) => client.post('/credit-notes', payload).then(r => r.data);
export const updateCreditNote = (id, payload) => client.put(`/credit-notes/${id}`, payload).then(r => r.data);
export const deleteCreditNote = (id) => client.delete(`/credit-notes/${id}`).then(r => r.data);
export const listDebitNotes = (params) => client.get('/debit-notes', { params }).then(r => r.data);
export const createDebitNote = (payload) => client.post('/debit-notes', payload).then(r => r.data);
export const updateDebitNote = (id, payload) => client.put(`/debit-notes/${id}`, payload).then(r => r.data);
export const deleteDebitNote = (id) => client.delete(`/debit-notes/${id}`).then(r => r.data);

// Payment Reminders
export const listPaymentReminders = (params) => client.get('/payment-reminders', { params }).then(r => r.data);
export const createPaymentReminder = (payload) => client.post('/payment-reminders', payload).then(r => r.data);
export const updatePaymentReminder = (id, payload) => client.put(`/payment-reminders/${id}`, payload).then(r => r.data);
export const deletePaymentReminder = (id) => client.delete(`/payment-reminders/${id}`).then(r => r.data);

// Bank Accounts
export const listBankAccounts = (params) => client.get('/bank-accounts', { params }).then(r => r.data);
export const createBankAccount = (payload) => client.post('/bank-accounts', payload).then(r => r.data);
export const updateBankAccount = (id, payload) => client.put(`/bank-accounts/${id}`, payload).then(r => r.data);
export const deleteBankAccount = (id) => client.delete(`/bank-accounts/${id}`).then(r => r.data);

// Payment Gateways
export const stripeCreateIntent = (payload) => client.post('/payments/stripe/intent', payload).then(r => r.data);
export const flutterwaveVerify = (payload) => client.post('/payments/flutterwave/verify', payload).then(r => r.data);
export const paystackVerify = (payload) => client.post('/payments/paystack/verify', payload).then(r => r.data);

// Reports
export const revenueReport = () => client.get('/reports/revenue').then(r => r.data);
export const transactionReport = (params) => client.get('/reports/transactions', { params }).then(r => r.data);
export const invoiceReport = (params) => client.get('/reports/invoices', { params }).then(r => r.data);

// Commissions
export const listCommissions = (params) => client.get('/commissions', { params }).then(r => r.data);
export const createCommission = (payload) => client.post('/commissions', payload).then(r => r.data);
export const updateCommission = (id, payload) => client.put(`/commissions/${id}`, payload).then(r => r.data);
export const deleteCommission = (id) => client.delete(`/commissions/${id}`).then(r => r.data);
export const approveCommission = (id) => client.post(`/commissions/${id}/approve`).then(r => r.data);
export const payCommission = (id) => client.post(`/commissions/${id}/pay`).then(r => r.data);

// Commission Rules
export const listCommissionRules = (params) => client.get('/commission-rules', { params }).then(r => r.data);
export const createCommissionRule = (payload) => client.post('/commission-rules', payload).then(r => r.data);
export const updateCommissionRule = (id, payload) => client.put(`/commission-rules/${id}`, payload).then(r => r.data);
export const deleteCommissionRule = (id) => client.delete(`/commission-rules/${id}`).then(r => r.data);
export const calculateCommission = (payload) => client.post('/commissions/calculate', payload).then(r => r.data);

// Receipts
export const listReceipts = (params) => client.get('/receipts', { params }).then(r => r.data);
export const getReceipt = (id) => client.get(`/receipts/${id}`).then(r => r.data);
export const createReceipt = (payload) => client.post('/receipts', payload).then(r => r.data);
export const verifyReceipt = (id, payload) => client.post(`/receipts/${id}/verify`, payload || {}).then(r => r.data);
export const rejectReceipt = (id, payload) => client.post(`/receipts/${id}/reject`, payload).then(r => r.data);

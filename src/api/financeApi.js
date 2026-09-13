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

// Everything a buyer owns, in one call. No id means "mine"; an explicit id is
// an admin or upline realtor inspecting someone, authorised server-side.
export const getMyProperties = (userId) =>
  client.get(userId ? `/my-properties/${userId}` : '/my-properties').then(r => r.data);

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

/**
 * Top performing properties, units and clients, ranked by money RECEIVED.
 *
 * Computed in SQL rather than by grouping invoices in the browser: the
 * dashboard already ships a lot of rows to the client, and this would have
 * meant every payment as well.
 */
export const topPerformersReport = (params = {}) =>
  client.get('/reports/top-performers', { params }).then(r => r.data);
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

// The buyer's own corrections, allowed while a payment is pending or rejected.
// Refused server-side once it is approved or cancelled.
export const updateOwnReceipt = (id, payload) => client.put(`/receipts/${id}`, payload).then(r => r.data);
export const cancelOwnReceipt = (id) => client.post(`/receipts/${id}/cancel`, {}).then(r => r.data);

// Documents an admin attaches to an invoice. Listing is open to the invoice's
// owner; attaching and removing are staff-only, enforced server-side.
export const listInvoiceDocuments = (invoiceId) =>
  client.get(`/invoices/${invoiceId}/documents`).then(r => r.data);
export const attachInvoiceDocument = (invoiceId, payload) =>
  client.post(`/invoices/${invoiceId}/documents`, payload).then(r => r.data);
export const deleteInvoiceDocument = (invoiceId, docId) =>
  client.delete(`/invoices/${invoiceId}/documents/${docId}`).then(r => r.data);

// ── Installment plans (the property purchase journey) ────────────────────────
// Distinct from the payment plans above, which are the subscription price list.
export const listInstallmentPlans = (params) => client.get('/installment-plans', { params }).then(r => r.data);
export const getInstallmentPlan = (id) => client.get(`/installment-plans/${id}`).then(r => r.data);
export const createInstallmentPlan = (payload) => client.post('/installment-plans', payload).then(r => r.data);
export const updateInstallmentPlan = (id, payload) => client.put(`/installment-plans/${id}`, payload).then(r => r.data);
export const deleteInstallmentPlan = (id) => client.delete(`/installment-plans/${id}`).then(r => r.data);
// Assignment is per property UNIT, not per property.
export const listPlansForUnit = (propertyUnitId) =>
  client.get(`/installment-plans/units/${propertyUnitId}`).then(r => r.data);
export const assignPlanToUnit = (planId, propertyUnitId) =>
  client.post(`/installment-plans/${planId}/units`, { property_unit_id: propertyUnitId }).then(r => r.data);
export const unassignPlanFromUnit = (planId, propertyUnitId) =>
  client.delete(`/installment-plans/${planId}/units/${propertyUnitId}`).then(r => r.data);

/**
 * Every plan available on a unit, with its total, monthly amount and surcharge
 * ALREADY CALCULATED for this quantity — plus the outright total to compare
 * against. The purchase screen displays these; it never derives them, and the
 * server reprices from the same code at checkout regardless of what is sent.
 */
export const getUnitPurchaseOptions = (propertyUnitId, quantity = 1) =>
  client.get(`/installment-plans/units/${propertyUnitId}/options`, { params: { quantity } }).then(r => r.data);

// ── Payment schedules and the allocation ledger ──────────────────────────────
export const getInvoiceSchedules = (invoiceId) => client.get(`/invoices/${invoiceId}/schedules`).then(r => r.data);
// Which payment contributed how much to which schedule, split fee/principal.
export const getInvoiceAllocations = (invoiceId) => client.get(`/invoices/${invoiceId}/allocations`).then(r => r.data);
// Recalculates totals and regenerates the whole schedule set. Unpaid invoices only.
export const updateInvoiceQuantity = (invoiceId, quantity) =>
  client.put(`/invoices/${invoiceId}/quantity`, { quantity }).then(r => r.data);
export const cancelInvoice = (invoiceId, payload) =>
  client.post(`/invoices/${invoiceId}/cancel`, payload || {}).then(r => r.data);
// Mandatory reason — it is recorded on the fee application as an audit entry.
export const waiveScheduleFee = (scheduleId, reason) =>
  client.post(`/payment-schedules/${scheduleId}/waive-fee`, { reason }).then(r => r.data);
// Overpayments held beyond every schedule, awaiting an admin decision.
export const listCreditBalances = () => client.get('/payment-schedules/credit-balances').then(r => r.data);

// ── Commission payout sequence ───────────────────────────────────────────────
// The earner's own view and request; approval and payment are the admin's.
export const getMyCommissions = () => client.get('/commissions/mine').then(r => r.data);
export const requestCommissionPayout = (id) =>
  client.post(`/commissions/${id}/request-payout`).then(r => r.data);
// No amount: a commission is paid in full or not at all.
export const payCommissionOut = (id, payload) =>
  client.post(`/commissions/${id}/pay`, payload || {}).then(r => r.data);

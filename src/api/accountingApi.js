import client from './client';

/**
 * The general ledger, payables and refunds.
 *
 * Three features that existed as API only until now. The ledger is the one
 * worth a word: nothing here writes a journal directly except a manual entry
 * and a CSV import, because every other journal is a consequence of a business
 * event rather than something a person types.
 */

// ── The chart of accounts (ACC-1) ───────────────────────────────────────────

export const listLedgerAccounts = (params) =>
  client.get('/ledger/accounts', { params }).then((r) => r.data?.data ?? []);

export const createLedgerAccount = (payload) =>
  client.post('/ledger/accounts', payload).then((r) => r.data?.data);

export const updateLedgerAccount = (id, payload) =>
  client.put(`/ledger/accounts/${id}`, payload).then((r) => r.data?.data);

/**
 * Deactivates rather than deletes once an account has been posted to — the API
 * decides which, and says so in the message it returns.
 */
export const deactivateLedgerAccount = (id) =>
  client.delete(`/ledger/accounts/${id}`).then((r) => r.data);

// ── The journal (ACC-2) ─────────────────────────────────────────────────────

export const listJournal = (params) =>
  client.get('/ledger/journal', { params }).then((r) => r.data?.data ?? []);

export const getJournalEntry = (id) =>
  client.get(`/ledger/journal/${id}`).then((r) => r.data?.data);

export const createManualJournal = (payload) =>
  client.post('/ledger/journal', payload).then((r) => r.data?.data);

/** The only correction there is — a posted entry is never edited. */
export const reverseJournalEntry = (id, reason) =>
  client.post(`/ledger/journal/${id}/reverse`, { reason }).then((r) => r.data?.data);

/**
 * A journal from a CSV (ACC-4.6) — a payroll bureau's monthly summary, a
 * depreciation schedule kept outside. `preview` checks without posting.
 */
export const importJournalCsv = (payload, { preview = false } = {}) =>
  client.post('/ledger/journal/import', payload, { params: preview ? { preview: 'true' } : {} })
    .then((r) => r.data);

export const trialBalance = (params) =>
  client.get('/ledger/trial-balance', { params }).then((r) => r.data?.data);

// ── Payables (ACC-4) ────────────────────────────────────────────────────────

export const listVendors = (params) =>
  client.get('/vendors', { params }).then((r) => r.data?.data ?? []);

export const createVendor = (payload) =>
  client.post('/vendors', payload).then((r) => r.data?.data);

export const updateVendor = (id, payload) =>
  client.put(`/vendors/${id}`, payload).then((r) => r.data?.data);

export const listBills = (params) =>
  client.get('/bills', { params }).then((r) => r.data?.data ?? []);

export const createBill = (payload) =>
  client.post('/bills', payload).then((r) => r.data?.data);

export const approveBill = (id) =>
  client.post(`/bills/${id}/approve`, {}).then((r) => r.data?.data);

export const rejectBill = (id, reason) =>
  client.post(`/bills/${id}/reject`, { reason }).then((r) => r.data?.data);

export const payBill = (id, payload) =>
  client.post(`/bills/${id}/pay`, payload).then((r) => r.data?.data);

export const agedPayables = (params) =>
  client.get('/bills/aged', { params }).then((r) => r.data?.data);

// ── Refunds (ACC-0.5) ───────────────────────────────────────────────────────

export const listRefunds = (params) =>
  client.get('/refunds', { params }).then((r) => r.data?.data ?? []);

export const approveRefund = (id) =>
  client.post(`/refunds/${id}/approve`, {}).then((r) => r.data?.data);

/** Refusing leaves the surplus on the plan, so it needs a reason. */
export const rejectRefund = (id, reason) =>
  client.post(`/refunds/${id}/reject`, { reason }).then((r) => r.data?.data);

export const markRefundPaid = (id, payload) =>
  client.post(`/refunds/${id}/pay`, payload).then((r) => r.data?.data);

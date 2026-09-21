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

// ── Development cost (ACC-10) ───────────────────────────────────────────────

export const listCostTypes = (params) =>
  client.get('/development/cost-types', { params }).then((r) => r.data?.data ?? []);

export const createCostType = (payload) =>
  client.post('/development/cost-types', payload).then((r) => r.data?.data);

export const updateCostType = (id, payload) =>
  client.put(`/development/cost-types/${id}`, payload).then((r) => r.data);

export const listCodingAccounts = () =>
  client.get('/development/coding-accounts').then((r) => r.data?.data ?? []);

export const listAccountingPolicies = () =>
  client.get('/development/policies').then((r) => r.data?.data ?? []);

export const saveAccountingPolicy = (payload) =>
  client.post('/development/policies', payload).then((r) => r.data?.data);

/** Every project carrying development cost, and the control account behind it. */
export const wipReport = (params) =>
  client.get('/development/wip', { params }).then((r) => r.data?.data);

export const projectCost = (propertyId) =>
  client.get(`/development/projects/${propertyId}`).then((r) => r.data?.data);

/** What the project is now expected to fetch — the write-down follows from it. */
export const assessNrv = (propertyId, payload) =>
  client.post(`/development/projects/${propertyId}/nrv`, payload).then((r) => r.data?.data);

export const releaseCatchUp = (propertyId, payload) =>
  client.post(`/development/projects/${propertyId}/catch-up`, payload).then((r) => r.data);

export const writeDownProject = (propertyId, payload) =>
  client.post(`/development/projects/${propertyId}/write-down`, payload).then((r) => r.data);

// ── Handover (ACC-8) ────────────────────────────────────────────────────────

export const listHandovers = (params) =>
  client.get('/handovers', { params }).then((r) => r.data?.data ?? []);

/** Sales whose revenue is still deferred, waiting for control to pass. */
export const awaitingHandover = (params) =>
  client.get('/handovers/awaiting', { params }).then((r) => r.data?.data ?? []);

export const deferredRevenue = (params) =>
  client.get('/handovers/deferred-revenue', { params }).then((r) => r.data?.data);

export const recordHandover = (payload) =>
  client.post('/handovers', payload).then((r) => r.data);

/** Revenue does not move until this is attached. */
export const attachAcknowledgement = (id, url) =>
  client.post(`/handovers/${id}/acknowledgement`, { acknowledgement_url: url }).then((r) => r.data);

export const reverseHandover = (id, reason) =>
  client.post(`/handovers/${id}/reverse`, { reason }).then((r) => r.data);

// ── The statements (ACC-5) ──────────────────────────────────────────────────

export const profitAndLoss = (params) =>
  client.get('/ledger/profit-and-loss', { params }).then((r) => r.data?.data);

export const balanceSheet = (params) =>
  client.get('/ledger/balance-sheet', { params }).then((r) => r.data?.data);

export const cashFlow = (params) =>
  client.get('/ledger/cash-flow', { params }).then((r) => r.data?.data);

/** Derived from the accrual ledger, never posted a second way. */
export const cashBasis = (params) =>
  client.get('/ledger/cash-basis', { params }).then((r) => r.data?.data);

export const agedReceivables = (params) =>
  client.get('/ledger/aged-receivables', { params }).then((r) => r.data?.data);

export const vatReturn = (params) =>
  client.get('/ledger/vat-return', { params }).then((r) => r.data?.data);

export const withholdingSchedule = (params) =>
  client.get('/ledger/withholding', { params }).then((r) => r.data?.data);

/** Every statement from one read, so they cannot straddle a posting. */
export const statementPack = (params) =>
  client.get('/ledger/pack', { params }).then((r) => r.data?.data);

/**
 * The journal as CSV — the exit guarantee.
 *
 * Fetched as text and handed back, because the viewer sandbox blocks a page
 * from starting its own download; the caller decides what to do with it.
 */
export const exportJournalCsv = (params) =>
  client.get('/ledger/export', { params, responseType: 'text' }).then((r) => r.data);

// ── Period close (ACC-7) ────────────────────────────────────────────────────

export const listPeriods = () =>
  client.get('/periods').then((r) => r.data?.data ?? []);

/** A year of months, or one named period with its own dates. */
export const createPeriods = (payload) =>
  client.post('/periods', payload).then((r) => r.data);

/** Run the checklist without closing anything. */
export const checkPeriod = (id) =>
  client.get(`/periods/${id}/check`).then((r) => r.data?.data);

export const closePeriod = (id) =>
  client.post(`/periods/${id}/close`, {}).then((r) => r.data);

/** Permissioned separately, and refused without a reason. */
export const reopenPeriod = (id, reason) =>
  client.post(`/periods/${id}/reopen`, { reason }).then((r) => r.data);

/** The statements, journals and reconciliations for a closed period. */
export const auditPack = (id) =>
  client.get(`/periods/${id}/audit-pack`).then((r) => r.data?.data);

// ── Bank reconciliation (ACC-6) ─────────────────────────────────────────────

export const bankRecAccounts = () =>
  client.get('/bank-rec/accounts').then((r) => r.data?.data ?? []);

export const bankMappings = (kind = 'bank_statement') =>
  client.get('/bank-rec/mappings', { params: { kind } }).then((r) => r.data?.data ?? []);

/** `preview` reads the file and says what would happen, without writing. */
export const importStatement = (payload, { preview = false } = {}) =>
  client.post('/bank-rec/import', payload, { params: preview ? { preview: 'true' } : {} })
    .then((r) => r.data);

export const bankLines = (params) =>
  client.get('/bank-rec/lines', { params }).then((r) => r.data?.data ?? []);

/** Candidates for each unmatched line. Nothing is matched automatically. */
export const bankSuggestions = (params) =>
  client.get('/bank-rec/suggestions', { params }).then((r) => r.data);

export const bankSummary = (params) =>
  client.get('/bank-rec/summary', { params }).then((r) => r.data?.data);

export const matchBankLine = (id, entryId) =>
  client.post(`/bank-rec/lines/${id}/match`, { entry_id: entryId }).then((r) => r.data);

export const unmatchBankLine = (id) =>
  client.post(`/bank-rec/lines/${id}/unmatch`, {}).then((r) => r.data);

/** Bank charges and interest — the bank is the only document there is. */
export const postBankLine = (id, payload) =>
  client.post(`/bank-rec/lines/${id}/post`, payload).then((r) => r.data);

export const ignoreBankLine = (id, reason) =>
  client.post(`/bank-rec/lines/${id}/ignore`, { reason }).then((r) => r.data);

export const lockReconciliation = (payload) =>
  client.post('/bank-rec/lock', payload).then((r) => r.data);

export const listReconciliations = () =>
  client.get('/bank-rec/reconciliations').then((r) => r.data?.data ?? []);

// ── Moving a company's books in (ACC-9) ─────────────────────────────────────

export const migrationStatus = () =>
  client.get('/migration/status').then((r) => r.data?.data);

/** The five types, and what each package calls them. */
export const migrationTypes = () =>
  client.get('/migration/types').then((r) => r.data?.data);

export const importChart = (payload, { preview = false } = {}) =>
  client.post('/migration/chart', payload, { params: preview ? { preview: 'true' } : {} })
    .then((r) => r.data);

/** Will not post without the tenant's own written confirmation. */
export const importOpeningBalances = (payload, { preview = false } = {}) =>
  client.post('/migration/opening-balances', payload, { params: preview ? { preview: 'true' } : {} })
    .then((r) => r.data);

export const importOpenItems = (payload, { preview = false } = {}) =>
  client.post('/migration/open-items', payload, { params: preview ? { preview: 'true' } : {} })
    .then((r) => r.data);

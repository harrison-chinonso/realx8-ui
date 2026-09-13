/**
 * How a confirmed payment was made.
 *
 * The API serves this list on payment-options, from the same constant its
 * validation uses, so the picker and the check cannot drift. What is here is
 * only the fallback for a response that predates the field.
 *
 * `admin_approved` is absent from the choosable list on purpose: it is not
 * something an admin picks, it is what "Mark invoice as paid" stamps on a
 * payment that has no proof. It still needs a label, because rows carrying it
 * are displayed.
 *
 * Shared rather than duplicated because there are two places an admin confirms
 * a payment — the invoice's settlement panel and the Payment Approvals queue —
 * and a list that existed in only one of them is exactly how the queue came to
 * send no method at all.
 */
export const CONFIRMABLE_METHOD_FALLBACK = ['bank_deposit', 'transfer', 'online_payment'];

export const METHOD_LABELS = {
  bank_deposit: 'Bank deposit',
  transfer: 'Bank transfer',
  online_payment: 'Online payment',
  admin_approved: 'Admin approved (no proof)',
};

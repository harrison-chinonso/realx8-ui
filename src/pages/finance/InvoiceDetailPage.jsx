import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getInvoice, updateInvoice, sendInvoice, payInvoice, getInvoicePayments, listBankAccounts } from '../../api/financeApi';
import { useCurrency, useAppearance } from '../../context/useAppearance';
import { openReceipt } from '../../utils/receiptDocument';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import useAuthStore from '../../store/authStore';
import PayInvoiceModal from '../../components/finance/PayInvoiceModal';
import InvoiceSettlementPanel from '../../components/finance/InvoiceSettlementPanel';
import InvoiceDocumentsPanel from '../../components/finance/InvoiceDocumentsPanel';
import PaymentSchedulePanel from '../../components/finance/PaymentSchedulePanel';
import Table from '../../components/common/Table';
import Select from '../../components/ui/Select';
/**
 * MoneyInput was used in the Edit and Record Payment modals without ever being
 * imported. A bare identifier is valid syntax, so the build succeeded and it
 * threw ReferenceError only when a modal rendered — which unmounts the React
 * tree and leaves a blank white page. That is what both buttons did.
 */
import MoneyInput from '../../components/ui/MoneyInput';
import { enumLabel } from '../../utils/enumLabel';
import FieldMark from '../../components/ui/FieldMark';
import { safeHref } from '../../utils/safeHref';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none`;
const MODAL_OVERLAY_CLASS = 'fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4';
const MODAL_CARD_CLASS = 'bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto';
const SAVE_BUTTON_CLASS = 'px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60';
const CANCEL_BUTTON_CLASS = 'px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium';

const emptyEditForm = {
  invoice_id: '',
  client_id: '',
  amount: '',
  due_date: '',
  status: 'draft',
  discount: '',
};

const emptyPaymentForm = {
  payment_method: 'cash',
  amount: '',
  reference: '',
  note: '',
};

const getData = (response) => response?.data ?? response ?? null;
const getItems = (response) => response?.data ?? response ?? [];
const toDateInput = (value) => (value ? String(value).slice(0, 10) : '');
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');
const formatValue = (value) => (value === null || value === undefined || value === '' ? '—' : value);

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const fmt = useCurrency();
  const appearance = useAppearance();
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  // null | 'missing' | 'unavailable' — see loadData.
  const [loadError, setLoadError] = useState(null);
  const [paymentsFailed, setPaymentsFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  // Buyers (client or realtor) get a read-only invoice: no editing, no marking
  // sent, no recording payments against themselves. They pay and upload proof;
  // an admin confirms it.
  const isBuyer = ['client', 'realtor'].includes(useAuthStore((s) => s.effectiveType()));
  const [showPayModal, setShowPayModal] = useState(false);
  // Staff only: which bank account this invoice should be paid into. Empty means
  // the buyer sees every active company account instead.
  const [bankAccounts, setBankAccounts] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);

  useEffect(() => {
    if (isBuyer) return;
    // Buyers must never fetch the account list; they get only what
    // /payment-options exposes for their own invoice.
    listBankAccounts().then((res) => setBankAccounts(res?.data ?? [])).catch(() => setBankAccounts([]));
  }, [isBuyer]);

  /**
   * The invoice and its payment history are fetched INDEPENDENTLY.
   *
   * They used to be a single Promise.all with one catch, which meant any
   * failure of either call blanked the page to "Invoice not found." — including
   * a failure of the payments call, a network blip, or the finance service
   * still coming up after a restart. The invoice was right there and the page
   * said it did not exist, so everybody went looking for a missing invoice
   * instead of the request that actually failed. A buyer who had just been sent
   * here by "Proceed to Payment" was told the thing they had that second
   * created was not found.
   *
   * Now: the invoice decides whether there is a page, and the payment history
   * is additive. A 404 means gone; anything else means "could not load", which
   * is a different sentence with a different remedy — and is offered a retry
   * rather than a dead end.
   */
  const loadData = async () => {
    setLoading(true);
    try {
      const invoiceResponse = await getInvoice(id);
      setInvoice(getData(invoiceResponse));
      setLoadError(null);
      setPaymentsFailed(false);
    } catch (error) {
      console.error(error);
      setInvoice(null);
      setLoadError(error?.response?.status === 404 ? 'missing' : 'unavailable');
      setPayments([]);
      setLoading(false);
      return;
    }

    try {
      setPayments(getItems(await getInvoicePayments(id)));
    } catch (error) {
      // The invoice still renders. Its payment history is one panel, and an
      // empty one is a far smaller lie than "this invoice does not exist".
      console.error(error);
      setPayments([]);
      setPaymentsFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const openEditModal = () => {
    if (!invoice) return;
    setEditForm({
      invoice_id: invoice.invoice_id || '',
      client_id: invoice.client_id ?? '',
      amount: invoice.amount ?? '',
      due_date: toDateInput(invoice.due_date),
      status: invoice.status || 'draft',
      discount: invoice.discount ?? '',
    });
    setShowEditModal(true);
  };

  const closeEditModal = (force = false) => {
    if (savingEdit && !force) return;
    setShowEditModal(false);
    setEditForm(emptyEditForm);
  };

  const closePaymentModal = (force = false) => {
    if (savingPayment && !force) return;
    setShowPaymentModal(false);
    setPaymentForm(emptyPaymentForm);
  };

  const handleSendInvoice = async () => {
    setSending(true);
    try {
      await sendInvoice(id);
      await loadData();
    } catch (error) {
      console.error(error);
      alert('Failed to mark invoice as sent.');
    } finally {
      setSending(false);
    }
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setSavingEdit(true);
    try {
      await updateInvoice(id, {
        invoice_id: editForm.invoice_id.trim(),

        amount: Number(editForm.amount),
        due_date: editForm.due_date || null,
        // Never allow downgrading from 'paid' — preserve current status if locked
        status: invoice?.status === 'paid' ? 'paid' : editForm.status,
        discount: editForm.discount === '' ? null : Number(editForm.discount),
        tax_id: invoice?.tax_id ?? null,
      });
      await loadData();
      closeEditModal(true);
    } catch (error) {
      console.error(error);
      alert('Failed to update invoice.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePaymentSubmit = async (event) => {
    event.preventDefault();
    setSavingPayment(true);
    try {
      await payInvoice(id, {
        payment_method: paymentForm.payment_method,
        amount: Number(paymentForm.amount),
        reference: paymentForm.reference.trim(),
        note: paymentForm.note.trim() || null,
      });
      await loadData();
      closePaymentModal(true);
    } catch (error) {
      console.error(error);
      alert('Failed to record payment.');
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading) return <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">Loading invoice...</div>;

  if (!invoice) {
    return (
      <div className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-slate-700">
          {loadError === 'missing'
            ? 'This invoice does not exist, or it is not one of yours.'
            : 'This invoice could not be loaded just now. It has not gone anywhere — please try again.'}
        </p>
        <div className="flex gap-2">
          {loadError !== 'missing' && (
            <Button type="button" onClick={loadData}>Try again</Button>
          )}
          <Link to="/finance/my-invoices">
            <Button type="button" variant="secondary">Back to my invoices</Button>
          </Link>
        </div>
      </div>
    );
  }

  /**
   * Settled, cancelled or expired: nothing further can be recorded against it.
   * Read from the invoice's own status so this agrees with what the server will
   * accept — the buttons are hidden for the same reason the endpoints refuse.
   */
  const isSettled = ['paid', 'cancelled', 'expired'].includes(invoice.status);

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <Link to={isBuyer ? '/finance/my-invoices' : '/finance/invoices'} className="text-sm text-blue-600 hover:underline">← Back</Link>
            <h1 className="text-xl font-semibold">Invoice Details</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {isBuyer ? (
              !['paid', 'cancelled'].includes(invoice.status) && (
                <Button onClick={() => setShowPayModal(true)}>Make Payment</Button>
              )
            ) : (
              <>
                {/*
                  * Mark as Sent issues a DRAFT. Offering it on an invoice that
                  * has already been issued invited re-notifying a client about
                  * an invoice they are already paying.
                  */}
                {invoice.status === 'draft' && (
                  <Button onClick={handleSendInvoice} disabled={sending}>
                    {sending ? 'Sending…' : 'Mark as Sent'}
                  </Button>
                )}
                {/*
                  * A settled invoice takes no more money and its figures are an
                  * accounting record. Recording a payment against it would
                  * create an overpayment, and editing it would restate a total
                  * that has already been paid — so neither is offered.
                  */}
                {!isSettled && (
                  <>
                    <Button variant="secondary" onClick={() => setShowPaymentModal(true)}>Record Payment</Button>
                    <Button variant="secondary" onClick={openEditModal}>Edit Invoice</Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Invoice #</div>
            <div className="mt-1 text-sm text-slate-800">{formatValue(invoice.invoice_id)}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Client</div>
            {/* The API resolves client_id to a name; the id is a fallback for
                an invoice whose client no longer exists. */}
            <div className="mt-1 text-sm text-slate-800">
              {invoice.client_name || formatValue(invoice.client_id)}
            </div>
            {invoice.client_email && (
              <div className="text-xs text-slate-500">{invoice.client_email}</div>
            )}
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Amount</div>
            <div className="mt-1 text-sm text-slate-800">{fmt(invoice.amount || 0)}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Due Date</div>
            <div className="mt-1 text-sm text-slate-800">{formatDate(invoice.due_date)}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</div>
            <div className="mt-1"><Badge value={invoice.status || 'draft'} /></div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Discount</div>
            <div className="mt-1 text-sm text-slate-800">{formatValue(invoice.discount)}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Tax ID</div>
            <div className="mt-1 text-sm text-slate-800">{formatValue(invoice.tax_id)}</div>
          </div>
        </div>

        {/*
          * What was actually bought.
          *
          * The grid above names the property and nothing else, so a buyer
          * holding an invoice for one of three units in the same development
          * could not tell which one it was for, or how many. `purchase` comes
          * from the purchase request that raised the invoice — absent on an
          * invoice raised by hand, which is why the whole block is conditional
          * rather than rendering a row of dashes.
          */}
        {(invoice.property_name || invoice.purchase) && (
          <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              What this invoice is for
            </div>
            <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-xs text-slate-500">Property</div>
                <div className="mt-0.5 text-sm font-medium text-slate-900">
                  {invoice.property_name || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Unit</div>
                <div className="mt-0.5 text-sm text-slate-800">
                  {invoice.purchase?.unit_label || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Quantity</div>
                <div className="mt-0.5 text-sm text-slate-800">
                  {invoice.purchase?.quantity ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Unit price</div>
                <div className="mt-0.5 text-sm text-slate-800">
                  {invoice.purchase?.unit_price ? fmt(invoice.purchase.unit_price) : '—'}
                </div>
              </div>
            </div>
            {/* capitalize goes on the MODE, not the sentence. On the paragraph
                it title-cased the lot: "Purchased On Installment Terms." */}
            {invoice.purchase?.payment_mode && (
              <p className="mt-3 text-xs text-slate-500">
                Purchased on{' '}
                <span className="capitalize">{String(invoice.purchase.payment_mode).replace(/_/g, ' ')}</span>
                {' '}terms.
              </p>
            )}
          </div>
        )}
      </div>

      {/*
        * The plan and its schedule table, for BOTH audiences — a buyer needs to
        * see what they owe and when at least as much as staff do. Renders
        * nothing for an invoice with no payment plan.
        */}
      <PaymentSchedulePanel invoiceId={id} onChanged={loadData} />

      {!isBuyer && <InvoiceSettlementPanel invoiceId={id} onChanged={loadData} />}

      {/*
        * Both audiences, different affordances: staff attach and remove, the
        * buyer reads and downloads. The panel decides from `canManage` rather
        * than being rendered twice.
        */}
      <InvoiceDocumentsPanel invoiceId={id} canManage={!isBuyer} />

      {!isBuyer && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Payment Account</h2>
            <p className="text-sm text-slate-500">
              Pin this invoice to one bank account, or leave it unset and the buyer sees every active one.{' '}
              <Link to="/finance/bank-accounts" className="font-semibold hover:underline" style={{ color: 'var(--primary)' }}>
                Manage bank accounts
              </Link>
              {' '}to add one or change which are shown to buyers.
            </p>
          </div>
          {assignError && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{assignError}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={invoice.bank_account_id ?? ''}
              disabled={assigning}
              onChange={async (event) => {
                const value = event.target.value;
                setAssigning(true);
                setAssignError('');
                try {
                  await updateInvoice(id, { bank_account_id: value === '' ? null : Number(value) });
                  await loadData();
                } catch (err) {
                  setAssignError(err?.response?.data?.message || err?.userMessage || 'Could not assign that account.');
                } finally {
                  setAssigning(false);
                }
              }}
              className="min-w-[16rem] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">All active company accounts</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id} disabled={!account.is_active}>
                  {account.bank_name} — {account.account_number}
                  {account.is_active ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
            {assigning && <span className="text-xs text-slate-400">Saving…</span>}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
        <h2 className="text-lg font-semibold">Payment History</h2>
        {/*
          An empty table and a table that failed to load look identical, and
          the difference matters here: "no payments yet" and "we could not
          read your payments" lead to opposite conclusions about whether the
          money arrived.
        */}
        {paymentsFailed && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-warning-surface px-4 py-2 text-sm text-warning">
            <span>Your payment history could not be loaded. This does not affect the invoice itself.</span>
            <button type="button" onClick={loadData} className="font-semibold underline underline-offset-2">
              Try again
            </button>
          </div>
        )}
        <Table
          columns={[
            { key: 'payment_method', label: 'Method', render: (row) => enumLabel(row.payment_method) },
            { key: 'amount', label: 'Amount', render: (row) => fmt(row.amount || 0) },
            { key: 'reference', label: 'Reference', render: (row) => row.reference || '—' },
            { key: 'status', label: 'Status', render: (row) => <Badge value={row.status || 'pending'} /> },
            { key: 'date', label: 'Date', render: (row) => formatDate(row.paid_at || row.createdAt || row.created_at || row.date) },
            {
              /**
               * The receipt the COMPANY issued for this payment.
               *
               * Distinct from the proof beside it, and the pair is the whole
               * story of a payment: the buyer's evidence that they paid, and
               * the company's acknowledgement that they did.
               */
              key: 'receipt',
              label: 'Receipt',
              render: (row) => (row.proof?.receipt_id || row.proof?.company_receipt_url ? (
                <button
                  type="button"
                  onClick={() => openReceipt(
                    { id: row.proof.receipt_id, company_receipt_url: row.proof.company_receipt_url },
                    { appearance, fmt },
                  )}
                  className="font-medium hover:underline"
                  style={{ color: 'var(--primary)' }}
                >
                  Receipt
                </button>
              ) : <span className="text-xs text-slate-400">—</span>),
            },
            {
              /**
               * The proof this payment was approved from.
               *
               * Once a proof is confirmed it leaves the review queue, so the
               * document had nowhere left to be reached from. The history is
               * its permanent home — and the place anyone questioning a payment
               * would look for it.
               */
              key: 'proof',
              label: 'Proof',
              render: (row) => (row.proof?.document_url ? (
                <a
                  href={safeHref(row.proof.document_url) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                  style={{ color: 'var(--primary)' }}
                  title={row.proof.receipt_number}
                >
                  View proof
                </a>
              ) : (
                // An admin-approved payment has none by definition, which is
                // worth saying rather than leaving blank.
                <span className="text-xs text-slate-400">
                  {row.payment_method === 'admin_approved' ? 'None — admin approved' : '—'}
                </span>
              )),
            },
          ]}
          rows={payments}
        />
      </div>

      {!isBuyer && showEditModal && (
        <div className={MODAL_OVERLAY_CLASS}>
          <div className={MODAL_CARD_CLASS}>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Edit Invoice</h2>
              <p className="text-sm text-slate-500">Update invoice details below.</p>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Invoice #<FieldMark required /></span>
                <input
                  value={editForm.invoice_id}
                  onChange={(event) => setEditForm((current) => ({ ...current, invoice_id: event.target.value }))}
                  className={INPUT_CLASS}
                  required
                />
              </label>
              {/*
                * The client is shown, not editable — and the API refuses a
                * change too. An invoice is addressed to one party: repointing
                * it would move the payments, schedules, inventory hold and any
                * commission to somebody who never agreed to the purchase, while
                * keeping the reference already sent to the original buyer.
                */}
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Client</span>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {invoice.client_name || `#${invoice.client_id}`}
                </div>
                <span className="text-xs text-slate-500">
                  Cannot be changed. Cancel this invoice and raise a new one for a different client.
                </span>
              </div>
              <MoneyInput
                label="Amount"
                value={editForm.amount}
                onChange={(value) => setEditForm((current) => ({ ...current, amount: value }))}
              />
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Due Date<FieldMark /></span>
                <input
                  type="date"
                  value={editForm.due_date}
                  onChange={(event) => setEditForm((current) => ({ ...current, due_date: event.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Status<FieldMark /></span>
                {invoice?.status === 'paid' ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 font-medium">
                    <span>✓ Paid — status is locked and cannot be changed</span>
                  </div>
                ) : (
                  <Select
                    value={editForm.status}
                    onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                    className={INPUT_CLASS}
                  >
                    <option value="draft">{enumLabel('draft')}</option>
                    <option value="sent">{enumLabel('sent')}</option>
                    <option value="overdue">{enumLabel('overdue')}</option>
                  </Select>
                )}
              </label>
              <MoneyInput
                label="Discount"
                value={editForm.discount}
                onChange={(value) => setEditForm((current) => ({ ...current, discount: value }))}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closeEditModal}>Cancel</Button>
                <Button type="submit"  disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isBuyer && showPaymentModal && (
        <div className={MODAL_OVERLAY_CLASS}>
          <div className={MODAL_CARD_CLASS}>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Record Payment</h2>
              <p className="text-sm text-slate-500">Add a payment for this invoice.</p>
            </div>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Payment Method<FieldMark /></span>
                <Select
                  value={paymentForm.payment_method}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, payment_method: event.target.value }))}
                  className={INPUT_CLASS}
                >
                  {/* The three the API confirms a payment as, first — see
                      CONFIRMABLE_PAYMENT_METHODS in financeController. The
                      gateway names follow, for a payment taken online. */}
                  {['bank_deposit', 'transfer', 'online_payment',
                    'cash', 'bank_transfer', 'card', 'stripe', 'paystack', 'flutterwave',
                  ].map((method) => (
                    <option key={method} value={method}>{enumLabel(method)}</option>
                  ))}
                </Select>
              </label>
              <MoneyInput
                label="Amount"
                value={paymentForm.amount}
                onChange={(value) => setPaymentForm((current) => ({ ...current, amount: value }))}
              />
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Reference<FieldMark required /></span>
                <input
                  value={paymentForm.reference}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
                  className={INPUT_CLASS}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Note<FieldMark /></span>
                <textarea
                  rows={3}
                  value={paymentForm.note}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))}
                  className={TEXTAREA_CLASS}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closePaymentModal}>Cancel</Button>
                <Button type="submit"  disabled={savingPayment}>{savingPayment ? 'Saving…' : 'Save'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      <PayInvoiceModal
        invoiceId={id}
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        onSubmitted={() => { setShowPayModal(false); loadData(); }}
      />

    </div>
  );
}

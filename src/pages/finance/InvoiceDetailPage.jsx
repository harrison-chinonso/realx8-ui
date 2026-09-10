import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getInvoice, updateInvoice, sendInvoice, payInvoice, getInvoicePayments, listBankAccounts } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import useAuthStore from '../../store/authStore';
import PayInvoiceModal from '../../components/finance/PayInvoiceModal';
import InvoiceSettlementPanel from '../../components/finance/InvoiceSettlementPanel';
import PaymentSchedulePanel from '../../components/finance/PaymentSchedulePanel';
import Table from '../../components/common/Table';
import Select from '../../components/ui/Select';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none`;
const MODAL_OVERLAY_CLASS = 'fixed inset-0 bg-black/40 z-50 flex items-center justify-center';
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
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoiceResponse, paymentsResponse] = await Promise.all([
        getInvoice(id),
        getInvoicePayments(id),
      ]);
      setInvoice(getData(invoiceResponse));
      setPayments(getItems(paymentsResponse));
    } catch (error) {
      console.error(error);
      setInvoice(null);
      setPayments([]);
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
        client_id: Number(editForm.client_id),
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
  if (!invoice) return <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">Invoice not found.</div>;

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
                <Button onClick={handleSendInvoice} disabled={sending}>{sending ? 'Sending...' : 'Mark as Sent'}</Button>
                <Button variant="secondary" onClick={() => setShowPaymentModal(true)}>Record Payment</Button>
                <Button variant="secondary" onClick={openEditModal}>Edit Invoice</Button>
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
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Client ID</div>
            <div className="mt-1 text-sm text-slate-800">{formatValue(invoice.client_id)}</div>
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
      </div>

      {/*
        * The plan and its schedule table, for BOTH audiences — a buyer needs to
        * see what they owe and when at least as much as staff do. Renders
        * nothing for an invoice with no payment plan.
        */}
      <PaymentSchedulePanel invoiceId={id} onChanged={loadData} />

      {!isBuyer && <InvoiceSettlementPanel invoiceId={id} onChanged={loadData} />}

      {!isBuyer && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Payment Account</h2>
            <p className="text-sm text-slate-500">
              Pin this invoice to one bank account. Leave it unset and the buyer sees every active company account.{' '}
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
        <Table
          columns={[
            { key: 'payment_method', label: 'Method', render: (row) => row.payment_method || '—' },
            { key: 'amount', label: 'Amount', render: (row) => fmt(row.amount || 0) },
            { key: 'reference', label: 'Reference', render: (row) => row.reference || '—' },
            { key: 'status', label: 'Status', render: (row) => <Badge value={row.status || 'pending'} /> },
            { key: 'date', label: 'Date', render: (row) => formatDate(row.paid_at || row.createdAt || row.created_at || row.date) },
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
                <span className="text-sm font-medium text-slate-700">Invoice #</span>
                <input
                  value={editForm.invoice_id}
                  onChange={(event) => setEditForm((current) => ({ ...current, invoice_id: event.target.value }))}
                  className={INPUT_CLASS}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Client ID</span>
                <input
                  type="number"
                  value={editForm.client_id}
                  onChange={(event) => setEditForm((current) => ({ ...current, client_id: event.target.value }))}
                  className={INPUT_CLASS}
                  required
                />
              </label>
              <MoneyInput
                label="Amount"
                value={editForm.amount}
                onChange={(value) => setEditForm((current) => ({ ...current, amount: value }))}
              />
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Due Date</span>
                <input
                  type="date"
                  value={editForm.due_date}
                  onChange={(event) => setEditForm((current) => ({ ...current, due_date: event.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Status</span>
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
                    <option value="draft">draft</option>
                    <option value="sent">sent</option>
                    <option value="overdue">overdue</option>
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
                <Button type="submit"  disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save'}</Button>
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
                <span className="text-sm font-medium text-slate-700">Payment Method</span>
                <Select
                  value={paymentForm.payment_method}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, payment_method: event.target.value }))}
                  className={INPUT_CLASS}
                >
                  <option value="cash">cash</option>
                  <option value="bank_transfer">bank_transfer</option>
                  <option value="card">card</option>
                  <option value="stripe">stripe</option>
                  <option value="paystack">paystack</option>
                  <option value="flutterwave">flutterwave</option>
                </Select>
              </label>
              <MoneyInput
                label="Amount"
                value={paymentForm.amount}
                onChange={(value) => setPaymentForm((current) => ({ ...current, amount: value }))}
              />
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Reference</span>
                <input
                  value={paymentForm.reference}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
                  className={INPUT_CLASS}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Note</span>
                <textarea
                  rows={3}
                  value={paymentForm.note}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))}
                  className={TEXTAREA_CLASS}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closePaymentModal}>Cancel</Button>
                <Button type="submit"  disabled={savingPayment}>{savingPayment ? 'Saving...' : 'Save'}</Button>
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

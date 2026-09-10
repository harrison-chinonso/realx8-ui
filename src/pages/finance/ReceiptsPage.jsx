import { useEffect, useMemo, useState } from 'react';
import {
  createReceipt,
  listReceipts,
  rejectReceipt,
  verifyReceipt,
} from '../../api/financeApi';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import MoneyInput from '../../components/ui/MoneyInput';
import ActionsMenu from '../../components/common/ActionsMenu';
import { useCurrency } from '../../context/useAppearance';
import { enumLabel } from '../../utils/enumLabel';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const EMPTY_FORM = { amount: '', payment_method: '', invoice_id: '', notes: '' };

const getItems = (response) => response?.data ?? response ?? [];
const getErrorMessage = (error, fallback) => error?.userMessage || fallback;
const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function StatusBadge({ status }) {
  const key = String(status || 'pending').toLowerCase();
  const classes = {
    pending: 'bg-amber-100 text-amber-700',
    verified: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
  };

  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes[key] || 'bg-slate-100 text-slate-700'}`}>{status || 'pending'}</span>;
}

export default function ReceiptsPage() {
  const fmt = useCurrency();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [rejectingReceipt, setRejectingReceipt] = useState(null);
  // Reviewing opens the proof and lets the admin credit a different figure —
  // a part payment against a larger invoice.
  const [reviewing, setReviewing] = useState(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [rejectNotes, setRejectNotes] = useState('');
  const [message, setMessage] = useState(null);

  const setFeedback = (type, text) => {
    setMessage({ type, text });
  };

  const load = async () => {
    setLoading(true);
    try {
      const response = await listReceipts();
      setItems(getItems(response));
    } catch (error) {
      console.error(error);
      setItems([]);
      setFeedback('error', getErrorMessage(error, 'Failed to load receipts.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const closeAddModal = (force = false) => {
    if (saving && !force) return;
    setShowAddModal(false);
    setForm(EMPTY_FORM);
  };

  const closeRejectModal = (force = false) => {
    if (saving && !force) return;
    setRejectingReceipt(null);
    setRejectNotes('');
  };

  const handleAddReceipt = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createReceipt({
        amount: Number(form.amount),
        payment_method: form.payment_method.trim(),
        ...(form.invoice_id ? { invoice_id: Number(form.invoice_id) } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      closeAddModal(true);
      await load();
      setFeedback('success', 'Receipt created successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to create receipt.'));
    } finally {
      setSaving(false);
    }
  };

  const openReview = (receipt) => {
    setReviewing(receipt);
    setCreditAmount(String(receipt.amount ?? ''));
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!reviewing) return;
    setSaving(true);
    try {
      // The server clamps this to the outstanding balance — an invoice total
      // can never be exceeded, only its balance reduced.
      const result = await verifyReceipt(reviewing.id, { amount: Number(creditAmount) || undefined });
      const invoice = result?.data?.invoice;
      const credited = result?.data?.payment?.amount;
      setReviewing(null);
      await load();
      setFeedback('success', invoice
        ? `Credited ${fmt(credited)}. Invoice balance is now ${fmt(invoice.balance)}.`
        : 'Receipt verified.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to verify receipt.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (event) => {
    event.preventDefault();
    if (!rejectingReceipt) return;

    setSaving(true);
    try {
      await rejectReceipt(rejectingReceipt.id, { notes: rejectNotes.trim() || null });
      closeRejectModal(true);
      await load();
      setFeedback('success', `Receipt ${rejectingReceipt.receipt_number || rejectingReceipt.number || rejectingReceipt.id} rejected.`);
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to reject receipt.'));
    } finally {
      setSaving(false);
    }
  };

  const printReceipt = (receipt) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    const receiptNumber = receipt.receipt_number || receipt.number || `RCPT-${receipt.id}`;
    const html = `
      <html>
        <head>
          <title>Receipt ${escapeHtml(receiptNumber)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
            h1 { color: var(--primary, #2563eb); margin-bottom: 24px; }
            .row { margin-bottom: 12px; }
            .label { font-weight: 700; display: inline-block; min-width: 160px; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Receipt</h1>
            <div class="row"><span class="label">Receipt Number:</span> ${escapeHtml(receiptNumber)}</div>
            <div class="row"><span class="label">Amount:</span> ${escapeHtml(fmt(receipt.amount || 0))}</div>
            <div class="row"><span class="label">Payment Method:</span> ${escapeHtml(receipt.payment_method || '—')}</div>
            <div class="row"><span class="label">Status:</span> ${escapeHtml(receipt.status || 'pending')}</div>
            <div class="row"><span class="label">Date:</span> ${escapeHtml(formatDate(receipt.date || receipt.created_at || receipt.createdAt))}</div>
            <div class="row"><span class="label">Invoice ID:</span> ${escapeHtml(receipt.invoice_id || '—')}</div>
            <div class="row"><span class="label">Notes:</span> ${escapeHtml(receipt.notes || '—')}</div>
          </div>
        </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const columns = useMemo(() => [
    {
      key: 'receipt_number',
      label: 'Receipt Number',
      render: (row) => row.receipt_number || row.number || `RCPT-${row.id}`,
    },
    { key: 'amount', label: 'Amount', render: (row) => fmt(row.amount || 0) },
    {
      key: 'document_url',
      label: 'Proof',
      render: (row) => (row.document_url
        ? <a href={row.document_url} target="_blank" rel="noreferrer" className="text-xs font-semibold hover:underline" style={{ color: 'var(--primary)' }}>View</a>
        : <span className="text-xs text-slate-300">—</span>),
    },
    { key: 'payment_method', label: 'Payment Method', render: (row) => row.payment_method || '—' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date || row.created_at || row.createdAt) },
  ], [fmt]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Receipts</h1>
          <p className="text-sm text-slate-500">Track submitted receipts and approval status.</p>
        </div>
        <Button type="button" onClick={() => setShowAddModal(true)}>+ Add Receipt</Button>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading receipts...</div>
      ) : (
        <Table
          columns={columns}
          rows={items}
          renderActions={(row) => (
            <div className="flex items-center justify-end gap-2">
              {row.status === 'pending' ? (
                <>
                  <Button type="button" variant="success" size="sm" onClick={() => openReview(row)}>Review</Button>
                  <ActionsMenu
                    items={[
                      { label: '🖨 Print', onClick: () => printReceipt(row) },
                      { label: '✗ Reject', variant: 'danger', onClick: () => setRejectingReceipt(row) },
                    ]}
                  />
                </>
              ) : (
                <Button type="button" variant="secondary" size="sm" onClick={() => printReceipt(row)}>Print</Button>
              )}
            </div>
          )}
        />
      )}

      <Modal open={showAddModal} onClose={closeAddModal} title="Add Receipt" size="sm">
        <form onSubmit={handleAddReceipt} className="space-y-4">
          <MoneyInput
            label="Amount"
            value={form.amount}
            onChange={(amount) => setForm((current) => ({ ...current, amount }))}
          />
          <Input
            label="Payment Method"
            value={form.payment_method}
            onChange={(event) => setForm((current) => ({ ...current, payment_method: event.target.value }))}
            required
          />
          <Input
            label="Invoice ID"
            type="number"
            min="1"
            value={form.invoice_id}
            onChange={(event) => setForm((current) => ({ ...current, invoice_id: event.target.value }))}
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className={`${INPUT_CLASS} resize-none`}
              placeholder="Optional notes"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeAddModal} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Receipt'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(reviewing)} onClose={() => !saving && setReviewing(null)} title="Review Payment" size="sm">
        {reviewing && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
              <div className="flex justify-between"><span className="text-slate-500">Receipt</span><span className="font-medium">{reviewing.receipt_number}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-slate-500">Declared</span><span className="font-medium">{fmt(reviewing.amount || 0)}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-slate-500">Method</span><span className="font-medium">{enumLabel(reviewing.payment_method)}</span></div>
              {reviewing.reference && (
                <div className="mt-1 flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono text-xs">{reviewing.reference}</span></div>
              )}
            </div>

            {reviewing.document_url ? (
              <a href={reviewing.document_url} target="_blank" rel="noreferrer"
                 className="block rounded-lg border border-dashed border-slate-300 px-3 py-3 text-center text-sm font-medium hover:border-slate-400"
                 style={{ color: 'var(--primary)' }}>
                Open proof of payment
              </a>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">No proof was attached to this receipt.</p>
            )}

            <MoneyInput
              label="Amount to credit"
              value={creditAmount}
              onChange={setCreditAmount}
            />
            <p className="text-xs text-slate-400">
              Credit the full amount to settle the invoice, or a smaller figure to record an
              installment. The invoice total never changes — only its outstanding balance.
            </p>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setReviewing(null)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Recording...' : 'Confirm Payment'}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(rejectingReceipt)} onClose={closeRejectModal} title="Reject Receipt" size="sm">
        <form onSubmit={handleReject} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Rejection Notes</span>
            <textarea
              rows={4}
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
              className={`${INPUT_CLASS} resize-none`}
              placeholder="Why is this receipt being rejected?"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeRejectModal} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={saving}>{saving ? 'Rejecting...' : 'Reject Receipt'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

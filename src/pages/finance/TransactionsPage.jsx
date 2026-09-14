import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createTransaction, listTransactions, updateTransaction } from '../../api/financeApi';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import MoneyInput from '../../components/ui/MoneyInput';
import Badge from '../../components/common/Badge';
import { useCurrency } from '../../context/useAppearance';
import CompanySelect from '../../components/common/CompanySelect';
import useAuthStore from '../../store/authStore';
import Select from '../../components/ui/Select';
import { enumLabel } from '../../utils/enumLabel';

const EMPTY_FORM = { date: '', description: '', amount: '', type: 'credit', reference: '', company_id: '' };
const getItems = (response) => response?.data ?? response ?? [];
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');
const toApiPayload = (form) => {
  const payload = {
    description: form.description.trim(),
    amount: Number(form.amount),
    type: form.type,
    reference: form.reference.trim() || null,
    ...(form.company_id ? { company_id: Number(form.company_id) } : {}),
  };

  if (form.date) {
    payload.date = form.date;
    payload.createdAt = new Date(`${form.date}T00:00:00`).toISOString();
  }

  return payload;
};

/**
 * The record of payments that have SETTLED.
 *
 * ── Why there are no status tabs ────────────────────────────────────────────
 *
 * There used to be three — All, Pending, Completed — and they filtered
 * correctly. The problem was upstream of them: every `INSERT INTO transactions`
 * in the backend writes `status: 'completed'`, because a transaction row is
 * created BECAUSE a payment settled. The column only ever holds one value.
 *
 * So Pending was permanently empty and All was identical to Completed, which
 * reads exactly like a tab component that was never wired up — and was reported
 * as one. Tabs over a column with a single value are worse than no tabs: they
 * make a working page look broken, and they invite someone to go looking for
 * the filtering bug that is not there.
 *
 * A payment awaiting a decision is a `receipt`, not a transaction, and it has
 * its own screen — Payment Approvals. The link below says so, because "where
 * are the pending ones?" is the reasonable next question once the tabs are gone.
 */
export default function TransactionsPage() {
  const formatCurrency = useCurrency();
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await listTransactions();
      setItems(getItems(response));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing({});
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      date: String(row.date || row.createdAt || '').slice(0, 10),
      description: row.description || '',
      amount: row.amount ?? '',
      type: row.type || 'credit',
      reference: row.reference || '',
      company_id: row.company_id ? String(row.company_id) : '',
    });
  };

  const closeModal = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = toApiPayload(form);
      if (editing?.id) await updateTransaction(editing.id, payload);
      else await createTransaction(payload);
      await load();
      closeModal();
    } catch {
      alert('Failed to save transaction.');
    } finally {
      setSaving(false);
    }
  };


  /**
   * A completed payment is a record of money that moved, not a draft.
   *
   * Correcting one is an accounting action — a credit note, a reversing entry —
   * because the figure has already been reported, allocated against an invoice
   * and possibly paid commission on. Editing the row in place would change all
   * of those silently and leave no trace of what it used to say. The same rule
   * the receipts model states for a verified payment: approved means frozen.
   *
   * Hiding the button is the courtesy; the server refuses the write regardless,
   * because a hidden button is not a permission.
   */
  const FROZEN = ['completed', 'approved', 'paid', 'verified', 'cancelled', 'reversed'];
  const isFrozen = (row) => FROZEN.includes(String(row?.status || '').toLowerCase());

  const columns = [
    { header: 'Date', render: (row) => formatDate(row.date || row.createdAt) },
    { header: 'Description', accessor: 'description' },
    { header: 'Amount', render: (row) => formatCurrency(Number(row.amount || 0)) },
    { header: 'Type', render: (row) => <Badge value={row.type || '—'} /> },
    { header: 'Reference', render: (row) => row.reference || '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Payments</h1>
          <p className="text-sm text-slate-500">
            Payments that have settled. Anything still awaiting a decision is in{' '}
            <Link to="/receipts" className="font-medium underline underline-offset-2">
              Payment Approvals
            </Link>
            .
          </p>
        </div>
        <Button onClick={openCreate}>+ New Transaction</Button>
      </div>

      <Table
        columns={columns}
        data={items}
        loading={loading}
        renderActions={(row) => (
          <div className="flex justify-end gap-3">
            {isFrozen(row)
              ? (
                <span
                  className="text-xs text-slate-400"
                  title="This payment has been completed. Correct it with a credit note rather than an edit."
                >
                  Locked
                </span>
              )
              : <Button onClick={() => openEdit(row)} variant="primary" size="sm">Edit</Button>}
          </div>
        )}
      />

      <Modal open={editing !== null} onClose={closeModal} title={`${editing?.id ? 'Edit' : 'New'} Transaction`}>
        <form onSubmit={handleSave} className="space-y-3">
          {!editing?.id && isSuperiorAdmin && (
            <CompanySelect value={form.company_id} onChange={handleChange('company_id')} />
          )}
          <Input label="Date" type="date" value={form.date} onChange={handleChange('date')} required />
          <Input label="Description" value={form.description} onChange={handleChange('description')} required />
          <MoneyInput label="Amount" value={form.amount} onChange={(amount) => setForm((current) => ({ ...current, amount }))} required />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Type</span>
            <Select value={form.type} onChange={handleChange('type')}>
              <option value="credit">{enumLabel('credit')}</option>
              <option value="debit">{enumLabel('debit')}</option>
            </Select>
          </label>
          <Input label="Reference" value={form.reference} onChange={handleChange('reference')} />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

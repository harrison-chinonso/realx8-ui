import { useEffect, useState } from 'react';
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

const STATUS_TABS = [
  { key: 'all', label: 'All Payments', status: null },
  { key: 'pending', label: 'Pending', status: 'pending' },
  { key: 'completed', label: 'Completed', status: 'completed' },
];

/**
 * One page, one menu entry, tabs for the rest.
 *
 * Pending used to be its own menu item pointing at the same page, so both
 * entries highlighted together and neither actually filtered. `status` still
 * seeds the tab so /finance/transactions/pending keeps working as a deep link.
 */
export default function TransactionsPage({ status = null }) {
  const formatCurrency = useCurrency();
  const [tab, setTab] = useState(STATUS_TABS.find((t) => t.status === status)?.key ?? 'all');
  const activeStatus = STATUS_TABS.find((t) => t.key === tab)?.status ?? null;
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await listTransactions(activeStatus ? { status: activeStatus } : undefined);
      setItems(getItems(response));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeStatus]);

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
          <p className="text-sm text-slate-500">Manage finance transactions and references.</p>
        </div>
        <Button onClick={openCreate}>+ New Transaction</Button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {STATUS_TABS.map((item) => {
          const isActive = item.key === tab;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
              style={isActive ? { borderColor: 'var(--primary, #2563eb)' } : undefined}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <Table
        columns={columns}
        data={items}
        loading={loading}
        renderActions={(row) => (
          <div className="flex justify-end gap-3">
            <Button onClick={() => openEdit(row)} variant="primary" size="sm">Edit</Button>
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
              <option value="credit">credit</option>
              <option value="debit">debit</option>
            </Select>
          </label>
          <Input label="Reference" value={form.reference} onChange={handleChange('reference')} />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { listDebitNotes, createDebitNote, updateDebitNote, listTaxes } from '../../api/financeApi';
import PartySelect from '../../components/finance/PartySelect';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import MoneyInput from '../../components/ui/MoneyInput';
import { useCurrency } from '../../context/useAppearance';
import Select from '../../components/ui/Select';

const EMPTY_FORM = {
  debit_note_id: '',
  client_id: '',
  party_type: 'client',
  amount: '',
  tax_id: '',
  status: 'draft',
  description: '',
};

const STATUS_OPTIONS = ['draft', 'sent', 'paid'];

const getItems = (response) => response?.data ?? response ?? [];
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');
const getStatusOptions = (value) => [...new Set([...STATUS_OPTIONS, value].filter(Boolean))];

export default function DebitNotesPage() {
  const fmt = useCurrency();
  const [items, setItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listDebitNotes();
      setItems(getItems(res));
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    listTaxes().then((res) => setTaxes(getItems(res))).catch(() => setTaxes([]));
  }, []);

  const openCreate = () => {
    setEditing({});
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      debit_note_id: row.debit_note_id || '',
      client_id: row.client_id ?? '',
      party_type: row.party_type ?? 'client',
      amount: row.amount ?? '',
      tax_id: row.tax_id ?? '',
      status: row.status || 'draft',
      description: row.reason || row.description || '',
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
      const payload = {
        debit_note_id: form.debit_note_id.trim(),
        client_id: Number(form.client_id),
        party_type: form.party_type || 'client',
        amount: Number(form.amount),
        tax_id: form.tax_id ? Number(form.tax_id) : null,
        status: form.status,
        reason: form.description.trim() || null,
      };

      if (editing?.id) await updateDebitNote(editing.id, payload);
      else await createDebitNote(payload);

      await load();
      closeModal();
    } catch {
      alert('Failed to save debit note.');
    } finally {
      setSaving(false);
    }
  };


  const getTaxLabel = (row) => {
    const tax = row.tax || taxes.find((item) => item.id === row.tax_id);
    return tax ? `${tax.name} (${tax.rate}%)` : '—';
  };

  const columns = [
    { header: 'Debit Note #', accessor: 'debit_note_id' },
    {
      header: 'Raised against',
      accessor: 'client_id',
      render: (row) => (
        <span>
          {row.party_name || `#${row.client_id ?? '—'}`}
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
            {row.party_type || 'client'}
          </span>
        </span>
      ),
    },
    { header: 'Amount', render: (row) => fmt(Number(row.amount || 0)) },
    { header: 'Status', render: (row) => <Badge value={row.status} /> },
    { header: 'Tax', render: getTaxLabel },
    { header: 'Created At', render: (row) => formatDate(row.createdAt || row.created_at) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Debit Notes</h1>
        <Button onClick={openCreate}>+ New Debit Note</Button>
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
      <Modal open={editing !== null} onClose={closeModal} title={`${editing?.id ? 'Edit' : 'New'} Debit Note`}>
        <form onSubmit={handleSave} className="space-y-3">
          <Input label="Debit Note #" value={form.debit_note_id} onChange={handleChange('debit_note_id')} placeholder="DN-001" required />
          <PartySelect
            partyType={form.party_type}
            userId={form.client_id}
            onChange={(next) => setForm((f) => ({ ...f, ...next }))}
            required
          />
          <MoneyInput label="Amount" value={form.amount} onChange={(amount) => setForm((current) => ({ ...current, amount }))} required />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Tax</span>
            <Select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={form.tax_id}
              onChange={handleChange('tax_id')}
            >
              <option value="">No tax</option>
              {taxes.map((tax) => (
                <option key={tax.id} value={tax.id}>
                  {tax.name} ({tax.rate}%)
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <Select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={form.status}
              onChange={handleChange('status')}
            >
              {getStatusOptions(form.status).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              rows={4}
              value={form.description}
              onChange={handleChange('description')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

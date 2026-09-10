import { useEffect, useState } from 'react';
import { createPaymentPlan, listPaymentPlans, updatePaymentPlan } from '../../api/financeApi';
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

const EMPTY_FORM = { name: '', total_amount: '', installments: '', frequency: 'monthly', description: '', company_id: '' };
const getItems = (response) => response?.data ?? response ?? [];
const getPlanMeta = (row) => (row?.features && typeof row.features === 'object' ? row.features : {});
const getStatus = (row) => row?.status || (row?.is_active === false ? 'inactive' : 'active');
const parseFrequency = (row) => {
  const meta = getPlanMeta(row);
  if (meta.frequency) return meta.frequency;
  if (row?.frequency) return row.frequency;
  const duration = String(row?.duration || '').toLowerCase();
  if (duration.includes('quarter')) return 'quarterly';
  if (duration.includes('annual') || duration.includes('year')) return 'annually';
  return 'monthly';
};
const parseInstallments = (row) => {
  const meta = getPlanMeta(row);
  if (meta.installments !== undefined && meta.installments !== null) return meta.installments;
  if (row?.installments !== undefined && row.installments !== null) return row.installments;
  const match = String(row?.duration || '').match(/\d+/);
  return match ? Number(match[0]) : '';
};
const toForm = (row) => ({
  name: row?.name || '',
  total_amount: row?.total_amount ?? row?.price ?? getPlanMeta(row).total_amount ?? '',
  installments: parseInstallments(row),
  frequency: parseFrequency(row),
  description: row?.description ?? getPlanMeta(row).description ?? '',
  company_id: row?.company_id ? String(row.company_id) : '',
});
const toApiPayload = (form, current) => {
  const installments = Number(form.installments || 0);
  const description = form.description.trim() || null;
  const status = getStatus(current);

  return {
    name: form.name.trim(),
    total_amount: Number(form.total_amount),
    installments,
    frequency: form.frequency,
    description,
    price: Number(form.total_amount),
    duration: installments ? `${installments} ${form.frequency}` : form.frequency,
    features: { installments, frequency: form.frequency, description, total_amount: Number(form.total_amount) },
    status,
    is_active: status !== 'inactive',
    ...(form.company_id ? { company_id: Number(form.company_id) } : {}),
  };
};

export default function PaymentPlansPage() {
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
      const response = await listPaymentPlans();
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
    setForm(toForm(row));
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
      const payload = toApiPayload(form, editing);
      if (editing?.id) await updatePaymentPlan(editing.id, payload);
      else await createPaymentPlan({ ...payload, status: 'active', is_active: true });
      await load();
      closeModal();
    } catch {
      alert('Failed to save payment plan.');
    } finally {
      setSaving(false);
    }
  };


  const columns = [
    { header: 'Name', accessor: 'name' },
    { header: 'Total Amount', render: (row) => formatCurrency(Number(row.total_amount ?? row.price ?? getPlanMeta(row).total_amount ?? 0)) },
    { header: 'Installments', render: (row) => parseInstallments(row) || '—' },
    { header: 'Frequency', render: (row) => parseFrequency(row) },
    { header: 'Status', render: (row) => <Badge value={getStatus(row)} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Payment Plans</h1>
          <p className="text-sm text-slate-500">Create and manage installment-based payment plans.</p>
        </div>
        <Button onClick={openCreate}>+ New Payment Plan</Button>
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

      <Modal open={editing !== null} onClose={closeModal} title={`${editing?.id ? 'Edit' : 'New'} Payment Plan`}>
        <form onSubmit={handleSave} className="space-y-3">
          {!editing?.id && isSuperiorAdmin && (
            <CompanySelect value={form.company_id} onChange={handleChange('company_id')} />
          )}
          <Input label="Name" value={form.name} onChange={handleChange('name')} required />
          <MoneyInput label="Total Amount" value={form.total_amount} onChange={(total_amount) => setForm((current) => ({ ...current, total_amount }))} required />
          <Input label="Installments" type="number" min="1" value={form.installments} onChange={handleChange('installments')} required />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Frequency</span>
            <Select value={form.frequency} onChange={handleChange('frequency')}>
              <option value="monthly">{enumLabel('monthly')}</option>
              <option value="quarterly">{enumLabel('quarterly')}</option>
              <option value="annually">{enumLabel('annually')}</option>
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
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

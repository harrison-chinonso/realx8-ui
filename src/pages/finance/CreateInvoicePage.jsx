import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createInvoice } from '../../api/financeApi';
import { listClients } from '../../api/userApi';
import Input from '../../components/ui/Input';
import MoneyInput from '../../components/ui/MoneyInput';
import Button from '../../components/ui/Button';
import EntitySearchSelect from '../../components/common/EntitySearchSelect';

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ invoice_id: `INV-${Date.now()}`, client_id: '', amount: '', due_date: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.client_id) { setError('Please select a client.'); return; }
    setSaving(true);
    setError('');
    try {
      await createInvoice({ ...form, client_id: Number(form.client_id), amount: Number(form.amount) });
      navigate('/finance/invoices');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 max-w-2xl">
      <h1 className="text-2xl font-bold">Create Invoice</h1>
      {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Invoice ID" value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })} required />
        <div>
          <EntitySearchSelect
            label="Client"
            placeholder="Search client by name…"
            value={form.client_id}
            onChange={(id) => setForm((f) => ({ ...f, client_id: id }))}
            fetchItems={() => listClients({ limit: 1000 })}
            getLabel={(c) => c.name || c.email || `Client #${c.id}`}
            required
          />
        </div>
        <MoneyInput label="Amount" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} required />
        <Input label="Due Date" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Invoice'}</Button>
        <Button type="button" variant="secondary" onClick={() => navigate('/finance/invoices')}>Cancel</Button>
      </div>
    </form>
  );
}

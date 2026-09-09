import { useEffect, useState } from 'react';
import { listTaxes, createTax } from '../../api/financeApi';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';

export default function TaxesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', rate: '' });

  const load = async () => {
    setLoading(true);
    try { const res = await listTaxes(); setItems(res.data || []); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    await createTax(form);
    setShowCreate(false);
    setForm({ name: '', rate: '' });
    load();
  };

  const columns = [
    { header: 'Name', accessor: 'name' },
    { header: 'Rate', render: r => `${r.rate}%` },
    { header: 'Created', render: r => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Taxes</h1>
        <Button onClick={() => setShowCreate(true)}>+ New Tax</Button>
      </div>
      <Table columns={columns} data={items} loading={loading} />
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Tax">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input label="Tax Name" placeholder="e.g. VAT" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <Input label="Rate (%)" type="number" step="0.01" value={form.rate} onChange={e => setForm({...form, rate: e.target.value})} required />
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">Create</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

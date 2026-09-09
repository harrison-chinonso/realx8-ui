import { useEffect, useState } from 'react';
import { listBankAccounts, createBankAccount, updateBankAccount } from '../../api/financeApi';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import MoneyInput from '../../components/ui/MoneyInput';
import { useCurrency, useAppearance } from '../../context/useAppearance';

export default function BankAccountsPage() {
  const fmt = useCurrency();
  // The currency column now persists, so seed it from the company's configured
  // currency rather than a hardcoded USD that would contradict it.
  const { currency: companyCurrency } = useAppearance();
  // currency stays null until the admin types one. The input displays the
  // company currency meanwhile, so it still tracks appearance settings that
  // load after this component mounts.
  const blankForm = () => ({
    name: '', bank_name: '', account_number: '', routing_number: '', iban: '',
    swift_code: '', opening_balance: '', currency: null, is_active: true,
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [toggling, setToggling] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try { const res = await listBankAccounts(); setItems(res.data || []); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createBankAccount({
        ...form,
        currency: form.currency ?? companyCurrency ?? null,
        // A blank money field must go as null, not '' — an empty string into a
        // DECIMAL column is rejected by MySQL, which failed every save where an
        // opening balance was left out (i.e. almost all of them).
        opening_balance: String(form.opening_balance).trim() === '' ? null : Number(form.opening_balance),
      });
      setShowCreate(false);
      setForm(blankForm());
      load();
    } catch (err) {
      // Without this the promise rejected silently and the button looked dead.
      setError(err?.response?.data?.message || err?.userMessage || 'Could not add that account.');
    } finally {
      setSaving(false);
    }
  };

  /** Only active accounts are offered to buyers paying by bank deposit. */
  const toggleActive = async (row) => {
    setToggling(row.id);
    setError('');
    try {
      await updateBankAccount(row.id, { is_active: !row.is_active });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not update that account.');
    } finally {
      setToggling(null);
    }
  };

  const columns = [
    { header: 'Account Name', accessor: 'name' },
    { header: 'Bank', accessor: 'bank_name' },
    { header: 'Account #', accessor: 'account_number' },
    { header: 'Currency', accessor: 'currency' },
    { header: 'Opening Balance', render: r => fmt(r.opening_balance || 0) },
    {
      header: 'Shown to buyers',
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      header: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={toggling === r.id} onClick={() => toggleActive(r)}>
            {toggling === r.id ? 'Saving…' : r.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Bank Accounts</h1>
        <Button onClick={() => setShowCreate(true)}>+ Add Account</Button>
      </div>
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      <p className="text-xs text-slate-400">
        Only accounts marked active are offered to buyers making a bank deposit.
      </p>
      <Table columns={columns} data={items} loading={loading} />
      <Modal open={showCreate} onClose={() => { if (!saving) { setShowCreate(false); setError(''); } }} title="Add Bank Account">
        <form onSubmit={handleCreate} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Input label="Account Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <Input label="Bank Name" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} required />
          <Input label="Account Number" value={form.account_number} onChange={e => setForm({...form, account_number: e.target.value})} required />
          <Input label="Routing Number" value={form.routing_number} onChange={e => setForm({...form, routing_number: e.target.value})} />
          <Input label="IBAN" value={form.iban} onChange={e => setForm({...form, iban: e.target.value})} />
          <Input label="SWIFT Code" value={form.swift_code} onChange={e => setForm({...form, swift_code: e.target.value})} />
          <MoneyInput label="Opening Balance" value={form.opening_balance} onChange={(opening_balance) => setForm({...form, opening_balance})} />
          <Input
            label="Currency"
            value={form.currency ?? companyCurrency ?? ''}
            onChange={e => setForm({ ...form, currency: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} />
            Show this account to buyers paying by bank deposit
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Adding…' : 'Add Account'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

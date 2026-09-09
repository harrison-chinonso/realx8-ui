import { useEffect, useState } from 'react';
import { getReferralSetting, upsertReferralSetting, listReferralTransactions } from '../../api/userApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import StatsCard from '../../components/common/StatsCard';
import { useCurrency } from '../../context/useAppearance';

export default function ReferralPage() {
  const fmt = useCurrency();
  const [setting, setSetting] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ referral_commission: '', commission_type: 'percentage', is_enabled: true, min_payout: '' });

  useEffect(() => {
    Promise.all([getReferralSetting(), listReferralTransactions()]).then(([s, t]) => {
      const d = s.data;
      setSetting(d);
      if (d) setForm({ referral_commission: d.referral_commission || '', commission_type: d.commission_type || 'percentage', is_enabled: d.is_enabled !== false, min_payout: d.min_payout || '' });
      setTransactions(t.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await upsertReferralSetting(form); alert('Settings saved'); }
    finally { setSaving(false); }
  };

  const totalPaid = transactions.filter(t => t.status === 'paid').reduce((s, t) => s + Number(t.commission || 0), 0);
  const totalPending = transactions.filter(t => t.status === 'pending').reduce((s, t) => s + Number(t.commission || 0), 0);

  const columns = [
    { header: 'User ID', accessor: 'user_id' },
    { header: 'Referrer ID', accessor: 'referrer_id' },
    { header: 'Amount', render: r => fmt(r.amount) },
    { header: 'Commission', render: r => fmt(r.commission || 0) },
    { header: 'Status', render: r => <Badge color={r.status === 'paid' ? 'green' : r.status === 'pending' ? 'yellow' : 'red'}>{r.status}</Badge> },
    { header: 'Date', render: r => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Referral Program</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Total Referrals" value={transactions.length} subtitle="All time transactions" />
        <StatsCard title="Paid Commissions" value={fmt(totalPaid)} subtitle="Commission paid out" />
        <StatsCard title="Pending Commissions" value={fmt(totalPending)} subtitle="Awaiting payout" />
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold mb-4">Referral Settings</h2>
        <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Commission Rate" type="number" step="0.01" value={form.referral_commission} onChange={e => setForm({...form, referral_commission: e.target.value})} />
          <Select label="Commission Type" value={form.commission_type} onChange={e => setForm({...form, commission_type: e.target.value})}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount</option>
          </Select>
          <Input label="Minimum Payout" type="number" step="0.01" value={form.min_payout} onChange={e => setForm({...form, min_payout: e.target.value})} />
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_enabled} onChange={e => setForm({...form, is_enabled: e.target.checked})} />
              Program Enabled
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
          </div>
        </form>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold mb-4">Referral Transactions</h2>
        <Table columns={columns} data={transactions} loading={loading} />
      </div>
    </div>
  );
}

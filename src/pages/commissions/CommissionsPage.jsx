import { useEffect, useState } from 'react';
import {
  approveCommission,
  createCommission,
  createCommissionRule,
  deleteCommission,
  deleteCommissionRule,
  listCommissionRules,
  listCommissions,
  payCommission,
} from '../../api/financeApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import { useCurrency } from '../../context/useAppearance';
import Select from '../../components/ui/Select';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const EMPTY_COMMISSION_FORM = { employee_id: '', title: '', type: 'fixed', amount: '' };
const EMPTY_RULE_FORM = {
  product_type: 'any',
  realtor_category: 'any',
  type: 'fixed',
  value: '',
  description: '',
};

const getItems = (response) => response?.data ?? response ?? [];
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');
const getErrorMessage = (error, fallback) => error?.userMessage || fallback;

export default function CommissionsPage() {
  const fmt = useCurrency();
  const [tab, setTab] = useState('commissions');
  const [items, setItems] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRules, setLoadingRules] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailRow, setDetailRow] = useState(null);
  const [commissionForm, setCommissionForm] = useState(EMPTY_COMMISSION_FORM);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM);
  const [message, setMessage] = useState(null);

  const setFeedback = (type, text) => {
    setMessage({ type, text });
    window.clearTimeout(window.__realtoCommissionMessageTimer);
    window.__realtoCommissionMessageTimer = window.setTimeout(() => setMessage(null), 3000);
  };

  const loadCommissions = async () => {
    setLoading(true);
    try {
      const response = await listCommissions();
      setItems(getItems(response));
    } catch (error) {
      console.error(error);
      setItems([]);
      setFeedback('error', getErrorMessage(error, 'Failed to load commissions.'));
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const response = await listCommissionRules();
      setRules(getItems(response));
    } catch (error) {
      console.error(error);
      setRules([]);
      setFeedback('error', getErrorMessage(error, 'Failed to load commission rules.'));
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    loadCommissions();
    loadRules();
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createCommission({
        employee_id: Number(commissionForm.employee_id),
        title: commissionForm.title.trim(),
        type: commissionForm.type,
        amount: Number(commissionForm.amount),
      });
      setShowCreate(false);
      setCommissionForm(EMPTY_COMMISSION_FORM);
      await loadCommissions();
      setFeedback('success', 'Commission created successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to create commission.'));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await approveCommission(id);
      await loadCommissions();
      setFeedback('success', 'Commission approved successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to approve commission.'));
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      // Paid in full — the endpoint takes no amount, because a commission is a
      // single obligation and a part payout would leave an untracked remainder.
      const result = await payCommission(id);
      await loadCommissions();
      const amount = result?.transaction?.amount;
      setFeedback('success', amount
        ? `Commission paid in full — ${fmt(amount)} recorded as a debit.`
        : 'Commission paid in full.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to mark commission as paid.'));
    }
  };

  const handleDeleteCommission = async (id) => {
    if (!window.confirm('Delete commission?')) return;
    try {
      await deleteCommission(id);
      await loadCommissions();
      setFeedback('success', 'Commission deleted successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to delete commission.'));
    }
  };

  const handleCreateRule = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createCommissionRule({
        product_type: ruleForm.product_type,
        realtor_category: ruleForm.realtor_category,
        type: ruleForm.type,
        value: Number(ruleForm.value),
        description: ruleForm.description.trim() || null,
      });
      setRuleForm(EMPTY_RULE_FORM);
      await loadRules();
      setFeedback('success', 'Commission rule added successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to create commission rule.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Delete commission rule?')) return;
    try {
      await deleteCommissionRule(id);
      await loadRules();
      setFeedback('success', 'Commission rule deleted successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to delete commission rule.'));
    }
  };

  const columns = [
    { key: 'title', label: 'Title', render: (row) => row.title || '—' },
    { key: 'type', label: 'Type', render: (row) => row.type || '—' },
    { key: 'amount', label: 'Amount', render: (row) => fmt(row.amount || 0) },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status || 'pending'} /> },
    { key: 'createdAt', label: 'Date', render: (row) => formatDate(row.createdAt || row.created_at) },
  ];

  const detailFields = [
    { label: 'Employee ID', render: (row) => row.employee_id ?? '—' },
    { label: 'Title', key: 'title' },
    { label: 'Type', key: 'type' },
    { label: 'Amount', render: (row) => fmt(row.amount || 0) },
    { label: 'Status', render: (row) => <Badge value={row.status || 'pending'} /> },
    { label: 'Date', render: (row) => formatDate(row.createdAt || row.created_at) },
    { label: 'Commission Rate', render: (row) => row.commission_rate ?? '—' },
    { label: 'Description', key: 'description' },
    { label: 'Notes', key: 'notes' },
  ];

  const ruleColumns = [
    { key: 'product_type', label: 'Product Type', render: (row) => row.product_type || 'any' },
    { key: 'realtor_category', label: 'Realtor Category', render: (row) => row.realtor_category || 'any' },
    { key: 'type', label: 'Type', render: (row) => row.type || '—' },
    {
      key: 'value',
      label: 'Value',
      render: (row) => (String(row.type).toLowerCase() === 'percentage' ? `${row.value ?? 0}%` : fmt(row.value || 0)),
    },
    { key: 'description', label: 'Description', render: (row) => row.description || '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Commissions</h1>
          <p className="text-sm text-slate-500">Manage commission payouts and rule automation.</p>
        </div>
        {tab === 'commissions' && <Button onClick={() => setShowCreate(true)}>+ New Commission</Button>}
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {[
          { key: 'commissions', label: 'Commissions' },
          { key: 'rules', label: 'Rules' },
        ].map((item) => (
          <Button key={item.key} variant={tab === item.key ? 'primary' : 'ghost'} size="sm" onClick={() => setTab(item.key)}>
            {item.label}
          </Button>
        ))}
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {tab === 'commissions' && (
        loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : (
          <Table
            columns={columns}
            rows={items}
            renderActions={(row) => (
              <div className="flex flex-wrap justify-end gap-2">
                {/*
                  * The payout sequence, one actor per step. `pending` is the old
                  * name for `created` and is still matched so a row migrated
                  * from it behaves the same. `payment_requested` is the earner
                  * asking — the state that most wants an admin's attention, so
                  * it is called out rather than sharing a label with created.
                  */}
                {['created', 'pending'].includes(row.status) && (
                  <Button onClick={() => handleApprove(row.id)} variant="secondary" size="sm">Approve</Button>
                )}
                {row.status === 'payment_requested' && (
                  <Button onClick={() => handleApprove(row.id)} variant="warning" size="sm">
                    Approve request
                  </Button>
                )}
                {row.status === 'approved' && (
                  <Button onClick={() => handleMarkPaid(row.id)} variant="success" size="sm">
                    Pay in full
                  </Button>
                )}
                <ActionsMenu
                  items={[
                    { label: '👁 View Details', onClick: () => setDetailRow(row) },
                    { label: '🗑 Delete', variant: 'danger', onClick: () => handleDeleteCommission(row.id) },
                  ]}
                />
              </div>
            )}
          />
        )
      )}

      <DetailsModal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailRow?.title || 'Commission Details'}
        record={detailRow}
        fields={detailFields}
      />

      {tab === 'rules' && (
        <div className="space-y-4">
          {loadingRules ? (
            <p className="text-slate-500">Loading rules...</p>
          ) : (
            <Table
              columns={ruleColumns}
              rows={rules}
              renderActions={(row) => (
                <Button onClick={() => handleDeleteRule(row.id)} variant="danger" size="sm">Delete</Button>
              )}
            />
          )}

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Add Rule</h2>
              <p className="text-sm text-slate-500">Create automatic commission rules by product and realtor category.</p>
            </div>
            <form onSubmit={handleCreateRule} className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Product Type</span>
                <Select className={INPUT_CLASS} value={ruleForm.product_type} onChange={(event) => setRuleForm((current) => ({ ...current, product_type: event.target.value }))}>
                  <option value="land">Land</option>
                  <option value="house">House</option>
                  <option value="investment">Investment</option>
                  <option value="any">Any</option>
                </Select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Realtor Category</span>
                <Select className={INPUT_CLASS} value={ruleForm.realtor_category} onChange={(event) => setRuleForm((current) => ({ ...current, realtor_category: event.target.value }))}>
                  <option value="premium">Premium</option>
                  <option value="professional">Professional</option>
                  <option value="basic">Basic</option>
                  <option value="any">Any</option>
                </Select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Type</span>
                <Select className={INPUT_CLASS} value={ruleForm.type} onChange={(event) => setRuleForm((current) => ({ ...current, type: event.target.value }))}>
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                </Select>
              </label>

              <Input
                label="Value"
                type="number"
                min="0"
                step="0.01"
                value={ruleForm.value}
                onChange={(event) => setRuleForm((current) => ({ ...current, value: event.target.value }))}
                required
              />

              <div className="md:col-span-2">
                <Input
                  label="Description"
                  value={ruleForm.description}
                  onChange={(event) => setRuleForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Optional rule description"
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Rule'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal open={showCreate} onClose={() => !saving && setShowCreate(false)} title="Create Commission">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="Employee ID"
            type="number"
            value={commissionForm.employee_id}
            onChange={(event) => setCommissionForm((current) => ({ ...current, employee_id: event.target.value }))}
            required
          />
          <Input
            label="Title"
            value={commissionForm.title}
            onChange={(event) => setCommissionForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Type</span>
            <Select className={INPUT_CLASS} value={commissionForm.type} onChange={(event) => setCommissionForm((current) => ({ ...current, type: event.target.value }))}>
              <option value="fixed">Fixed</option>
              <option value="percentage">Percentage</option>
            </Select>
          </label>
          <Input
            label="Amount"
            type="number"
            step="0.01"
            value={commissionForm.amount}
            onChange={(event) => setCommissionForm((current) => ({ ...current, amount: event.target.value }))}
            required
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

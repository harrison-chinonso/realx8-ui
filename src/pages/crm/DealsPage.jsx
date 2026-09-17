import { useEffect, useState } from 'react';
import { listDeals, createDeal, updateDeal, deleteDeal, listPipelines, listStages, getDealTasks } from '../../api/crmApi';
import { usePermission } from '../../hooks/usePermission';
import Badge from '../../components/common/Badge';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useCurrency } from '../../context/useAppearance';
import MoneyInput from '../../components/ui/MoneyInput';
import FieldMark from '../../components/ui/FieldMark';

const STATUSES = ['open', 'won', 'lost'];
const getItems = (response) => response?.data ?? response ?? [];
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

export default function DealsPage() {
  const fmt = useCurrency();
  const [deals, setDeals] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editDeal, setEditDeal] = useState(null);
  const [tasksDeal, setTasksDeal] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', pipeline_id: '', stage_id: '', status: 'open', expected_close_date: '' });

  const load = () =>
    Promise.all([
      listDeals().then((r) => setDeals(r.data || [])),
      // Dropdowns need every option, not the first page of ten — a stage
      // missing from the list is a stage a deal can never be moved to.
      listPipelines({ limit: 'all' }).then((r) => setPipelines(r.data || [])),
      listStages({ limit: 'all' }).then((r) => setStages(r.data || [])),
    ]);

  useEffect(() => { load(); }, []);
  /*
   * Viewing a deal and changing one are separate permissions, and a realtor
   * holds only the first. Drawing the controls anyway would give them three
   * buttons that each return 403.
   */
  const canManageDeals = usePermission('crm.deals.manage');

  const openCreate = () => {
    setForm({ name: '', amount: '', pipeline_id: '', stage_id: '', status: 'open', expected_close_date: '' });
    setEditDeal(null);
    setShowCreate(true);
  };

  const openEdit = (deal) => {
    setForm({
      name: deal.name || '',
      amount: deal.amount || '',
      pipeline_id: deal.pipeline_id || '',
      stage_id: deal.stage_id || '',
      status: deal.status || 'open',
      expected_close_date: deal.expected_close_date ? deal.expected_close_date.slice(0, 10) : '',
    });
    setEditDeal(deal);
    setShowCreate(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editDeal) {
      await updateDeal(editDeal.id, form);
    } else {
      await createDeal(form);
    }
    setShowCreate(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this deal?')) return;
    await deleteDeal(id);
    load();
  };

  const handleOpenTasks = async (deal) => {
    setTasksDeal(deal);
    setTasks([]);
    setTasksLoading(true);
    try {
      const response = await getDealTasks(deal.id);
      setTasks(getItems(response));
    } finally {
      setTasksLoading(false);
    }
  };

  const stagesForPipeline = form.pipeline_id
    ? stages.filter((s) => String(s.pipeline_id) === String(form.pipeline_id))
    : stages;

  const taskColumns = [
    { header: 'Title', accessor: 'title' },
    { header: 'Status', render: (row) => <Badge value={row.status} /> },
    { header: 'Due Date', render: (row) => formatDate(row.due_date) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Deals pipeline</h1>
        {canManageDeals && <Button onClick={openCreate}>+ New Deal</Button>}
      </div>

      <div className="space-y-3">
        {deals.map((deal) => (
          <div key={deal.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div>
              <div className="font-semibold">{deal.name}</div>
              <div className="text-sm text-slate-500">
                Close: {deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : 'TBD'}
                {deal.stage && <> · {deal.stage.name}</>}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-semibold">{fmt(deal.amount || 0)}</div>
                <Badge value={deal.status} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleOpenTasks(deal)} variant="secondary" size="sm">Tasks</Button>
                {canManageDeals && (
                  <>
                    <Button onClick={() => openEdit(deal)} variant="primary" size="sm">Edit</Button>
                    <Button onClick={() => handleDelete(deal.id)} variant="danger" size="sm">Delete</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {!deals.length && (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-slate-500">No deals yet. Create your first deal.</p>
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={editDeal ? 'Edit Deal' : 'New Deal'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Deal name<FieldMark required /></label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Amount ($)<FieldMark /></label>
            <MoneyInput value={form.amount} onChange={(amount) => setForm({ ...form, amount })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Pipeline<FieldMark /></label>
            <Select value={form.pipeline_id} onChange={(e) => setForm({ ...form, pipeline_id: e.target.value, stage_id: '' })}>
              <option value="">— Select pipeline —</option>
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Stage<FieldMark /></label>
            <Select value={form.stage_id} onChange={(e) => setForm({ ...form, stage_id: e.target.value })}>
              <option value="">— Select stage —</option>
              {stagesForPipeline.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Status<FieldMark /></label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Expected close date<FieldMark /></label>
            <Input type="date" value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit">{editDeal ? 'Save changes' : 'Create deal'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(tasksDeal)}
        onClose={() => setTasksDeal(null)}
        title={tasksDeal ? `${tasksDeal.name} Tasks` : 'Deal Tasks'}
        size="lg"
      >
        {tasksLoading ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading tasks...</p>
        ) : (
          <Table columns={taskColumns} data={tasks} />
        )}
      </Modal>
    </div>
  );
}

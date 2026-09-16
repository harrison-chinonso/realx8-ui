import { useEffect, useMemo, useState } from 'react';
import useAuthStore from '../../store/authStore';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import { useCurrency } from '../../context/useAppearance';
import { listRecruits, createRecruit, updateRecruit, deleteRecruit } from '../../api/trainingApi';
import MoneyInput from '../../components/ui/MoneyInput';
import Select from '../../components/ui/Select';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const MODAL_OVERLAY_CLASS = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4';
// Capped and scrollable, like Modal.jsx. A modal taller than the viewport
// centres itself off both edges, and its submit button ends up out of
// reach with nothing to scroll — the form can be filled in and not saved.
const MODAL_CARD_CLASS = 'w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto';
const MANAGER_ROLES = ['super_admin', 'admin', 'branch_manager'];
const emptyForm = (userName = '') => ({
  name: '',
  email: '',
  phone: '',
  status: 'applied',
  join_date: '',
  referred_by_name: userName,
  commission_earned: '',
  notes: '',
});
const getItems = (response) => (Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []);
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

export default function RecruitmentPage() {
  const user = useAuthStore((state) => state.user);
  const formatCurrency = useCurrency();
  const isManager = MANAGER_ROLES.includes(user?.type);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRecruit, setEditingRecruit] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [form, setForm] = useState(emptyForm(user?.name || ''));

  const loadData = async (query = search) => {
    setLoading(true);
    setError('');
    try {
      const response = await listRecruits(query ? { search: query } : undefined);
      setRows(getItems(response));
    } catch (loadError) {
      console.error(loadError);
      setError(err.userMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData('');
  }, []);

  const openCreate = () => {
    setEditingRecruit(null);
    setForm(emptyForm(user?.name || ''));
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingRecruit(row);
    setForm({
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      status: row.status || 'applied',
      join_date: row.join_date || '',
      referred_by_name: row.referred_by_name || user?.name || '',
      commission_earned: row.commission_earned || '',
      notes: row.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setShowModal(false);
    setEditingRecruit(null);
    setForm(emptyForm(user?.name || ''));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.join_date) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        referred_by_name: isManager ? form.referred_by_name : user?.name,
        commission_earned: form.commission_earned || 0,
      };
      if (editingRecruit) await updateRecruit(editingRecruit.id, payload);
      else await createRecruit(payload);
      closeModal(true);
      await loadData();
    } catch (saveError) {
      console.error(saveError);
      setError(`Failed to ${editingRecruit ? 'update' : 'create'} recruit. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete recruit "${row.name}"?`)) return;
    try {
      await deleteRecruit(row.id);
      await loadData();
    } catch (deleteError) {
      console.error(deleteError);
      setError(err.userMessage);
    }
  };

  const columns = useMemo(() => [
    { key: 'name', label: 'Recruit Name', render: (row) => row.name || '—' },
    { key: 'email', label: 'Email', render: (row) => row.email || '—' },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status || 'applied'} /> },
    { key: 'join_date', label: 'Join Date', render: (row) => formatDate(row.join_date) },
    { key: 'commission_earned', label: 'Commission Earned (₦)', render: (row) => formatCurrency(row.commission_earned || 0) },
  ], [formatCurrency]);

  const detailFields = useMemo(() => [
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Status', render: (row) => <Badge value={row.status || 'applied'} /> },
    { label: 'Join Date', render: (row) => formatDate(row.join_date) },
    { label: 'Referred By', key: 'referred_by_name' },
    { label: 'Commission Earned', render: (row) => formatCurrency(row.commission_earned || 0) },
    { label: 'Notes', key: 'notes' },
  ], [formatCurrency]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{isManager ? 'Recruitment Tracking' : 'My Recruits'}</h1>
          <p className="text-sm text-slate-500">Track referred recruits, their onboarding status, and referral earnings.</p>
        </div>
        <Button onClick={openCreate}>Add Recruit</Button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recruits by name, email, phone, or referrer" className={`${INPUT_CLASS} max-w-xl`} />
          <Button onClick={() => loadData(search)} disabled={loading}>{loading ? 'Loading…' : 'Search'}</Button>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading recruits...</p>
        ) : (
          <Table
          /*
            This page has its own search box, which filters on the SERVER and
            therefore searches every row rather than the page in view. The
            table's built-in search would sit beside it searching only the
            loaded rows — two boxes, different answers.
          */
          searchable={false}
            columns={columns}
            data={rows}
            renderActions={(row) => (
              <div className="flex justify-end gap-3">
                <Button type="button" onClick={() => openEdit(row)} variant="primary" size="sm">Edit</Button>
                <ActionsMenu
                  items={[
                    { label: '👁 View Details', onClick: () => setDetailRow(row) },
                    { label: '🗑 Delete', variant: 'danger', onClick: () => handleDelete(row) },
                  ]}
                />
              </div>
            )}
          />
        )}
      </div>

      <DetailsModal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailRow?.name || 'Recruit Details'}
        record={detailRow}
        fields={detailFields}
      />

      {showModal && (
        <div className={MODAL_OVERLAY_CLASS}>
          <div className={MODAL_CARD_CLASS}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{editingRecruit ? 'Edit Recruit' : 'Add Recruit'}</h2>
                <p className="text-sm text-slate-500">Capture recruit contact information and referral details.</p>
              </div>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Name</span>
                  <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={INPUT_CLASS} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Email</span>
                  <input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={INPUT_CLASS} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Phone</span>
                  <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className={INPUT_CLASS} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={INPUT_CLASS}>
                    <option value="applied">Applied</option>
                    <option value="training">Training</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Join Date</span>
                  <input required type="date" value={form.join_date} onChange={(event) => setForm((current) => ({ ...current, join_date: event.target.value }))} className={INPUT_CLASS} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Referred By</span>
                  <input value={isManager ? form.referred_by_name : user?.name || ''} onChange={(event) => setForm((current) => ({ ...current, referred_by_name: event.target.value }))} className={INPUT_CLASS} disabled={!isManager} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Commission Earned</span>
                  <MoneyInput value={form.commission_earned} onChange={(commission_earned) => setForm((current) => ({ ...current, commission_earned }))} className={INPUT_CLASS} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Notes</span>
                  <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={`${INPUT_CLASS} min-h-24`} />
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingRecruit ? 'Save Changes' : 'Add Recruit'}</Button>
                <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

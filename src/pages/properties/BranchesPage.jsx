import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listBranches, createBranch, updateBranch, deleteBranch, listBranchProperties,
} from '../../api/propertyApi';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import useAuthStore from '../../store/authStore';

/**
 * A company's offices, and what each one runs.
 *
 * A branch is deliberately two fields. The temptation with an "office" record
 * is to grow it — a phone number, a manager, opening hours — and every one of
 * those is a field somebody has to fill in before they can do the thing they
 * actually came to do, which is file a property under the office that sells it.
 */

const EMPTY_FORM = { name: '', address: '' };

const getItems = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

export default function BranchesPage() {
  const canManage = useAuthStore((s) => s.hasPermission('properties.branches.manage'));

  const [branches, setBranches] = useState([]);
  /** id → how many properties it runs, so the count is on the row itself. */
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = getItems(await listBranches({ limit: 'all' }));
      setBranches(rows);

      /*
       * The counts come one request per branch, which is fine at this scale —
       * a company has a handful of offices — and means no new endpoint. If a
       * count fails the branch still lists; an office you cannot count is not
       * an office you cannot see.
       */
      const settled = await Promise.all(rows.map((branch) => listBranchProperties(branch.id)
        .then((response) => [branch.id, getItems(response).length])
        .catch(() => [branch.id, null])));
      setCounts(Object.fromEntries(settled));
    } catch {
      setBranches([]);
      setMessage({ type: 'error', text: 'Could not load branches.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };

  const openEdit = (branch) => {
    setEditing(branch);
    setForm({ name: branch.name || '', address: branch.address || '' });
    setShowModal(true);
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = { name: form.name.trim(), address: form.address.trim() || null };
      if (editing) await updateBranch(editing.id, payload);
      else await createBranch(payload);
      closeModal(true);
      await load();
      setMessage({ type: 'success', text: `Branch ${editing ? 'updated' : 'created'}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error?.userMessage || `Could not ${editing ? 'update' : 'create'} the branch.` });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const branch = confirming;
    setConfirming(null);
    setMessage(null);
    try {
      await deleteBranch(branch.id);
      await load();
      setMessage({
        type: 'success',
        text: counts[branch.id]
          ? `${branch.name} closed. Its ${counts[branch.id]} ${counts[branch.id] === 1 ? 'property is' : 'properties are'} now unassigned.`
          : `${branch.name} closed.`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error?.userMessage || 'Could not close the branch.' });
    }
  };

  const columns = useMemo(() => [
    { key: 'name', label: 'Branch', render: (row) => <span className="font-medium text-slate-800">{row.name}</span> },
    { key: 'address', label: 'Office address', render: (row) => row.address || <span className="text-slate-400">Not set</span> },
    {
      key: 'properties',
      label: 'Properties',
      render: (row) => {
        const count = counts[row.id];
        // null means the count could not be fetched — which is not zero, and
        // printing 0 would say this office runs nothing.
        if (count === null || count === undefined) return <span className="text-slate-400">—</span>;
        return <span className="tabular-nums">{count}</span>;
      },
    },
  ], [counts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div>
          <h1 className="text-xl font-semibold">Branches</h1>
          <p className="text-sm text-slate-500">
            Your offices. A property can be assigned to one branch, on the property itself.
          </p>
        </div>
        {canManage && <Button onClick={openCreate}>+ Add branch</Button>}
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${message.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading branches…</div>
      ) : branches.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-700">No branches yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Add one for each office you run properties out of. Properties stay unassigned until you put them in one.
          </p>
          {canManage && <Button className="mt-4" onClick={openCreate}>+ Add branch</Button>}
        </div>
      ) : (
        <Table
          columns={columns}
          rows={branches}
          renderActions={canManage ? (branch) => (
            <div className="flex justify-end gap-2">
              <Button onClick={() => openEdit(branch)} variant="primary" size="sm">Edit</Button>
              <Button onClick={() => setConfirming(branch)} variant="danger" size="sm">Close</Button>
            </div>
          ) : undefined}
        />
      )}

      <Modal open={showModal} onClose={closeModal} title={editing ? `Edit ${editing.name}` : 'Add branch'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Branch name"
            placeholder="Lekki Office"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <Input
            label="Office address"
            placeholder="12 Admiralty Way, Lekki Phase 1, Lagos"
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create branch'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => closeModal()}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/*
        Closing an office is not the same as deleting its properties, and the
        confirmation says so with the actual number. A plain "are you sure?"
        leaves somebody guessing what happens to the estates they have filed
        under it — which is the only question worth asking at that moment.
      */}
      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title={`Close ${confirming?.name || ''}?`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {counts[confirming?.id]
              ? `Its ${counts[confirming?.id]} ${counts[confirming?.id] === 1 ? 'property' : 'properties'} will become unassigned. Nothing is deleted, and you can put them in another branch afterwards.`
              : 'This branch runs no properties, so nothing else changes.'}
          </p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={handleDelete}>Close branch</Button>
            <Button variant="secondary" onClick={() => setConfirming(null)}>Keep it</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

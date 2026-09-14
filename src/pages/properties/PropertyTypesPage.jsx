import { useEffect, useMemo, useState } from 'react';
import {
  listPropertyTypes,
  createPropertyType,
  updatePropertyType,
  deletePropertyType,
} from '../../api/propertyApi';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const EMPTY_FORM = { name: '', description: '' };

const getItems = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

export default function PropertyTypesPage() {
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadPropertyTypes = async () => {
    setLoading(true);
    try {
      const response = await listPropertyTypes({ limit: 1000 });
      setPropertyTypes(getItems(response));
    } catch {
      setPropertyTypes([]);
      setMessage({ type: 'error', text: 'Failed to load property types.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPropertyTypes();
  }, []);

  const openCreate = () => {
    setEditingType(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (propertyType) => {
    setEditingType(propertyType);
    setForm({
      name: propertyType.name || '',
      description: propertyType.description || '',
    });
    setShowModal(true);
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setShowModal(false);
    setEditingType(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
      };
      if (editingType) {
        await updatePropertyType(editingType.id, payload);
      } else {
        await createPropertyType(payload);
      }
      closeModal(true);
      await loadPropertyTypes();
      setMessage({ type: 'success', text: `Property type ${editingType ? 'updated' : 'created'} successfully.` });
    } catch {
      setMessage({ type: 'error', text: `Failed to ${editingType ? 'update' : 'create'} property type.` });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (propertyType) => {
    if (!window.confirm(`Delete property type "${propertyType.name}"?`)) return;

    setMessage(null);
    try {
      await deletePropertyType(propertyType.id);
      await loadPropertyTypes();
      setMessage({ type: 'success', text: 'Property type deleted successfully.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete property type.' });
    }
  };

  const columns = useMemo(() => [
    { key: 'name', label: 'Name', render: (row) => row.name || '—' },
    { key: 'description', label: 'Description', render: (row) => row.description || '—' },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => {
        const value = row.createdAt || row.created_at;
        return value ? new Date(value).toLocaleDateString() : '—';
      },
    },
  ], []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div>
          <h1 className="text-xl font-semibold">Property Types</h1>
          <p className="text-sm text-slate-500">Create and manage property type definitions.</p>
        </div>
        <Button onClick={openCreate}>+ Add Property Type</Button>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading property types...</div>
      ) : (
        <Table
          columns={columns}
          rows={propertyTypes}
          renderActions={(propertyType) => (
            <div className="flex justify-end gap-2">
              <Button onClick={() => openEdit(propertyType)} variant="primary" size="sm">Edit</Button>
              <Button onClick={() => handleDelete(propertyType)} variant="danger" size="sm">Delete</Button>
            </div>
          )}
        />
      )}

      <Modal open={showModal} onClose={closeModal} title={editingType ? 'Edit Property Type' : 'Add Property Type'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingType ? 'Save Changes' : 'Create Property Type'}</Button>
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Download, Upload } from 'lucide-react';
import { listProperties, updateProperty, deleteProperty, listPropertyTypes, exportPropertiesToExcel } from '../../api/propertyApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ActionsMenu from '../../components/common/ActionsMenu';
import PropertyCard from '../../components/common/PropertyCard';
import PropertyImportModal from '../../components/common/PropertyImportModal';
import { useAppearance } from '../../context/useAppearance';
import LocationFields from '../../components/common/LocationFields';
import PropertyMediaPanel from '../../components/common/PropertyMediaPanel';
import { parseImages } from '../../utils/parseImages';
import Select from '../../components/ui/Select';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none`;
const MODAL_OVERLAY_CLASS = 'fixed inset-0 bg-black/40 z-50 flex items-center justify-center';
const MODAL_CARD_CLASS = 'bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto';
const SAVE_BUTTON_CLASS = 'px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60';
const CANCEL_BUTTON_CLASS = 'px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium';

const emptyEditForm = {
  name: '',
  description: '',
  type: '',
  address: '',
  city: '',
  state: '',
  country: '',
  status: 'available',
  latitude: '',
  longitude: '',
  images: [],
};

export default function PropertiesPage() {
  const { currency, currencySymbol } = useAppearance();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], pagination: { page: 1, totalPages: 1 } });
  const [propertyTypes, setPropertyTypes] = useState([]);
  // Grid by default; remembered across visits so the user's preferred layout sticks.
  const [view, setView] = useState(() => (localStorage.getItem('propertiesView') === 'list' ? 'list' : 'grid'));
  const [editingProperty, setEditingProperty] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [banner, setBanner] = useState(null);

  const loadProperties = () => {
    listProperties({ search: query, page, limit: 8 })
      .then(setResult)
      .catch(() => setResult({ data: [], pagination: { page: 1, totalPages: 1 } }));
  };

  useEffect(() => {
    loadProperties();
  }, [query, page]);

  useEffect(() => {
    listPropertyTypes({ limit: 100 })
      .then((r) => setPropertyTypes(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch(() => {});
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setBanner(null);
    try {
      await exportPropertiesToExcel({ search: query, currency, currency_symbol: currencySymbol });
    } catch (error) {
      setBanner({ type: 'error', text: error?.userMessage || 'Could not export properties.' });
    } finally {
      setExporting(false);
    }
  };

  const changeView = (next) => {
    setView(next);
    localStorage.setItem('propertiesView', next);
  };

  const openEditModal = (property) => {
    setEditingProperty(property);
    setEditForm({
      name: property.name || '',
      description: property.description || '',
      type: property.type || '',
      address: property.address || '',
      city: property.city || '',
      state: property.state || '',
      country: property.country || '',
      status: property.status || 'available',
      latitude: property.latitude ?? '',
      longitude: property.longitude ?? '',
      images: parseImages(property.images),
    });
  };

  const setEditValue = (field, value) => setEditForm((current) => ({ ...current, [field]: value }));

  const closeEditModal = (force = false) => {
    if (saving && !force) return;
    setEditingProperty(null);
    setEditForm(emptyEditForm);
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingProperty) return;

    setSaving(true);
    try {
      await updateProperty(editingProperty.id, {
        ...editForm,
        latitude: editForm.latitude === '' ? null : editForm.latitude,
        longitude: editForm.longitude === '' ? null : editForm.longitude,
      });
      await loadProperties();
      closeEditModal(true);
    } catch (error) {
      console.error(error);
      alert('Failed to update property.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (property) => {
    if (!window.confirm(`Delete property "${property.name || 'this property'}"?`)) return;

    try {
      await deleteProperty(property.id);
      await loadProperties();
    } catch (error) {
      console.error(error);
      alert('Failed to delete property.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-end md:justify-between">
        <div className="flex-1">
          <Input label="Search properties" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, city, status..." />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5">
            {[
              { key: 'list', label: 'List view', Icon: List },
              { key: 'grid', label: 'Grid view', Icon: LayoutGrid },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => changeView(key)}
                title={label}
                aria-label={label}
                aria-pressed={view === key}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  view === key ? 'text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
                style={view === key ? { backgroundColor: 'var(--primary)' } : undefined}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
          <Button type="button" variant="secondary" onClick={handleExport} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Exporting...' : 'Export'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShowImport(true)}>
            <Upload size={15} /> Import
          </Button>
          <Link to="/properties/create"><Button>Create property</Button></Link>
        </div>
      </div>

      {banner && (
        <div className={`rounded-lg px-4 py-2 text-sm ${banner.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {banner.text}
        </div>
      )}

      {view === 'grid' ? (
        (result.data || []).length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.data.map((row) => (
              <PropertyCard
                key={row.id}
                property={row}
                onOpen={() => navigate(`/properties/${row.id}`)}
                onEdit={() => openEditModal(row)}
                onDelete={() => handleDelete(row)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
            No properties found.
          </div>
        )
      ) : (
        <Table
          columns={[
            { key: 'name', label: 'Property' },
            { key: 'city', label: 'City' },
            { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
          ]}
          rows={result.data || []}
          renderActions={(row) => (
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="primary" size="sm" onClick={() => openEditModal(row)}>Edit</Button>
              <ActionsMenu
                items={[
                  { label: '👁 View Details', onClick: () => navigate(`/properties/${row.id}`) },
                  { label: '🗑 Delete', variant: 'danger', onClick: () => handleDelete(row) },
                ]}
              />
            </div>
          )}
        />
      )}
      <Pagination page={result.pagination?.page || 1} totalPages={result.pagination?.totalPages || 1} onPageChange={setPage} />

      <PropertyImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => { setPage(1); loadProperties(); }}
      />

      {editingProperty && (
        <div className={MODAL_OVERLAY_CLASS}>
          <div className={MODAL_CARD_CLASS}>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Edit Property</h2>
              <p className="text-sm text-slate-500">Update property details below.</p>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Name</span>
                <input value={editForm.name} onChange={(e) => setEditForm((current) => ({ ...current, name: e.target.value }))} className={INPUT_CLASS} required />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Type</span>
                <Select value={editForm.type} onChange={(e) => setEditForm((current) => ({ ...current, type: e.target.value }))} className={INPUT_CLASS}>
                  <option value="">Select type...</option>
                  {propertyTypes.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Address</span>
                <input value={editForm.address} onChange={(e) => setEditForm((current) => ({ ...current, address: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">City</span>
                <input value={editForm.city} onChange={(e) => setEditForm((current) => ({ ...current, city: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">State</span>
                <input value={editForm.state} onChange={(e) => setEditForm((current) => ({ ...current, state: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Country</span>
                <input value={editForm.country} onChange={(e) => setEditForm((current) => ({ ...current, country: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <Select value={editForm.status} onChange={(e) => setEditForm((current) => ({ ...current, status: e.target.value }))} className={INPUT_CLASS}>
                  <option value="available">available</option>
                  <option value="sold">sold</option>
                  <option value="rented">rented</option>
                </Select>
              </label>
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Pricing and unit sizes are managed per configuration in the property&apos;s Manage Units tab.
              </p>
              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">Map Location</p>
                <LocationFields
                  latitude={editForm.latitude}
                  longitude={editForm.longitude}
                  onChange={setEditValue}
                  label={editForm.name}
                  height={220}
                />
              </div>
              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">Media</p>
                <PropertyMediaPanel
                  images={editForm.images}
                  onChange={(next) => setEditValue('images', next)}
                />
              </div>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Description</span>
                <textarea rows={4} value={editForm.description} onChange={(e) => setEditForm((current) => ({ ...current, description: e.target.value }))} className={TEXTAREA_CLASS} />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closeEditModal}>Cancel</Button>
                <Button type="submit"  disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

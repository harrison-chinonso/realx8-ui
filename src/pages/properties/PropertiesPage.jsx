import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, List, Download, Upload, Home, CheckCircle2, Clock, FileText, ShieldAlert,
} from 'lucide-react';
import { listProperties, updateProperty, deleteProperty, listPropertyTypes, listBranches, exportPropertiesToExcel, getPropertiesSummary } from '../../api/propertyApi';
import { TintCard, useModuleAccent } from '../../components/dashboard/DashboardKit';
import { stockOf, priceRangeOf } from '../../components/property/propertyFigures';
import { useCurrency } from '../../context/useAppearance';
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
import { enumLabel } from '../../utils/enumLabel';
import FieldMark from '../../components/ui/FieldMark';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none`;
const MODAL_OVERLAY_CLASS = 'fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4';
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
  branch_id: '',
  latitude: '',
  longitude: '',
  images: [],
};

/**
 * The quick filters above the grid. Each is a column filter the list endpoint
 * already understands (`filter[status]`, `filter[approval_status]`), so a chip
 * narrows the query rather than the page on screen.
 */
const QUICK_FILTERS = [
  { key: 'all', label: 'All', filter: null, count: (s) => s?.properties },
  { key: 'available', label: 'Available', filter: { status: 'available' }, count: (s) => s?.by_status?.available },
  { key: 'pending', label: 'Awaiting approval', filter: { approval_status: 'pending_review' }, count: (s) => s?.by_approval?.pending_review },
  { key: 'sold', label: 'Sold', filter: { status: 'sold' }, count: (s) => s?.by_status?.sold },
  { key: 'rented', label: 'Rented', filter: { status: 'rented' }, count: (s) => s?.by_status?.rented },
];

export default function PropertiesPage() {
  const { currency, currencySymbol } = useAppearance();
  const fmt = useCurrency();
  const { accentFor } = useModuleAccent();
  const [summary, setSummary] = useState(null);
  const [quick, setQuick] = useState('all');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], pagination: { page: 1, totalPages: 1 } });
  const [propertyTypes, setPropertyTypes] = useState([]);
  // Grid by default; remembered across visits so the user's preferred layout sticks.
  const [view, setView] = useState(() => (localStorage.getItem('propertiesView') === 'list' ? 'list' : 'grid'));
  const [branches, setBranches] = useState([]);
  const [editingProperty, setEditingProperty] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [banner, setBanner] = useState(null);

  const activeFilter = QUICK_FILTERS.find((f) => f.key === quick)?.filter;
  const loadProperties = () => {
    listProperties({ search: query, page, limit: 8, ...(activeFilter ? { filter: activeFilter } : {}) })
      .then(setResult)
      .catch(() => setResult({ data: [], pagination: { page: 1, totalPages: 1 } }));
  };

  useEffect(() => {
    loadProperties();
  }, [query, page, quick]);

  // One call for the whole strip; re-read after anything that changes stock.
  const loadSummary = () => getPropertiesSummary().then(setSummary).catch(() => setSummary(null));
  useEffect(() => { loadSummary(); }, []);

  useEffect(() => {
    listPropertyTypes({ limit: 100 })
      .then((r) => setPropertyTypes(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch(() => {});

    listBranches({ limit: 'all' })
      .then((r) => setBranches(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch(() => setBranches([]));
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
      branch_id: property.branch_id ?? '',
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
        // "" is the form's way of saying no branch; the server hears null.
        branch_id: editForm.branch_id === '' ? null : Number(editForm.branch_id),
      });
      await loadProperties();
      loadSummary();
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
      loadSummary();
    } catch (error) {
      console.error(error);
      alert('Failed to delete property.');
    }
  };

  const pagination = result.pagination || {};
  const shownFrom = (result.data || []).length ? ((pagination.page || 1) - 1) * 8 + 1 : 0;
  const shownTo = shownFrom ? shownFrom + (result.data || []).length - 1 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-600">Property listing</p>
          <h1 className="font-heading text-2xl font-extrabold text-slate-900 sm:text-3xl">All properties</h1>
          <p className="text-sm text-slate-600">Every estate your company sells, its stock, and where each one is in approval.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={handleExport} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Exporting…' : 'Export'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShowImport(true)}>
            <Upload size={15} /> Import
          </Button>
          <Link to="/properties/create"><Button>Create property</Button></Link>
        </div>
      </div>

      {/* Company-wide, not the page on screen — one summary call. */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <TintCard accent={accentFor('Properties')} icon={Home} value={summary.properties.toLocaleString()} label="Properties" />
          <TintCard accent={accentFor('People & Access')} icon={CheckCircle2} value={`${summary.units.available.toLocaleString()} / ${summary.units.total.toLocaleString()}`} label="Units available" />
          <TintCard accent={accentFor('Sales & CRM')} icon={Clock} value={summary.units.held.toLocaleString()} label="Units held by payments" />
          <TintCard accent={accentFor('Dashboard')} icon={FileText} value={summary.purchase_requests_this_month.toLocaleString()} label="Purchase requests" sub="This month" />
          <TintCard accent={accentFor('Marketing & Content')} icon={ShieldAlert} value={(summary.by_approval?.pending_review ?? 0).toLocaleString()} label="Awaiting approval" />
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-[18px] bg-white p-3 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-end">
        <div className="flex-1">
          <Input label="Search properties" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search by name, city, status..." />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((chip) => {
            const count = chip.count(summary);
            if (chip.key !== 'all' && !count) return null;
            const on = quick === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={on}
                onClick={() => { setQuick(chip.key); setPage(1); }}
                className={`h-9 rounded-full px-3.5 text-[13px] font-bold transition-colors ${on ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50'}`}
              >
                {chip.label}{count != null ? ` · ${Number(count).toLocaleString()}` : ''}
              </button>
            );
          })}
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
        </div>
      </div>

      {banner && (
        <div className={`rounded-lg px-4 py-2 text-sm ${banner.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {banner.text}
        </div>
      )}

      {view === 'grid' ? (
        (result.data || []).length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.data.map((row) => (
              <PropertyCard
                key={row.id}
                property={row}
                showApproval
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
        searchable={false}
        exportable={false}
          columns={[
            { key: 'name', label: 'Property' },
            { key: 'city', label: 'City' },
            { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
            { key: 'approval_status', label: 'Approval', render: (row) => <Badge value={row.approval_status || 'draft'} /> },
            { key: 'submitted_by', label: 'Submitted by', render: (row) => row.submitted_by?.name || '—' },
            {
              key: 'units',
              label: 'Units available',
              render: (row) => {
                const stock = stockOf(row.units || [], row);
                return stock.total ? `${stock.available.toLocaleString()} of ${stock.total.toLocaleString()}` : '—';
              },
            },
            {
              key: 'from',
              label: 'From',
              render: (row) => {
                const range = priceRangeOf(row.units || []);
                return range ? fmt(range.min) : '—';
              },
            },
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
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        {shownFrom > 0 && pagination.total != null && (
          <p className="text-sm text-slate-600">Showing {shownFrom}–{shownTo} of {Number(pagination.total).toLocaleString()} properties</p>
        )}
        <Pagination page={pagination.page || 1} totalPages={pagination.totalPages || 1} onPageChange={setPage} />
      </div>

      <PropertyImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => { setPage(1); loadProperties(); loadSummary(); }}
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
                <span className="text-sm font-medium text-slate-700">Name<FieldMark required /></span>
                <input value={editForm.name} onChange={(e) => setEditForm((current) => ({ ...current, name: e.target.value }))} className={INPUT_CLASS} required />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Type<FieldMark /></span>
                <Select value={editForm.type} onChange={(e) => setEditForm((current) => ({ ...current, type: e.target.value }))} className={INPUT_CLASS}>
                  <option value="">Select type...</option>
                  {propertyTypes.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Address<FieldMark /></span>
                <input value={editForm.address} onChange={(e) => setEditForm((current) => ({ ...current, address: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">City<FieldMark /></span>
                <input value={editForm.city} onChange={(e) => setEditForm((current) => ({ ...current, city: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">State<FieldMark /></span>
                <input value={editForm.state} onChange={(e) => setEditForm((current) => ({ ...current, state: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Country<FieldMark /></span>
                <input value={editForm.country} onChange={(e) => setEditForm((current) => ({ ...current, country: e.target.value }))} className={INPUT_CLASS} />
              </label>
              {/* One branch, or none. Moving a property here moves it OUT of
                  whichever branch it was in — there is one column, so there is
                  nowhere for a second assignment to go. */}
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Branch<FieldMark /></span>
                <Select value={editForm.branch_id} onChange={(e) => setEditForm((current) => ({ ...current, branch_id: e.target.value }))} className={INPUT_CLASS}>
                  <option value="">No branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Status<FieldMark /></span>
                <Select value={editForm.status} onChange={(e) => setEditForm((current) => ({ ...current, status: e.target.value }))} className={INPUT_CLASS}>
                  <option value="available">{enumLabel('available')}</option>
                  <option value="sold">{enumLabel('sold')}</option>
                  <option value="rented">{enumLabel('rented')}</option>
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
                <span className="text-sm font-medium text-slate-700">Description<FieldMark /></span>
                <textarea rows={4} value={editForm.description} onChange={(e) => setEditForm((current) => ({ ...current, description: e.target.value }))} className={TEXTAREA_CLASS} />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closeEditModal}>Cancel</Button>
                <Button type="submit"  disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

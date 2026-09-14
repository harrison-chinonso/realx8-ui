import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  addPropertyAmenity,
  addPropertyDocument,
  approveProperty,
  addPropertyUnitConfig,
  deletePropertyDocument,
  setPropertyDocumentShareable,
  deletePropertyUnitConfig,
  getProperty,
  getPropertyAmenities,
  getPropertyDocuments,
  getPropertyPlots,
  getPropertyUnits,
  listPurchaseRequests,
  rejectProperty,
  requestRevision,
  submitPropertyForApproval,
  updatePropertyImages,
  uploadPropertyMedia,
} from '../../api/propertyApi';
import Badge from '../../components/common/Badge';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import PropertyMediaPanel from '../../components/common/PropertyMediaPanel';
import PropertyMap, { toCoords } from '../../components/common/PropertyMap';
import PublicLinkPanel from '../../components/common/PublicLinkPanel';
import PropertyUnitFields, { emptyUnitConfig, describeUnitConfig } from '../../components/common/PropertyUnitFields';
import { useCurrency } from '../../context/useAppearance';
import useAuthStore from '../../store/authStore';
import Select from '../../components/ui/Select';
import PropertyInstallmentPlansPanel from '../../components/properties/PropertyInstallmentPlansPanel';
import { usePermission } from '../../hooks/usePermission';
import { enumLabel } from '../../utils/enumLabel';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const emptyAmenityForm = { name: '', description: '' };
// is_shareable defaults to false here for the same reason it does in the
// database: a document becomes visible to buyers because somebody chose it,
// never because they forgot to untick something.
const emptyDocumentForm = { name: '', type: 'deed', url: '', file: null, is_shareable: false };

const getData = (response) => response?.data ?? response ?? null;
const getItems = (response) => response?.data ?? response ?? [];
const getErrorMessage = (error, fallback) => error?.userMessage || fallback;
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

function DocumentTypeBadge({ value }) {
  const palette = {
    deed: 'bg-sky-100 text-sky-700',
    survey: 'bg-violet-100 text-violet-700',
    title: 'bg-emerald-100 text-emerald-700',
    floor_plan: 'bg-amber-100 text-amber-700',
    other: 'bg-slate-100 text-slate-700',
  };

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${palette[value] || palette.other}`}>
      {value || 'other'}
    </span>
  );
}

export default function PropertyDetailPage() {
  const fmt = useCurrency();
  const user = useAuthStore((state) => state.user);
  const { id } = useParams();
  const [tab, setTab] = useState('units');
  const [property, setProperty] = useState(null);
  const [units, setUnits] = useState([]);
  const [plots, setPlots] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [mediaImages, setMediaImages] = useState([]);
  const [savingMedia, setSavingMedia] = useState(false);
  const [unitForm, setUnitForm] = useState(emptyUnitConfig);
  /**
   * Editing units sets prices and available quantities, so it is its own
   * permission. Hiding the controls is presentation only — the routes behind
   * them enforce the same permission, which until now they did not.
   */
  const canManageUnits = usePermission('properties.units.manage');
  const [savingUnit, setSavingUnit] = useState(false);
  const [showAmenityModal, setShowAmenityModal] = useState(false);
  const [amenityForm, setAmenityForm] = useState(emptyAmenityForm);
  const [savingAmenity, setSavingAmenity] = useState(false);
  const [documentForm, setDocumentForm] = useState(emptyDocumentForm);
  const [savingDocument, setSavingDocument] = useState(false);
  const [sharingId, setSharingId] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const roleNames = useMemo(() => {
    const names = new Set();
    if (user?.type) names.add(user.type);
    if (Array.isArray(user?.roles)) {
      user.roles.forEach((role) => {
        if (typeof role === 'string') names.add(role);
        else if (role?.name) names.add(role.name);
      });
    }
    return names;
  }, [user]);

  const isAdminReviewer = ['superior_admin', 'super_admin', 'admin'].some((role) => roleNames.has(role));
  const isProductManager = roleNames.has('product_manager');

  const setFeedback = (type, text) => {
    setMessage({ type, text });
  };

  const loadAmenities = async () => {
    try {
      const amenitiesResponse = await getPropertyAmenities(id);
      setAmenities(getItems(amenitiesResponse));
    } catch (error) {
      console.error(error);
      setAmenities([]);
    }
  };

  const loadDocuments = async () => {
    try {
      const documentsResponse = await getPropertyDocuments(id);
      setDocuments(getItems(documentsResponse));
    } catch (error) {
      console.error(error);
      setDocuments([]);
    }
  };

  const loadRequests = async () => {
    try {
      setRequests(getItems(await listPurchaseRequests(id)));
    } catch (error) {
      console.error(error);
      setRequests([]);
    }
  };

  const loadUnits = async () => {
    try {
      const unitsResponse = await getPropertyUnits(id);
      setUnits(getItems(unitsResponse));
    } catch (error) {
      console.error(error);
      setUnits([]);
    }
  };

  const loadDetails = async () => {
    try {
      const [propertyResponse, unitsResponse, plotsResponse, amenitiesResponse, documentsResponse] = await Promise.all([
        getProperty(id),
        getPropertyUnits(id),
        getPropertyPlots(id),
        getPropertyAmenities(id),
        getPropertyDocuments(id),
      ]);
      const propertyData = getData(propertyResponse);
      setProperty(propertyData);
      setUnits(getItems(unitsResponse));
      setPlots(getItems(plotsResponse));
      setAmenities(getItems(amenitiesResponse));
      setDocuments(getItems(documentsResponse));
      const raw = propertyData?.images;
      setMediaImages(Array.isArray(raw) ? raw : (raw ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []));
    } catch (error) {
      console.error(error);
      setProperty(null);
      setUnits([]);
      setPlots([]);
      setAmenities([]);
      setDocuments([]);
    }
  };

  useEffect(() => {
    loadDetails();
    loadRequests();
  }, [id]);

  const handleAddUnit = async (event) => {
    event.preventDefault();
    setSavingUnit(true);
    setMessage(null);
    try {
      await addPropertyUnitConfig(id, {
        name: unitForm.name?.trim() || undefined,
        size: unitForm.size === '' ? null : Number(unitForm.size),
        unit: unitForm.unit || 'sqm',
        price: unitForm.price === '' ? 0 : Number(unitForm.price),
        quantity: unitForm.quantity === '' ? 1 : Number(unitForm.quantity),
      });
      setUnitForm(emptyUnitConfig);
      // Reload the property too: its "from" price is derived from the units.
      await loadDetails();
      setFeedback('success', 'Unit configuration added.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to add unit configuration.'));
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDeleteUnit = async (unit) => {
    if (!window.confirm(`Delete the "${unit.name}" unit configuration?`)) return;
    setMessage(null);
    try {
      await deletePropertyUnitConfig(id, unit.id);
      await loadDetails();
      setFeedback('success', 'Unit configuration deleted.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to delete unit configuration.'));
    }
  };

  const closeAmenityModal = (force = false) => {
    if (savingAmenity && !force) return;
    setShowAmenityModal(false);
    setAmenityForm(emptyAmenityForm);
  };

  const handleAddAmenity = async (event) => {
    event.preventDefault();
    if (!amenityForm.name.trim()) return;
    setSavingAmenity(true);
    setMessage(null);
    try {
      await addPropertyAmenity(id, {
        name: amenityForm.name.trim(),
        description: amenityForm.description.trim() || null,
      });
      closeAmenityModal(true);
      await loadAmenities();
      setFeedback('success', 'Amenity added successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to add amenity.'));
    } finally {
      setSavingAmenity(false);
    }
  };

  const handleSaveMedia = async (updatedImages) => {
    setSavingMedia(true);
    setMessage(null);
    try {
      await updatePropertyImages(id, updatedImages);
      setMediaImages(updatedImages);
      setProperty((prev) => (prev ? { ...prev, images: updatedImages } : prev));
      setFeedback('success', 'Media saved successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to save media.'));
    } finally {
      setSavingMedia(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setApprovalSaving(true);
    setMessage(null);
    try {
      await submitPropertyForApproval(id);
      await loadDetails();
      setApprovalNotes('');
      setFeedback('success', 'Property submitted for approval.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to submit property for approval.'));
    } finally {
      setApprovalSaving(false);
    }
  };

  const handleApprovalAction = async (action) => {
    setApprovalSaving(true);
    setMessage(null);
    try {
      const payload = { notes: approvalNotes.trim() || null };
      if (action === 'approve') await approveProperty(id, payload);
      if (action === 'reject') await rejectProperty(id, payload);
      if (action === 'revision') await requestRevision(id, payload);
      await loadDetails();
      setApprovalNotes('');
      setFeedback('success', action === 'approve'
        ? 'Property approved successfully.'
        : action === 'reject'
          ? 'Property rejected successfully.'
          : 'Revision request sent successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to update approval status.'));
    } finally {
      setApprovalSaving(false);
    }
  };

  const handleDocumentFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setDocumentForm((current) => ({
      ...current,
      file,
      name: current.name || file?.name || '',
    }));
  };

  /**
   * Flips buyer visibility for one document.
   *
   * Reloads rather than patching local state: the server decides, and a row
   * that silently disagreed with it would be the worst possible bug in a
   * control whose whole job is "who can see this".
   */
  const handleToggleShareable = async (doc) => {
    setSharingId(doc.id);
    try {
      await setPropertyDocumentShareable(doc.id, !doc.is_shareable);
      await loadDocuments();
    } catch (error) {
      alert(error?.response?.data?.message || 'Could not change who can see this document.');
    } finally {
      setSharingId(null);
    }
  };

  const handleAddDocument = async (event) => {
    event.preventDefault();
    setSavingDocument(true);
    setMessage(null);

    try {
      let url = documentForm.url.trim();
      let name = documentForm.name.trim();

      if (documentForm.file) {
        const uploadedFiles = await uploadPropertyMedia([documentForm.file]);
        const uploaded = uploadedFiles?.[0];
        url = uploaded?.url || url;
        name = name || uploaded?.name || documentForm.file.name;
      }

      if (!url) throw new Error('A document URL or upload is required.');

      await addPropertyDocument(id, {
        name: name || 'Property Document',
        type: documentForm.type,
        is_shareable: documentForm.is_shareable,
        url,
      });
      setDocumentForm(emptyDocumentForm);
      await loadDocuments();
      setFeedback('success', 'Document added successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to add document.'));
    } finally {
      setSavingDocument(false);
    }
  };

  const handleDeleteDocument = async (document) => {
    if (!window.confirm(`Delete document "${document.name || document.file_name || document.id}"?`)) return;
    try {
      await deletePropertyDocument(document.id);
      await loadDocuments();
      setFeedback('success', 'Document deleted successfully.');
    } catch (error) {
      console.error(error);
      setFeedback('error', getErrorMessage(error, 'Failed to delete document.'));
    }
  };

  const renderApprovalPanel = () => {
    const status = property?.approval_status || 'draft';
    const notes = property?.approval_notes || '—';

    if (status === 'pending_review') {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-amber-900">Awaiting Approval</h2>
              <p className="mt-1 text-sm text-amber-800">This property is waiting for administrative review.</p>
            </div>
            {isAdminReviewer && (
              <div className="w-full max-w-xl space-y-3">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-amber-900">Review Notes</span>
                  <textarea
                    rows={3}
                    value={approvalNotes}
                    onChange={(event) => setApprovalNotes(event.target.value)}
                    className={`${INPUT_CLASS} resize-none bg-white`}
                    placeholder="Optional notes for the submitter"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="success" onClick={() => handleApprovalAction('approve')} disabled={approvalSaving}>Approve</Button>
                  <Button type="button" variant="danger" onClick={() => handleApprovalAction('reject')} disabled={approvalSaving}>Reject</Button>
                  <Button type="button" variant="warning" onClick={() => handleApprovalAction('revision')} disabled={approvalSaving}>Request Revision</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (status === 'approved') {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-900">Approved ✓</h2>
          <p className="mt-1 text-sm text-emerald-700">Approved on {formatDate(property?.approved_at || property?.updated_at)}.</p>
        </div>
      );
    }

    if (status === 'rejected') {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-rose-900">Rejected</h2>
          <p className="mt-1 text-sm text-rose-700">{notes}</p>
        </div>
      );
    }

    if (status === 'revision_requested') {
      return (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-orange-900">Revision Requested</h2>
              <p className="mt-1 text-sm text-orange-700">{notes}</p>
            </div>
            {isProductManager && (
              <Button type="button" onClick={handleSubmitForApproval} disabled={approvalSaving}>Submit for Approval</Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Draft Approval Status</h2>
            <p className="mt-1 text-sm text-slate-600">This property is still in draft and has not been submitted for review.</p>
          </div>
          {isProductManager && (
            <Button type="button" onClick={handleSubmitForApproval} disabled={approvalSaving}>Submit for Approval</Button>
          )}
        </div>
      </div>
    );
  };

  if (!property) return <div className="rounded-xl bg-white p-6">Loading property...</div>;

  const coords = toCoords(property.latitude, property.longitude);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Link to="/properties"><Button variant="secondary" size="sm">← Back to Properties</Button></Link>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-bold text-slate-900">{property.name}</h1>
            {property.type && <p className="mt-1 text-sm font-medium" style={{ color: 'var(--primary)' }}>{property.type}</p>}
            <p className="mt-1 text-sm text-slate-500">
              {[property.address, property.city, property.state, property.country].filter(Boolean).join(', ') || 'No address provided.'}
            </p>
          </div>
          <Badge value={property.status} />
        </div>
        {property.description && (
          <p className="mt-4 text-sm leading-relaxed text-slate-700">{property.description}</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {property.type && <div className="rounded-lg bg-slate-50 p-3"><div className="mb-1 text-xs text-slate-500">Type</div><div className="font-medium text-slate-900">{property.type}</div></div>}
          {property.status && <div className="rounded-lg bg-slate-50 p-3"><div className="mb-1 text-xs text-slate-500">Status</div><div className="font-medium text-slate-900">{enumLabel(property.status)}</div></div>}
          <div className="rounded-lg bg-slate-50 p-3"><div className="mb-1 text-xs text-slate-500">Approval</div><div className="font-medium text-slate-900">{enumLabel(property.approval_status || 'draft')}</div></div>
          {property.country && <div className="rounded-lg bg-slate-50 p-3"><div className="mb-1 text-xs text-slate-500">Country</div><div className="font-medium text-slate-900">{property.country}</div></div>}
        </div>
      </div>

      {coords && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Location</h2>
            <span className="font-mono text-xs text-slate-500">{coords[0].toFixed(6)}, {coords[1].toFixed(6)}</span>
          </div>
          <PropertyMap latitude={property.latitude} longitude={property.longitude} label={property.name} height={360} />
          <a
            className="mt-3 inline-block text-sm font-medium hover:underline"
            style={{ color: 'var(--primary)' }}
            href={`https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps ↗
          </a>
        </div>
      )}

      <PublicLinkPanel
        property={property}
        onChange={(patch) => setProperty((current) => (current ? { ...current, ...patch } : current))}
      />

      {renderApprovalPanel()}

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex gap-3 flex-wrap">
          {['units', 'payment plans', 'plots', 'amenities', 'media', 'documents', 'requests'].map((item) => (
            <Button key={item} variant={tab === item ? 'primary' : 'secondary'} size="sm" onClick={() => setTab(item)}>
              {item === 'requests'
                ? `Purchase Requests${requests.length ? ` (${requests.length})` : ''}`
                : item === 'media'
                ? `📷 Media${mediaImages.length ? ` (${mediaImages.length})` : ''}`
                : item === 'documents'
                  ? `Documents${documents.length ? ` (${documents.length})` : ''}`
                  : item}
            </Button>
          ))}
        </div>

        {tab === 'units' && (
          <div className="space-y-4">
            {/*
                  The shared Table, not a hand-rolled one.

                  Seven columns is unreadable on a phone whatever the styling:
                  it scrolls sideways and the unit name — the thing a buyer is
                  actually scanning — leaves the screen as soon as you scroll to
                  see a price. The shared component renders stacked cards below
                  `sm` and the table above it, so this is the one place that
                  needed changing rather than every table in the application.

                  Search and export are off: this sits inside a tab beside a
                  form, and a toolbar there is clutter. The property list above
                  is where a search belongs.
                */}
                <Table
                  searchable={false}
                  exportable={false}
                  rows={units}
                  columns={[
                    { key: 'name', label: 'Unit Name', render: (unit) => describeUnitConfig(unit) },
                    { key: 'quantity', label: 'Quantity', render: (unit) => unit.quantity ?? '—' },
                    {
                      key: 'size',
                      label: 'Property Size',
                      render: (unit) => (unit.size ? Number(unit.size).toLocaleString() : '—'),
                    },
                    { key: 'unit', label: 'Measured In', render: (unit) => unit.unit || 'sqm' },
                    { key: 'price', label: 'Price', render: (unit) => fmt(unit.price || 0) },
                    { key: 'status', label: 'Status', render: (unit) => <Badge value={unit.status} /> },
                  ]}
                  emptyMessage="No unit configurations yet. Add one below."
                  renderActions={canManageUnits ? (unit) => (
                    <Button type="button" variant="danger" size="sm" onClick={() => handleDeleteUnit(unit)}>
                      Delete
                    </Button>
              ) : undefined}
            />

            {canManageUnits ? (
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900">Add Unit Configuration</h2>
                  <p className="text-xs text-slate-500">
                    A property can have several configurations. The property&apos;s listed price is the
                    lowest price across them.
                  </p>
                </div>
                <form onSubmit={handleAddUnit} className="space-y-3">
                  <PropertyUnitFields value={unitForm} onChange={setUnitForm} />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={savingUnit}>{savingUnit ? 'Saving…' : 'Add Configuration'}</Button>
                  </div>
                </form>
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
                You have read-only access to unit configurations. Editing them requires the
                &ldquo;Edit Property Units&rdquo; permission.
              </p>
            )}
          </div>
        )}
        {tab === 'payment plans' && (
          <PropertyInstallmentPlansPanel propertyId={id} />
        )}
        {tab === 'requests' && (
          /* Same reasoning as the units tab: six columns, and on a phone the
             buyer's name scrolls out of view before you reach the status. */
          <Table
            searchable={false}
            exportable={false}
            rows={requests}
            emptyMessage="No purchase requests yet. They arrive when someone buys from a shared link."
            columns={[
              { key: 'buyer', label: 'Buyer', render: (r) => r.buyer_name || '—' },
              {
                key: 'contact',
                label: 'Contact',
                render: (r) => (
                  <div>
                    <div>{r.buyer_email || '—'}</div>
                    {r.buyer_phone && <div className="text-xs text-slate-500">{r.buyer_phone}</div>}
                  </div>
                ),
              },
              {
                key: 'unit',
                label: 'Unit',
                render: (r) => (
                  <div>
                    {r.unit_label || 'Any'}
                    {r.unit_price ? <div className="text-xs text-slate-500">{fmt(r.unit_price)}</div> : null}
                  </div>
                ),
              },
              { key: 'quantity', label: 'Qty', render: (r) => r.quantity },
              {
                key: 'requested',
                label: 'Requested',
                render: (r) => formatDate(r.created_at || r.createdAt),
              },
              { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
            ]}
          />
        )}
        {tab === 'plots' && (
          <div className="grid gap-3 md:grid-cols-2">
            {plots.map((plot) => (
              <div key={plot.id} className="rounded-lg border border-slate-200 p-4">
                <div className="font-semibold">{plot.name}</div>
                <div className="text-sm text-slate-500">{plot.size} • {fmt(plot.price || 0)}</div>
              </div>
            ))}
            {!plots.length && <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No plots available yet.</div>}
          </div>
        )}
        {tab === 'amenities' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">{amenities.map((amenity) => <span key={amenity.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">{amenity.name}</span>)}</div>
            {!amenities.length && <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No amenities added yet.</div>}
            <Button type="button" onClick={() => setShowAmenityModal(true)}>Add Amenity</Button>
          </div>
        )}
        {tab === 'media' && (
          <PropertyMediaPanel
            images={mediaImages}
            onChange={setMediaImages}
            onSave={handleSaveMedia}
            saving={savingMedia}
          />
        )}
        {tab === 'documents' && (
          <div className="space-y-6">
            {/* Shared Table for the mobile card layout — see the units tab. */}
            <Table
              searchable={false}
              exportable={false}
              rows={documents}
              emptyMessage="No documents added yet."
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  render: (d) => d.name || d.file_name || 'Untitled Document',
                },
                { key: 'type', label: 'Type', render: (d) => <DocumentTypeBadge value={d.type} /> },
                {
                  key: 'is_shareable',
                  label: 'Buyers',
                  /**
                   * Stated on every row, not only the shared ones. "Staff only"
                   * is the answer for most documents and it should be visible
                   * rather than inferred from the absence of a badge.
                   */
                  render: (d) => (d.is_shareable
                    ? <span className="whitespace-nowrap rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">Can view</span>
                    : <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Staff only</span>),
                },
                {
                  key: 'download',
                  label: 'Download',
                  render: (d) => (d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:underline"
                      style={{ color: 'var(--primary)' }}
                    >
                      Open Document
                    </a>
                  ) : '—'),
                },
              ]}
              renderActions={(d) => (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={sharingId === d.id}
                    onClick={() => handleToggleShareable(d)}
                    title={d.is_shareable
                      ? 'Stop showing this to prospective buyers'
                      : 'Let prospective buyers read this. They cannot download it.'}
                  >
                    {sharingId === d.id ? 'Saving…' : d.is_shareable ? 'Unshare' : 'Share'}
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => handleDeleteDocument(d)}>
                    Delete
                  </Button>
                </div>
              )}
            />

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Add Document</h2>
                <p className="text-sm text-slate-500">
                  Provide a document URL or upload a file. Documents are staff-only unless you
                  share them.
                </p>
              </div>
              <form onSubmit={handleAddDocument} className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Name"
                  value={documentForm.name}
                  onChange={(event) => setDocumentForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Title Deed"
                />
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Type</span>
                  <Select className={INPUT_CLASS} value={documentForm.type} onChange={(event) => setDocumentForm((current) => ({ ...current, type: event.target.value }))}>
                    <option value="deed">Deed</option>
                    <option value="survey">Survey</option>
                    <option value="title">Title</option>
                    <option value="floor_plan">Floor Plan</option>
                    <option value="other">Other</option>
                  </Select>
                </label>
                <Input
                  label="Document URL"
                  value={documentForm.url}
                  onChange={(event) => setDocumentForm((current) => ({ ...current, url: event.target.value }))}
                  placeholder="https://..."
                />
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Upload File</span>
                  <input type="file" onChange={handleDocumentFileChange} className={INPUT_CLASS} />
                </label>
                {/*
                  * Sharing is decided when the document is added, as well as
                  * afterwards from the table. Unticked by default — the same
                  * fail-closed default the column and the database use.
                  */}
                <label className="md:col-span-2 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={documentForm.is_shareable}
                    onChange={(event) => setDocumentForm((current) => ({ ...current, is_shareable: event.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">
                    Let prospective buyers view this
                    <span className="mt-0.5 block text-xs text-slate-500">
                      They can read it on the property page. No download is offered.
                    </span>
                  </span>
                </label>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={savingDocument}>{savingDocument ? 'Saving…' : 'Add Document'}</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <Modal open={showAmenityModal} onClose={closeAmenityModal} title="Add Amenity" size="sm">
        <form onSubmit={handleAddAmenity} className="space-y-4">
          <Input
            label="Name"
            value={amenityForm.name}
            onChange={(event) => setAmenityForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <Input
            label="Description"
            value={amenityForm.description}
            onChange={(event) => setAmenityForm((current) => ({ ...current, description: event.target.value }))}
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={savingAmenity}>{savingAmenity ? 'Saving…' : 'Add Amenity'}</Button>
            <Button type="button" variant="secondary" onClick={closeAmenityModal}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

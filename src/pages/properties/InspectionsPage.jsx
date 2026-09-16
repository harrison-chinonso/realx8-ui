import { useEffect, useMemo, useState } from 'react';
import { createInspection, listInspections, confirmInspection, completeInspection, cancelInspection, approveInspection, rejectInspection, listSelectableLeads } from '../../api/inspectionApi';
import { createLead } from '../../api/crmApi';
import InspectionReviewModal from '../../components/common/InspectionReviewModal';
import useAuthStore from '../../store/authStore';
import { listProperties } from '../../api/propertyApi';
import { listRealtors, listClients } from '../../api/userApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';

const emptyScheduleForm = {
  lead_id: '',
  client_name: '',
  client_phone: '',
  property_id: '',
  property_name: '',
  realtor_id: '',
  realtor_name: '',
  scheduled_date: '',
  scheduled_time: '',
  attendees: '1',
  notes: '',
};

const emptyFeedbackForm = {
  client_satisfaction: '5',
  client_feedback: '',
  realtor_notes: '',
};

const toList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '—');
const preview = (value) => value ? `${String(value).slice(0, 50)}${String(value).length > 50 ? '…' : ''}` : '—';

const SELECT_CLASS = 'w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50';

export default function InspectionsPage() {
  const [inspections, setInspections] = useState([]);
  const [properties, setProperties] = useState([]);
  const [realtors, setRealtors] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [detailRow, setDetailRow] = useState(null);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [feedbackForm, setFeedbackForm] = useState(emptyFeedbackForm);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [leads, setLeads] = useState([]);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '' });
  const [savingLead, setSavingLead] = useState(false);
  const [review, setReview] = useState(null);   // { inspection, decision }
  const currentUser = useAuthStore((state) => state.user);
  const effectiveType = useAuthStore((state) => state.effectiveType());
  const isRealtorUser = effectiveType === 'realtor';
  const canReview = ['admin', 'super_admin', 'superior_admin'].includes(effectiveType);

  const loadData = async () => {
    setLoading(true);
    try {
      // allSettled, not all: /clients and /realtors are admin-only, so for a
      // realtor those 403 — and one rejection would otherwise blank the whole
      // page, including the inspections they are entitled to see.
      const [inspectionRes, propertyRes, realtorRes, clientRes] = await Promise.allSettled([
        listInspections({ limit: 200 }),
        listProperties({ limit: 200 }),
        listRealtors({ limit: 200 }),
        listClients({ limit: 200 }),
      ]);
      const valueOf = (result) => (result.status === 'fulfilled' ? toList(result.value) : []);
      setInspections(valueOf(inspectionRes));
      setProperties(valueOf(propertyRes));
      setRealtors(valueOf(realtorRes));

      setClients(valueOf(clientRes));

      // Inspections are booked against LEADS. The endpoint already scopes a
      // realtor to leads they created or were assigned.
      const leadRes = await listSelectableLeads().catch(() => null);
      setLeads(toList(leadRes) || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const propertyOptions = useMemo(
    () => properties.map((p) => ({ id: p.id, label: p.address ? `${p.name} — ${p.address}` : p.name, name: p.name })),
    [properties]
  );

  const columns = [
    { key: 'ref_number', label: 'Ref#' },
    { key: 'property_name', label: 'Property', render: (row) => row.property_name || row.property?.name || '—' },
    { key: 'client_name', label: 'Lead' },
    { key: 'scheduled_at', label: 'Scheduled', render: (row) => formatDateTime(row.scheduled_at) },
    { key: 'attendees', label: 'Attendees', render: (row) => row.attendees ?? 1 },
    { key: 'approval_status', label: 'Approval', render: (row) => <Badge value={row.approval_status || 'approved'} /> },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
  ];

  const detailFields = [
    { label: 'Reference Number', key: 'ref_number' },
    { label: 'Property', render: (row) => row.property_name || row.property?.name || '—' },
    { label: 'Lead', key: 'client_name' },
    { label: 'Lead Phone', key: 'client_phone' },
    { label: 'Realtor', key: 'realtor_name' },
    { label: 'Scheduled', render: (row) => formatDateTime(row.scheduled_at) },
    { label: 'Attendees', render: (row) => row.attendees ?? 1 },
    { label: 'Approval', render: (row) => <Badge value={row.approval_status || 'approved'} /> },
    { label: 'Approval Notes', key: 'approval_notes' },
    { label: 'Status', render: (row) => <Badge value={row.status} /> },
    { label: 'Feedback', render: (row) => row.client_feedback ? `${row.client_satisfaction || '—'}/5 • ${preview(row.client_feedback)}` : '—' },
    { label: 'Realtor Notes', key: 'realtor_notes' },
    { label: 'Notes', key: 'notes' },
  ];

  const handleLeadChange = (e) => {
    const lead = leads.find((l) => String(l.id) === String(e.target.value));
    setScheduleForm((f) => ({
      ...f,
      lead_id: e.target.value,
      client_name: lead?.name || '',
      client_phone: lead?.phone || '',
    }));
  };

  const handleCreateLead = async (event) => {
    event.preventDefault();
    if (!leadForm.name.trim()) return;
    setSavingLead(true);
    try {
      const response = await createLead({
        name: leadForm.name.trim(),
        email: leadForm.email.trim() || null,
        phone: leadForm.phone.trim() || null,
        // Assign to the creating realtor so it is immediately selectable.
        ...(isRealtorUser && currentUser?.id ? { assigned_to: currentUser.id } : {}),
      });
      const lead = response?.data ?? response;
      const refreshed = await listSelectableLeads().catch(() => null);
      setLeads(toList(refreshed) || []);
      setScheduleForm((f) => ({ ...f, lead_id: String(lead.id), client_name: lead.name, client_phone: lead.phone || '' }));
      setLeadForm({ name: '', email: '', phone: '' });
      setShowLeadForm(false);
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Could not create the lead.');
    } finally {
      setSavingLead(false);
    }
  };

  const handlePropertyChange = (e) => {
    const property = properties.find((p) => String(p.id) === String(e.target.value));
    setScheduleForm((f) => ({
      ...f,
      property_id: e.target.value,
      property_name: property?.name || '',
    }));
  };

  const handleRealtorChange = (e) => {
    const realtor = realtors.find((r) => String(r.id) === String(e.target.value));
    setScheduleForm((f) => ({
      ...f,
      realtor_id: e.target.value,
      realtor_name: realtor?.name || '',
    }));
  };

  const handleScheduleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!scheduleForm.lead_id) return setFormError('Please select a lead.');
    if (!scheduleForm.property_id) return setFormError('Please select a property.');
    if (!isRealtorUser && !scheduleForm.realtor_id) return setFormError('Please select a realtor.');
    setSaving(true);
    try {
      await createInspection({
        property_id: Number(scheduleForm.property_id),
        property_name: scheduleForm.property_name,
        lead_id: Number(scheduleForm.lead_id),
        // Ignored server-side for realtors, who are always pinned to themselves.
        realtor_name: isRealtorUser ? (currentUser?.name || '') : scheduleForm.realtor_name,
        scheduled_at: `${scheduleForm.scheduled_date}T${scheduleForm.scheduled_time}:00`,
        attendees: Math.max(Number(scheduleForm.attendees) || 1, 1),
        notes: scheduleForm.notes || null,
      });
      setScheduleForm(emptyScheduleForm);
      setShowSchedule(false);
      loadData();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to schedule inspection.');
    } finally {
      setSaving(false);
    }
  };

  const openFeedbackModal = (inspection) => {
    setSelectedInspection(inspection);
    setFeedbackForm(emptyFeedbackForm);
    setShowFeedback(true);
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!selectedInspection) return;
    await completeInspection(selectedInspection.id, {
      client_satisfaction: Number(feedbackForm.client_satisfaction),
      client_feedback: feedbackForm.client_feedback,
      realtor_notes: feedbackForm.realtor_notes,
    });
    setShowFeedback(false);
    setSelectedInspection(null);
    setFeedbackForm(emptyFeedbackForm);
    loadData();
  };

  // Errors propagate so the modal can surface them inline instead of an alert().
  const submitReview = async (notes) => {
    const action = review.decision === 'approved' ? approveInspection : rejectInspection;
    await action(review.inspection.id, { notes });
    setReview(null);
    loadData();
  };

  const renderActions = (row) => (
    <div className="flex justify-end gap-3">
      {/* Realtor-scheduled inspections wait on an administrator. */}
      {/* status and approval_status are independent — a cancelled or completed
          inspection is no longer reviewable even if it never got a decision. */}
      {canReview && row.approval_status === 'pending_approval'
        && !['cancelled', 'completed'].includes(row.status) && (
        <>
          <Button onClick={() => setReview({ inspection: row, decision: 'approved' })} variant="success" size="sm">Approve</Button>
          <Button onClick={() => setReview({ inspection: row, decision: 'rejected' })} variant="danger" size="sm">Decline</Button>
        </>
      )}
      {row.status === 'pending' && row.approval_status !== 'pending_approval' && (
        <Button onClick={() => confirmInspection(row.id).then(loadData)} variant="primary" size="sm">Confirm</Button>
      )}
      {row.status === 'confirmed' && (
        <Button onClick={() => openFeedbackModal(row)} variant="success" size="sm">Mark Completed</Button>
      )}
      {row.status !== 'cancelled' && row.status !== 'completed' && (
        <Button onClick={() => cancelInspection(row.id).then(loadData)} variant="danger" size="sm">Cancel</Button>
      )}
      <ActionsMenu items={[{ label: '👁 View Details', onClick: () => setDetailRow(row) }]} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Inspections</h1>
          <p className="text-sm text-slate-500">Schedule and track site visits for clients.</p>
        </div>
        <Button onClick={() => { setScheduleForm(emptyScheduleForm); setFormError(''); setShowSchedule(true); }}>
          + Schedule Inspection
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading inspections...</p>
      ) : (
        <Table columns={columns} data={inspections} renderActions={renderActions} />
      )}

      <InspectionReviewModal
        open={!!review}
        inspection={review?.inspection}
        decision={review?.decision}
        onClose={() => setReview(null)}
        onSubmit={submitReview}
      />

      <DetailsModal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailRow?.property_name || detailRow?.ref_number || 'Inspection Details'}
        record={detailRow}
        fields={detailFields}
      />

      {/* Schedule Modal */}
      <Modal open={showSchedule} onClose={() => setShowSchedule(false)} title="Schedule Inspection">
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{formError}</div>
          )}

          {/* Lead */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Lead<FieldMark required /></label>
            <div className="flex gap-2">
              <Select value={scheduleForm.lead_id} onChange={handleLeadChange} required className={`${SELECT_CLASS} flex-1`}>
                <option value="">Select lead...</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}{l.phone ? ` — ${l.phone}` : (l.email ? ` — ${l.email}` : '')}</option>
                ))}
              </Select>
              <Button type="button" variant="secondary" onClick={() => setShowLeadForm((open) => !open)}>
                {showLeadForm ? 'Close' : '+ New Lead'}
              </Button>
            </div>
            {!leads.length && !showLeadForm && (
              <p className="text-xs text-amber-600">
                {isRealtorUser
                  ? 'No leads created by or assigned to you yet — add one with “+ New Lead”.'
                  : 'No leads found. Add one with “+ New Lead”.'}
              </p>
            )}

            {/* Inline lead creation so a missing lead never blocks scheduling */}
            {showLeadForm && (
              <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">New Lead</p>
                <input
                  value={leadForm.name}
                  onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name *"
                  className={SELECT_CLASS}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="Email"
                    className={SELECT_CLASS}
                  />
                  <input
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone"
                    className={SELECT_CLASS}
                  />
                </div>
                <div className="flex justify-end">
                  {/* Not a nested <form> — this modal is already inside one */}
                  <Button type="button" size="sm" onClick={handleCreateLead} disabled={savingLead || !leadForm.name.trim()}>
                    {savingLead ? 'Creating…' : 'Create Lead'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Property */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Property<FieldMark required /></label>
            <Select value={scheduleForm.property_id} onChange={handlePropertyChange} required className={SELECT_CLASS}>
              <option value="">Select property...</option>
              {propertyOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </Select>
            {!properties.length && <p className="text-xs text-amber-600">No properties found. Add properties first.</p>}
          </div>

          {/* Realtor — a realtor books as themselves and cannot list other realtors */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Realtor<FieldMark required /></label>
            {isRealtorUser ? (
              <>
                <input value={currentUser?.name || 'You'} readOnly className={`${SELECT_CLASS} bg-slate-50`} />
                <p className="text-xs text-slate-500">Inspections you schedule are sent to an administrator for approval.</p>
              </>
            ) : (
              <>
                <Select value={scheduleForm.realtor_id} onChange={handleRealtorChange} required className={SELECT_CLASS}>
                  <option value="">Select realtor...</option>
                  {realtors.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}{r.email ? ` — ${r.email}` : ''}</option>
                  ))}
                </Select>
                {!realtors.length && <p className="text-xs text-amber-600">No realtors found. Add realtors first under Users.</p>}
              </>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Date<FieldMark required /></label>
              <input type="date" value={scheduleForm.scheduled_date} onChange={(e) => setScheduleForm((f) => ({ ...f, scheduled_date: e.target.value }))} required className={SELECT_CLASS} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Time<FieldMark required /></label>
              <input type="time" value={scheduleForm.scheduled_time} onChange={(e) => setScheduleForm((f) => ({ ...f, scheduled_time: e.target.value }))} required className={SELECT_CLASS} />
            </div>
          </div>

          {/* Attendees */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Number of persons attending<FieldMark /></label>
            <input
              type="number"
              min="1"
              step="1"
              value={scheduleForm.attendees}
              onChange={(e) => setScheduleForm((f) => ({ ...f, attendees: e.target.value }))}
              className={SELECT_CLASS}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Notes<FieldMark /></label>
            <textarea rows={3} value={scheduleForm.notes} onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))} className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Optional notes..." />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Schedule Inspection'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowSchedule(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Feedback Modal */}
      <Modal open={showFeedback} onClose={() => setShowFeedback(false)} title="Complete Inspection">
        <form onSubmit={submitFeedback} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Client Satisfaction<FieldMark /></label>
            <Select value={feedbackForm.client_satisfaction} onChange={(e) => setFeedbackForm((f) => ({ ...f, client_satisfaction: e.target.value }))} className={SELECT_CLASS}>
              {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v} — {['Very Poor','Poor','Fair','Good','Excellent'][v-1]}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Client Feedback<FieldMark required /></label>
            <textarea rows={3} value={feedbackForm.client_feedback} onChange={(e) => setFeedbackForm((f) => ({ ...f, client_feedback: e.target.value }))} className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" required />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Realtor Notes<FieldMark /></label>
            <textarea rows={3} value={feedbackForm.realtor_notes} onChange={(e) => setFeedbackForm((f) => ({ ...f, realtor_notes: e.target.value }))} className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit">Save Feedback</Button>
            <Button type="button" variant="secondary" onClick={() => setShowFeedback(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

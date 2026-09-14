import { useEffect, useMemo, useState } from 'react';
import {
  listLeads,
  createLead,
  updateLead,
  deleteLead,
  listSources,
  listLabels,
  listPipelines,
  listStages,
  getLeadActivities,
  logActivity,
  autoAssignLead,
  getLeadScoreDetails,
  getFollowUpSuggestion,
} from '../../api/crmApi';
import { createObjection, deleteObjection, listObjections } from '../../api/objectionApi';
import { listUsers } from '../../api/userApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import CompanySelect from '../../components/common/CompanySelect';
import ActionsMenu from '../../components/common/ActionsMenu';
import useAuthStore from '../../store/authStore';
import Select from '../../components/ui/Select';

const STATUSES = [
  { value: 'new',                  label: 'New Lead' },
  { value: 'contacted',            label: 'Contacted' },
  { value: 'follow_up',            label: 'Follow-Up' },
  { value: 'inspection_scheduled', label: 'Inspection Scheduled' },
  { value: 'negotiation',          label: 'Negotiation' },
  { value: 'closed_won',           label: 'Closed Won' },
  { value: 'closed_lost',          label: 'Closed Lost' },
];
const THERMAL_OPTIONS = ['Cold', 'Warm', 'Hot'];
const BUDGET_CATEGORIES = ['Under ₦5M', '₦5M–₦10M', '₦10M–₦20M', '₦20M–₦50M', '₦50M+'];
const PROPERTY_PROFILES = ['Land', 'Residential', 'Commercial', 'Shortlet Investment', 'Mixed Use'];
const INTENT_DRIVERS = ['Investment', 'Residential', 'Commercial', 'Resale', 'Rental Income'];
const PURCHASE_WINDOWS = ['Immediate', '1–3 Months', '3–6 Months', '6+ Months'];
const OBJECTION_TYPES = ['Lack of Funds', 'Trust Issues', 'Documentation Concerns', 'Location Concerns', 'Price Too High', 'Not Ready', 'Other'];
const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note', 'follow_up'];
const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const emptyForm = () => ({
  name: '',
  email: '',
  phone: '',
  source_id: '',
  pipeline_id: '',
  stage_id: '',
  label_id: '',
  status: 'new',
  description: '',
  assigned_to: '',
  budget_category: '',
  property_profile: '',
  intent_driver: '',
  purchase_window: '',
  lead_thermal: 'Cold',
  company_id: '',
});

const emptyActivityForm = () => ({
  type: 'call',
  description: '',
  activity_date: new Date().toISOString().slice(0, 10),
});

const emptyObjectionForm = (user) => ({
  type: 'Lack of Funds',
  description: '',
  resolution_strategy: '',
  objection_date: new Date().toISOString().slice(0, 10),
  logged_by: user?.id || '',
  logged_by_name: user?.name || '',
});

const normalizeList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const normalizeThermal = (value) => THERMAL_OPTIONS.find((item) => item.toLowerCase() === String(value || '').toLowerCase()) || 'Cold';
const normalizeActivityList = (response) => {
  if (Array.isArray(response?.data?.activities)) return response.data.activities;
  return normalizeList(response);
};
const urgencyStyles = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-700',
};
const methodIcons = { call: '📞', email: '✉️', meeting: '🤝' };

function ThermalBadge({ value }) {
  const thermal = normalizeThermal(value);
  const styles = {
    Hot: 'bg-rose-100 text-rose-700',
    Warm: 'bg-amber-100 text-amber-700',
    Cold: 'bg-sky-100 text-sky-700',
  };
  const icons = {
    Hot: '🔴',
    Warm: '🟡',
    Cold: '🔵',
  };

  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${styles[thermal]}`}>{icons[thermal]} {thermal}</span>;
}

export default function LeadsPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const [leads, setLeads] = useState([]);
  const [sources, setSources] = useState([]);
  const [labels, setLabels] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [objections, setObjections] = useState([]);
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState('');
  const [thermalFilter, setThermalFilter] = useState('all');
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [objectionLoading, setObjectionLoading] = useState(false);
  const [objectionSaving, setObjectionSaving] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activitySaving, setActivitySaving] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [showObjectionModal, setShowObjectionModal] = useState(false);
  const [showObjectionForm, setShowObjectionForm] = useState(false);
  const [showScoreDetailsModal, setShowScoreDetailsModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [detailRow, setDetailRow] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [activityLead, setActivityLead] = useState(null);
  const [objectionLead, setObjectionLead] = useState(null);
  const [scoreLead, setScoreLead] = useState(null);
  const [followUpLead, setFollowUpLead] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [activityForm, setActivityForm] = useState(emptyActivityForm());
  const [objectionForm, setObjectionForm] = useState(emptyObjectionForm(user));
  const [scoreDetails, setScoreDetails] = useState(null);
  const [followUpSuggestion, setFollowUpSuggestion] = useState(null);
  const [scoreDetailsLoading, setScoreDetailsLoading] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [autoAssigningLeadId, setAutoAssigningLeadId] = useState(null);

  const sourceMap = useMemo(
    () => Object.fromEntries(sources.map((source) => [String(source.id), source])),
    [sources]
  );
  const labelMap = useMemo(
    () => Object.fromEntries(labels.map((label) => [String(label.id), label])),
    [labels]
  );
  const pipelineMap = useMemo(
    () => Object.fromEntries(pipelines.map((pipeline) => [String(pipeline.id), pipeline])),
    [pipelines]
  );
  const stageMap = useMemo(
    () => Object.fromEntries(stages.map((stage) => [String(stage.id), stage])),
    [stages]
  );
  const userMap = useMemo(
    () => Object.fromEntries(companyUsers.map((u) => [String(u.id), u])),
    [companyUsers]
  );

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [leadsResponse, sourcesResponse, labelsResponse, pipelinesResponse, stagesResponse, usersResponse] = await Promise.all([
        listLeads({ limit: 1000 }),
        listSources({ limit: 1000 }),
        listLabels({ limit: 1000 }),
        listPipelines({ limit: 1000 }),
        listStages({ limit: 1000 }),
        listUsers({ limit: 1000 }).catch(() => ({ data: [] })),
      ]);

      setLeads(normalizeList(leadsResponse));
      setSources(normalizeList(sourcesResponse));
      setLabels(normalizeList(labelsResponse));
      setPipelines(normalizeList(pipelinesResponse));
      setStages(normalizeList(stagesResponse));
      setCompanyUsers(normalizeList(usersResponse));
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.userMessage || 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  };

  const loadObjectionData = async (leadId) => {
    setObjectionLoading(true);
    try {
      const response = await listObjections({ lead_id: leadId, limit: 1000 });
      setObjections(normalizeList(response));
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.userMessage || 'Failed to load objections.');
    } finally {
      setObjectionLoading(false);
    }
  };

  const loadActivityData = async (leadId) => {
    setActivityLoading(true);
    try {
      const response = await getLeadActivities(leadId);
      setActivities(normalizeActivityList(response));
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.userMessage || 'Failed to load activities.');
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingLead(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (lead) => {
    const stageId = lead.stage_id ?? lead.stage?.id ?? '';
    const stage = stageId ? stageMap[String(stageId)] : null;

    setEditingLead(lead);
    setForm({
      name: lead.name ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      source_id: String(lead.source_id ?? lead.source?.id ?? ''),
      pipeline_id: String(lead.pipeline_id ?? lead.pipeline?.id ?? stage?.pipeline_id ?? ''),
      stage_id: String(stageId),
      label_id: String(lead.label_id ?? lead.label?.id ?? ''),
      status: lead.status ?? 'new',
      description: lead.description ?? '',
      assigned_to: lead.assigned_to ?? '',
      budget_category: lead.budget_category ?? '',
      property_profile: lead.property_profile ?? '',
      intent_driver: lead.intent_driver ?? '',
      purchase_window: lead.purchase_window ?? '',
      lead_thermal: normalizeThermal(lead.lead_thermal),
      company_id: lead.company_id ? String(lead.company_id) : '',
    });
    setShowModal(true);
  };

  const openActivities = async (lead) => {
    setActivityLead(lead);
    setActivityForm(emptyActivityForm());
    setActivities([]);
    setShowActivitiesModal(true);
    await loadActivityData(lead.id);
  };

  const openObjections = async (lead) => {
    setObjectionLead(lead);
    setShowObjectionForm(false);
    setObjectionForm(emptyObjectionForm(user));
    setShowObjectionModal(true);
    await loadObjectionData(lead.id);
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setShowModal(false);
    setEditingLead(null);
    setForm(emptyForm());
  };

  const closeActivitiesModal = (force = false) => {
    if (activitySaving && !force) return;
    setShowActivitiesModal(false);
    setActivityLead(null);
    setActivities([]);
    setActivityForm(emptyActivityForm());
  };

  const closeObjectionModal = (force = false) => {
    if (objectionSaving && !force) return;
    setShowObjectionModal(false);
    setShowObjectionForm(false);
    setObjectionLead(null);
    setObjections([]);
    setObjectionForm(emptyObjectionForm(user));
  };

  const filteredStages = useMemo(() => {
    if (!form.pipeline_id) return stages;
    return stages.filter((stage) => String(stage.pipeline_id) === String(form.pipeline_id));
  }, [form.pipeline_id, stages]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const stage = stageMap[String(lead.stage_id ?? lead.stage?.id ?? '')];
      const source = sourceMap[String(lead.source_id ?? lead.source?.id ?? '')];
      const label = labelMap[String(lead.label_id ?? lead.label?.id ?? '')];
      const pipeline = pipelineMap[String(lead.pipeline_id ?? lead.pipeline?.id ?? stage?.pipeline_id ?? '')];
      const matchesSearch = !query || [
        lead.name,
        lead.email,
        lead.phone,
        lead.status,
        lead.assigned_to,
        lead.budget_category,
        lead.property_profile,
        lead.intent_driver,
        lead.purchase_window,
        lead.lead_thermal,
        source?.name,
        label?.name,
        stage?.name ?? lead.stage?.name,
        pipeline?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));

      const matchesThermal = thermalFilter === 'all' || normalizeThermal(lead.lead_thermal).toLowerCase() === thermalFilter;
      const pipelineId = String(lead.pipeline_id ?? lead.pipeline?.id ?? stage?.pipeline_id ?? '');
      const matchesPipeline = pipelineFilter === 'all' || pipelineId === pipelineFilter;

      return matchesSearch && matchesThermal && matchesPipeline;
    });
  }, [labelMap, leads, pipelineFilter, pipelineMap, search, sourceMap, stageMap, thermalFilter]);

  const columns = useMemo(
    () => [
      { key: 'name', label: 'Name', render: (lead) => lead.name || '—' },
      {
        key: 'lead_thermal',
        label: 'Lead Thermal',
        render: (lead) => <ThermalBadge value={lead.lead_thermal} />,
      },
      {
        key: 'status',
        label: 'Status',
        render: (lead) => {
          const found = STATUSES.find(s => s.value === lead.status);
          return <Badge value={found?.label ?? lead.status ?? '—'} />;
        },
      },
      {
        key: 'pipeline',
        label: 'Pipeline',
        render: (lead) => {
          const stage = stageMap[String(lead.stage_id ?? lead.stage?.id ?? '')];
          return pipelineMap[String(lead.pipeline_id ?? lead.pipeline?.id ?? stage?.pipeline_id ?? '')]?.name ?? lead.pipeline?.name ?? '—';
        },
      },
      {
        key: 'assigned_to',
        label: 'Assigned To',
        render: (lead) => {
          if (!lead.assigned_to) return '—';
          const u = userMap[String(lead.assigned_to)];
          return u ? `${u.name ?? u.email}` : `User #${lead.assigned_to}`;
        },
      },
    ],
    [labelMap, pipelineMap, sourceMap, stageMap, userMap]
  );

  const detailFields = useMemo(
    () => [
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Phone', key: 'phone' },
      {
        label: 'Source',
        render: (lead) => sourceMap[String(lead.source_id ?? lead.source?.id ?? '')]?.name ?? lead.source?.name ?? '—',
      },
      {
        label: 'Pipeline',
        render: (lead) => {
          const stage = stageMap[String(lead.stage_id ?? lead.stage?.id ?? '')];
          return pipelineMap[String(lead.pipeline_id ?? lead.pipeline?.id ?? stage?.pipeline_id ?? '')]?.name ?? lead.pipeline?.name ?? '—';
        },
      },
      {
        label: 'Stage',
        render: (lead) => stageMap[String(lead.stage_id ?? lead.stage?.id ?? '')]?.name ?? lead.stage?.name ?? '—',
      },
      { label: 'Lead Thermal', render: (lead) => <ThermalBadge value={lead.lead_thermal} /> },
      {
        label: 'AI Score',
        render: (lead) => {
          const score = lead.ai_score ?? 0;
          const color = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-slate-400';
          return <span className={`font-semibold ${color}`}>{score}/100</span>;
        },
      },
      {
        label: 'Status',
        render: (lead) => {
          const found = STATUSES.find((status) => status.value === lead.status);
          return <Badge value={found?.label ?? lead.status ?? '—'} />;
        },
      },
      {
        label: 'Label',
        render: (lead) => {
          const labelName = labelMap[String(lead.label_id ?? lead.label?.id ?? '')]?.name ?? lead.label?.name;
          return labelName ? <Badge value={labelName} /> : '—';
        },
      },
      {
        label: 'Assigned To',
        render: (lead) => {
          if (!lead.assigned_to) return '—';
          const user = userMap[String(lead.assigned_to)];
          return user ? `${user.name ?? user.email}` : `User #${lead.assigned_to}`;
        },
      },
      { label: 'Budget Category', key: 'budget_category' },
      { label: 'Property Profile', key: 'property_profile' },
      { label: 'Intent Driver', key: 'intent_driver' },
      { label: 'Purchase Window', key: 'purchase_window' },
      { label: 'Description', key: 'description' },
    ],
    [labelMap, pipelineMap, sourceMap, stageMap, userMap]
  );

  const buildPayload = () => ({
    name: form.name.trim(),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    source_id: form.source_id || null,
    pipeline_id: form.pipeline_id || null,
    stage_id: form.stage_id || null,
    label_id: form.label_id || null,
    status: form.status,
    description: form.description.trim() || null,
    assigned_to: form.assigned_to || null,
    budget_category: form.budget_category || null,
    property_profile: form.property_profile || null,
    intent_driver: form.intent_driver || null,
    purchase_window: form.purchase_window || null,
    lead_thermal: normalizeThermal(form.lead_thermal),
    ...(form.company_id ? { company_id: Number(form.company_id) } : {}),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    setError('');

    try {
      const payload = buildPayload();
      if (editingLead) {
        await updateLead(editingLead.id, payload);
      } else {
        await createLead(payload);
      }
      closeModal(true);
      await loadData();
    } catch (submitError) {
      console.error(submitError);
      setError(`Failed to ${editingLead ? 'update' : 'create'} lead. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lead) => {
    if (!window.confirm(`Delete lead \"${lead.name || 'this lead'}\"?`)) return;

    try {
      await deleteLead(lead.id);
      await loadData();
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError.userMessage || 'Failed to delete lead.');
    }
  };


  const handleAutoAssign = async (lead) => {
    setAutoAssigningLeadId(lead.id);
    setError('');

    try {
      await autoAssignLead(lead.id);
      await loadData();
    } catch (assignError) {
      console.error(assignError);
      setError(assignError.userMessage || 'Failed to auto-assign lead.');
    } finally {
      setAutoAssigningLeadId(null);
    }
  };

  const openScoreDetails = async (lead) => {
    setShowScoreDetailsModal(true);
    setScoreLead(lead);
    setScoreDetails(null);
    setScoreDetailsLoading(true);
    setError('');

    try {
      const response = await getLeadScoreDetails(lead.id);
      setScoreDetails(response?.data || null);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.userMessage || 'Failed to load score details.');
      setShowScoreDetailsModal(false);
      setScoreLead(null);
    } finally {
      setScoreDetailsLoading(false);
    }
  };

  const openFollowUpSuggestion = async (lead) => {
    setShowFollowUpModal(true);
    setFollowUpLead(lead);
    setFollowUpSuggestion(null);
    setFollowUpLoading(true);
    setError('');

    try {
      const response = await getFollowUpSuggestion(lead.id);
      setFollowUpSuggestion(response?.data || null);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.userMessage || 'Failed to load follow-up suggestion.');
      setShowFollowUpModal(false);
      setFollowUpLead(null);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const copyFollowUpScript = async () => {
    if (!followUpSuggestion?.suggestion?.script || !navigator?.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(followUpSuggestion.suggestion.script);
    } catch (copyError) {
      console.error(copyError);
      setError('Failed to copy script.');
    }
  };

  const handleActivitySubmit = async (event) => {
    event.preventDefault();
    if (!activityLead || !activityForm.description.trim()) return;

    setActivitySaving(true);
    setError('');

    try {
      await logActivity({
        lead_id: activityLead.id,
        type: activityForm.type,
        description: activityForm.description.trim(),
        activity_date: activityForm.activity_date,
      });
      setActivityForm(emptyActivityForm());
      await loadActivityData(activityLead.id);
    } catch (submitError) {
      console.error(submitError);
      setError(submitError.userMessage || 'Failed to log activity.');
    } finally {
      setActivitySaving(false);
    }
  };

  const handleObjectionSubmit = async (event) => {
    event.preventDefault();
    if (!objectionLead || !objectionForm.description.trim()) return;

    setObjectionSaving(true);
    setError('');

    try {
      await createObjection({
        lead_id: objectionLead.id,
        type: objectionForm.type,
        description: objectionForm.description.trim(),
        resolution_strategy: objectionForm.resolution_strategy.trim() || null,
        objection_date: objectionForm.objection_date,
        logged_by: user?.id || null,
        logged_by_name: user?.name || objectionForm.logged_by_name || 'System',
      });
      setObjectionForm(emptyObjectionForm(user));
      setShowObjectionForm(false);
      await loadObjectionData(objectionLead.id);
    } catch (submitError) {
      console.error(submitError);
      setError(submitError.userMessage || 'Failed to save objection.');
    } finally {
      setObjectionSaving(false);
    }
  };

  const handleDeleteObjection = async (objection) => {
    if (!window.confirm('Delete this objection log?')) return;

    try {
      await deleteObjection(objection.id);
      if (objectionLead) await loadObjectionData(objectionLead.id);
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError.userMessage || 'Failed to delete objection.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-slate-500">Track qualification signals, pipeline movement, and objections.</p>
        </div>
        <Button onClick={openCreate}>+ Add Lead</Button>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_13rem_13rem]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, phone, thermal, source, stage..."
            className={INPUT_CLASS}
          />
          <Select value={thermalFilter} onChange={(event) => setThermalFilter(event.target.value)} className={INPUT_CLASS}>
            <option value="all">All Thermal</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </Select>
          <Select value={pipelineFilter} onChange={(event) => setPipelineFilter(event.target.value)} className={INPUT_CLASS}>
            <option value="all">All Pipelines</option>
            {pipelines.map((pipeline) => (
              <option key={pipeline.id} value={String(pipeline.id)}>
                {pipeline.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading leads...</p>
      ) : (
        <Table
        searchable={false}
          columns={columns}
          data={filteredLeads}
          renderActions={(row) => (
            <div className="flex items-center justify-end gap-2">
              <Button onClick={() => openEdit(row)} variant="primary" size="sm">Edit</Button>
              <ActionsMenu
                items={[
                  { label: '👁 View Details', onClick: () => setDetailRow(row) },
                  { label: '📊 Score Details', onClick: () => openScoreDetails(row) },
                  ...(!row.assigned_to ? [{
                    label: autoAssigningLeadId === row.id ? '⏳ Assigning…' : '🎯 Auto Assign',
                    disabled: autoAssigningLeadId === row.id,
                    onClick: () => handleAutoAssign(row),
                  }] : []),
                  { label: '💡 Follow-Up Suggestion', onClick: () => openFollowUpSuggestion(row) },
                  { label: '📋 Activities', onClick: () => openActivities(row) },
                  { label: '💬 Objections', onClick: () => openObjections(row) },
                  { label: '🗑 Delete', variant: 'danger', onClick: () => handleDelete(row) },
                ]}
              />
            </div>
          )}
        />
      )}

      <DetailsModal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailRow?.name || 'Lead Details'}
        record={detailRow}
        fields={detailFields}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{editingLead ? 'Edit Lead' : 'Create Lead'}</h2>
                <p className="text-sm text-slate-500">Manage lead details, qualification profile, assignment, and pipeline stage.</p>
              </div>
              <button type="button" onClick={closeModal} className="text-slate-400 transition hover:text-slate-600" aria-label="Close modal">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-5">
              {!editingLead && isSuperiorAdmin && (
                <CompanySelect value={form.company_id} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))} />
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="xl:col-span-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                  <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                  <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                  <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className={INPUT_CLASS} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Source</label>
                  <Select value={form.source_id} onChange={(event) => setForm((current) => ({ ...current, source_id: event.target.value }))} className={INPUT_CLASS}>
                    <option value="">Select source</option>
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>{source.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Label</label>
                  <Select value={form.label_id} onChange={(event) => setForm((current) => ({ ...current, label_id: event.target.value }))} className={INPUT_CLASS}>
                    <option value="">Select label</option>
                    {labels.map((label) => (
                      <option key={label.id} value={label.id}>{label.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Pipeline</label>
                  <Select
                    value={form.pipeline_id}
                    onChange={(event) => setForm((current) => ({ ...current, pipeline_id: event.target.value, stage_id: '' }))}
                    className={INPUT_CLASS}
                  >
                    <option value="">Select pipeline</option>
                    {pipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Stage</label>
                  <Select value={form.stage_id} onChange={(event) => setForm((current) => ({ ...current, stage_id: event.target.value }))} className={INPUT_CLASS}>
                    <option value="">Select stage</option>
                    {filteredStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>{stage.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={INPUT_CLASS}>
                    {STATUSES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Assigned To</label>
                  <Select value={form.assigned_to} onChange={(event) => setForm((current) => ({ ...current, assigned_to: event.target.value }))} className={INPUT_CLASS}>
                    <option value="">— Unassigned —</option>
                    {companyUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name ?? u.email} {u.role ? `(${u.role})` : ''}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Lead Thermal</label>
                  <Select value={form.lead_thermal} onChange={(event) => setForm((current) => ({ ...current, lead_thermal: event.target.value }))} className={INPUT_CLASS}>
                    {THERMAL_OPTIONS.map((thermal) => (
                      <option key={thermal} value={thermal}>{thermal}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Lead Qualification</h3>
                  <p className="text-sm text-slate-500">Capture buying power, intent, and urgency.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Budget Category</label>
                    <Select value={form.budget_category} onChange={(event) => setForm((current) => ({ ...current, budget_category: event.target.value }))} className={INPUT_CLASS}>
                      <option value="">Select budget category</option>
                      {BUDGET_CATEGORIES.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Property Profile</label>
                    <Select value={form.property_profile} onChange={(event) => setForm((current) => ({ ...current, property_profile: event.target.value }))} className={INPUT_CLASS}>
                      <option value="">Select property profile</option>
                      {PROPERTY_PROFILES.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Intent Driver</label>
                    <Select value={form.intent_driver} onChange={(event) => setForm((current) => ({ ...current, intent_driver: event.target.value }))} className={INPUT_CLASS}>
                      <option value="">Select intent driver</option>
                      {INTENT_DRIVERS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Purchase Window</label>
                    <Select value={form.purchase_window} onChange={(event) => setForm((current) => ({ ...current, purchase_window: event.target.value }))} className={INPUT_CLASS}>
                      <option value="">Select purchase window</option>
                      {PURCHASE_WINDOWS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={`${INPUT_CLASS} min-h-28`} />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingLead ? 'Save Changes' : 'Create Lead'}</Button>
                <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal open={showActivitiesModal} onClose={() => closeActivitiesModal()} title={activityLead ? `Lead Activities — ${activityLead.name}` : 'Lead Activities'} size="lg">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Activity History</h3>
            <div className="mt-3 space-y-3">
              {activityLoading ? (
                <p className="text-sm text-slate-500">Loading activities...</p>
              ) : activities.length ? (
                activities.map((activity) => (
                  <div key={activity.id} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{activity.activity_date ? new Date(activity.activity_date).toLocaleDateString() : '—'}</span>
                      <span>•</span>
                      <span className="font-semibold uppercase text-slate-700">{activity.type || 'note'}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{activity.description || '—'}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No activities logged for this lead yet.</p>
              )}
            </div>
          </div>

          <form onSubmit={handleActivitySubmit} className="space-y-4 rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Log New Activity</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Type</span>
                <Select
                  value={activityForm.type}
                  onChange={(event) => setActivityForm((current) => ({ ...current, type: event.target.value }))}
                  className={INPUT_CLASS}
                >
                  {ACTIVITY_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Date</span>
                <input
                  type="date"
                  value={activityForm.activity_date}
                  onChange={(event) => setActivityForm((current) => ({ ...current, activity_date: event.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                rows={4}
                value={activityForm.description}
                onChange={(event) => setActivityForm((current) => ({ ...current, description: event.target.value }))}
                className={`${INPUT_CLASS} min-h-28`}
                required
              />
            </label>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={activitySaving}>{activitySaving ? 'Saving…' : 'Log Activity'}</Button>
              <Button type="button" variant="secondary" onClick={() => closeActivitiesModal()} disabled={activitySaving}>Close</Button>
            </div>
          </form>
        </div>
      </Modal>


      <Modal open={showScoreDetailsModal} onClose={() => { setShowScoreDetailsModal(false); setScoreLead(null); setScoreDetails(null); }} title={scoreLead ? `Lead Score Details — ${scoreLead.name}` : 'Lead Score Details'} size="md">
        {scoreDetailsLoading ? (
          <p className="text-sm text-slate-500">Loading score breakdown...</p>
        ) : scoreDetails ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm text-slate-500">Current AI Score</div>
              <div className="mt-1 text-3xl font-semibold" style={{ color: 'var(--primary)' }}>{scoreDetails.ai_score}/100</div>
            </div>
            <div className="space-y-3">
              {[
                ['Thermal', scoreDetails.breakdown?.thermal?.value || '—', scoreDetails.breakdown?.thermal?.contribution || 0],
                ['Budget', scoreDetails.breakdown?.budget?.value || '—', scoreDetails.breakdown?.budget?.contribution || 0],
                ['Purchase Window', scoreDetails.breakdown?.purchase_window?.value || '—', scoreDetails.breakdown?.purchase_window?.contribution || 0],
                ['Intent Driver', scoreDetails.breakdown?.intent_driver?.value || '—', scoreDetails.breakdown?.intent_driver?.contribution || 0],
                ['Property Profile', scoreDetails.breakdown?.property_profile?.value || '—', scoreDetails.breakdown?.property_profile?.contribution || 0],
                ['Email', scoreDetails.breakdown?.email?.value || '—', scoreDetails.breakdown?.email?.contribution || 0],
              ].map(([label, value, contribution]) => (
                <div key={label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{label}</div>
                      <div className="text-sm text-slate-500">{value}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">+{contribution}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Activity Signals</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm text-slate-600">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Activities</div>
                  <div className="mt-1 font-semibold text-slate-900">{scoreDetails.breakdown?.activity_engagement?.count ?? 0}</div>
                  <div className="text-xs text-slate-500">+{scoreDetails.breakdown?.activity_engagement?.contribution || 0} points</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Days Since Contact</div>
                  <div className="mt-1 font-semibold text-slate-900">{scoreDetails.breakdown?.recency?.days_since_contact ?? '—'}</div>
                  <div className="text-xs text-slate-500">{scoreDetails.breakdown?.recency?.contribution || 0} points</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Stage Velocity</div>
                  <div className="mt-1 font-semibold text-slate-900">{scoreDetails.breakdown?.stage_velocity?.days ?? '—'} days</div>
                  <div className="text-xs text-slate-500">{scoreDetails.breakdown?.stage_velocity?.contribution || 0} points</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No score details available.</p>
        )}
      </Modal>

      <Modal open={showFollowUpModal} onClose={() => { setShowFollowUpModal(false); setFollowUpLead(null); setFollowUpSuggestion(null); }} title={followUpLead ? `Follow-Up Suggestion — ${followUpLead.name}` : 'Follow-Up Suggestion'} size="lg">
        {followUpLoading ? (
          <p className="text-sm text-slate-500">Generating follow-up suggestion...</p>
        ) : followUpSuggestion ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Urgency</div>
                <div className="mt-2"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${urgencyStyles[followUpSuggestion.suggestion?.urgency] || urgencyStyles.low}`}>{followUpSuggestion.suggestion?.urgency || 'low'}</span></div>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Follow up in</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{followUpSuggestion.suggestion?.follow_up_in || '—'}</div>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Preferred method</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{methodIcons[followUpSuggestion.suggestion?.preferred_method] || '📞'} {followUpSuggestion.suggestion?.preferred_method || 'call'}</div>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Optimal time</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{followUpSuggestion.suggestion?.optimal_time || '—'}</div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Suggested Script</h3>
                <Button type="button" variant="secondary" size="sm" onClick={copyFollowUpScript}>Copy</Button>
              </div>
              <textarea readOnly value={followUpSuggestion.suggestion?.script || ''} className={`${INPUT_CLASS} mt-3 min-h-32 bg-slate-50`} />
            </div>

            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Reason</h3>
              <p className="mt-2 text-sm text-slate-600">{followUpSuggestion.suggestion?.reason || '—'}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No follow-up suggestion available.</p>
        )}
      </Modal>

      {showObjectionModal && objectionLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Objection Log</h2>
                <p className="text-sm text-slate-500">Track and resolve buyer concerns for {objectionLead.name}.</p>
              </div>
              <button type="button" onClick={closeObjectionModal} className="text-slate-400 transition hover:text-slate-600" aria-label="Close objection modal">
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Lead Thermal: <span className="ml-1 align-middle"><ThermalBadge value={objectionLead.lead_thermal} /></span>
              </div>
              <Button type="button" variant={showObjectionForm ? 'secondary' : 'primary'} onClick={() => setShowObjectionForm((current) => !current)}>
                {showObjectionForm ? 'Hide Form' : 'Log Objection'}
              </Button>
            </div>

            {showObjectionForm && (
              <form onSubmit={handleObjectionSubmit} className="mt-4 space-y-4 rounded-xl border border-slate-200 p-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="xl:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Objection Type</label>
                    <Select value={objectionForm.type} onChange={(event) => setObjectionForm((current) => ({ ...current, type: event.target.value }))} className={INPUT_CLASS}>
                      {OBJECTION_TYPES.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                    <input type="date" value={objectionForm.objection_date} onChange={(event) => setObjectionForm((current) => ({ ...current, objection_date: event.target.value }))} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Logged By</label>
                    <input value={user?.name || objectionForm.logged_by_name || 'System'} disabled className={`${INPUT_CLASS} bg-slate-50 text-slate-500`} />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                    <textarea required value={objectionForm.description} onChange={(event) => setObjectionForm((current) => ({ ...current, description: event.target.value }))} className={`${INPUT_CLASS} min-h-28`} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Resolution Strategy</label>
                    <textarea value={objectionForm.resolution_strategy} onChange={(event) => setObjectionForm((current) => ({ ...current, resolution_strategy: event.target.value }))} className={`${INPUT_CLASS} min-h-28`} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={objectionSaving}>{objectionSaving ? 'Saving…' : 'Save Objection'}</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowObjectionForm(false)} disabled={objectionSaving}>Cancel</Button>
                </div>
              </form>
            )}

            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
              {/* Scrolls inside its own box rather than widening the page on a phone. */}
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Resolution</th>
                    <th className="px-4 py-3 font-medium">Logged By</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {objectionLoading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading objections...</td>
                    </tr>
                  )}
                  {!objectionLoading && objections.map((objection) => (
                    <tr key={objection.id}>
                      <td className="px-4 py-3 text-slate-600">{objection.objection_date ? new Date(objection.objection_date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-slate-900">{objection.type}</td>
                      <td className="max-w-xs px-4 py-3 text-slate-700">{objection.description || '—'}</td>
                      <td className="max-w-xs px-4 py-3 text-slate-700">{objection.resolution_strategy || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{objection.logged_by_name || 'System'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button onClick={() => handleDeleteObjection(objection)} variant="danger" size="sm">Delete</Button>
                      </td>
                    </tr>
                  ))}
                  {!objectionLoading && !objections.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No objections logged for this lead.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

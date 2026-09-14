import { useCallback, useEffect, useState } from 'react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/common/Badge';
import CommissionPlanEditor, { BLANK_CONFIG } from '../../components/finance/CommissionPlanEditor';
import {
  listCommissionPlans, getCommissionPlan, createCommissionPlan,
  createPlanVersion, activatePlanVersion, archiveCommissionPlan,
  assignCommissionPlan,
} from '../../api/commissionApi';
import { listProperties, listPropertyUnits } from '../../api/propertyApi';
import Select from '../../components/ui/Select';

/**
 * Commission plans — the configuration that decides what a sale pays.
 *
 * ── Draft, then activate, and never edit what is live ───────────────────────
 *
 * An active version is immutable, because a deal resolves the version in force
 * at its ATTRIBUTION date. Editing one would restate what deals already paid,
 * months after the fact, to people who have already been paid. So "edit" on a
 * live plan opens its configuration as a NEW DRAFT version, and activating that
 * closes the previous one at the moment the new begins. The version list is the
 * history, and it is the only honest answer to "what were we paying in March".
 *
 * ── Why a company with no plan is not broken ────────────────────────────────
 *
 * Until a plan is activated, commission is paid the older way: a flat rate from
 * the commission-rules table. Activating the first plan is what moves a company
 * onto the engine, and archiving it moves them back. That is why this screen
 * says so plainly rather than presenting an empty table as a problem.
 */

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

const STATUS_TONE = {
  active: 'bg-success-surface text-success',
  draft: 'bg-warning-surface text-warning',
  archived: 'bg-surface-sunken text-content-muted',
};

export default function CommissionPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState(null);

  // The plan being edited, its loaded detail, and the draft config on screen.
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [config, setConfig] = useState(BLANK_CONFIG);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * Assignment: the plan being pointed at something, and the inventory to
   * choose from. A plan that is assigned to nothing pays nothing — it is not
   * reached by any sale — so this is the step between writing a plan and it
   * having any effect.
   */
  const [assigning, setAssigning] = useState(null);
  const [scopeType, setScopeType] = useState('property');
  const [scopeId, setScopeId] = useState('');
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      setPlans(await listCommissionPlans());
    } catch (error) {
      setPlans([]);
      setFailed(error?.userMessage || 'Commission plans could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The inventory a plan can be pointed at. Loaded once, not per dialog.
  useEffect(() => {
    listProperties({ limit: 200 })
      .then((res) => setProperties(res?.data ?? res ?? []))
      .catch(() => setProperties([]));
  }, []);

  // Units are fetched for the chosen property only: a company's whole unit
  // list can run to thousands, and all but one property's are irrelevant here.
  useEffect(() => {
    if (scopeType !== 'unit' || !assigning) { setUnits([]); return; }
    listPropertyUnits({ limit: 500 })
      .then((res) => setUnits(res?.data ?? res ?? []))
      .catch(() => setUnits([]));
  }, [scopeType, assigning]);

  const openAssign = (plan) => {
    setAssigning(plan);
    setScopeType(plan.is_default ? 'company' : (plan.scope_type || 'property'));
    setScopeId(plan.scope_id ? String(plan.scope_id) : '');
  };

  const saveAssignment = async () => {
    setSaving(true);
    try {
      await assignCommissionPlan(assigning.id, scopeType === 'company'
        ? { scope_type: null, is_default: true }
        : { scope_type: scopeType, scope_id: Number(scopeId) });
      setAssigning(null);
      await load();
      setFailed('');
    } catch (error) {
      setFailed(error?.response?.data?.message || 'That assignment could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => {
    setDetail(null);
    setName('');
    setConfig(BLANK_CONFIG);
    setEditing({ isNew: true });
  };

  const openExisting = async (row) => {
    setEditing({ id: row.id });
    setDetail(null);
    try {
      const loaded = await getCommissionPlan(row.id);
      setDetail(loaded);
      setName(loaded.name || '');
      /**
       * Opened from the LIVE version where there is one, otherwise the newest.
       *
       * Editing starts from what is actually paying rather than from whatever
       * draft was last abandoned — a half-finished experiment is the wrong
       * starting point for a change to a live structure.
       */
      const live = loaded.versions?.find((version) => version.status === 'active');
      setConfig((live || loaded.versions?.[0])?.config || BLANK_CONFIG);
    } catch (error) {
      setFailed(error?.userMessage || 'That plan could not be opened.');
      setEditing(null);
    }
  };

  const close = () => { setEditing(null); setDetail(null); setMessage(null); };

  const save = async () => {
    if (!name.trim()) { setMessage({ tone: 'error', text: 'Give the plan a name.' }); return; }
    setSaving(true);
    setMessage(null);
    try {
      if (editing.isNew) {
        const created = await createCommissionPlan({ name: name.trim(), config, is_default: plans.length === 0 });
        setMessage({ tone: 'ok', text: created.message });
        await load();
        await openExisting({ id: created.data.id });
      } else {
        const version = await createPlanVersion(editing.id, { config });
        setMessage({
          tone: 'ok',
          text: `Saved as draft version ${version.data.version}. Activate it when you are ready for it to start paying.`,
        });
        await openExisting({ id: editing.id });
        await load();
      }
    } catch (error) {
      setMessage({ tone: 'error', text: error?.response?.data?.message || error?.userMessage || 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  const activate = async (versionId) => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await activatePlanVersion(versionId, {});
      setMessage({ tone: 'ok', text: result.message });
      await openExisting({ id: editing.id });
      await load();
    } catch (error) {
      const payload = error?.response?.data;
      setMessage({
        tone: 'error',
        text: payload?.blocking?.length
          ? `${payload.message} ${payload.blocking.map((f) => f.message).join(' ')}`
          : payload?.message || 'Could not activate this version.',
      });
    } finally {
      setSaving(false);
    }
  };

  const archive = async (row) => {
    if (!window.confirm(
      `Archive "${row.name}"? Deals already computed under it are unchanged, but new deals will `
      + 'fall back to the flat commission rate.',
    )) return;
    await archiveCommissionPlan(row.id);
    await load();
  };

  const columns = [
    { header: 'Plan', accessor: 'name', render: (row) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-900">
          {row.name}
          {/*
            Only a platform admin sees plans from more than one company, and
            only then is the owner worth the space. A company admin's list is
            all their own, where the label would be noise on every row.
          */}
          {row.company_name && (
            <span className="ml-2 text-xs font-normal text-slate-400">{row.company_name}</span>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {row.is_default
            ? 'Company default — applies to every sale with no closer match'
            : row.scope_type
              ? `Assigned to ${row.scope_type} #${row.scope_id}`
              : 'Not assigned — assign it to a property or unit before it can pay'}
        </div>
      </div>
    ) },
    { header: 'Status', accessor: 'status', render: (row) => (
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[row.status] || ''}`}>
        {row.status}
      </span>
    ) },
    { header: 'Live version', accessor: 'live_version', render: (row) => (row.live_version
      ? `v${row.live_version}`
      : <span className="text-slate-400">none — not paying</span>) },
    { header: 'Versions', accessor: 'version_count' },
    { header: 'Created', accessor: 'created_at', render: (row) => formatDate(row.created_at) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Commission Plans</h1>
          <p className="text-sm text-slate-500">
            What a sale pays, and to whom. A plan only starts paying once a version is activated —
            until then commission follows the flat rate in Commission Rules.
          </p>
        </div>
        <Button onClick={openNew}>+ New Plan</Button>
      </div>

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}

      <Table
        columns={columns}
        data={plans}
        loading={loading}
        exportName="commission-plans"
        emptyMessage="No commission plans yet. Until one is activated, commission is paid at the flat rate from Commission Rules."
        renderActions={(row) => (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => openExisting(row)}>Open</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => openAssign(row)}>Assign</Button>
            {row.status !== 'archived' && (
              <Button type="button" variant="danger" size="sm" onClick={() => archive(row)}>Archive</Button>
            )}
          </div>
        )}
      />

      <Modal
        open={assigning !== null}
        onClose={() => !saving && setAssigning(null)}
        title={assigning ? `Where does "${assigning.name}" apply?` : ''}
        size="sm"
      >
        {assigning && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-500">
              A sale uses the closest match: a plan on the unit beats one on the property, which
              beats the company default. A plan assigned to nothing is never reached.
            </p>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Applies to</span>
              <Select value={scopeType} onChange={(e) => { setScopeType(e.target.value); setScopeId(''); }}>
                <option value="unit">One unit</option>
                <option value="property">A whole property</option>
                <option value="company">Every sale — company default</option>
              </Select>
            </label>

            {scopeType === 'property' && (
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Property</span>
                <Select value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                  <option value="">Choose a property…</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </label>
            )}

            {scopeType === 'unit' && (
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Unit</span>
                <Select value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                  <option value="">Choose a unit…</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label || u.unit_label || `Unit ${u.id}`}
                      {u.property_name ? ` — ${u.property_name}` : ''}
                    </option>
                  ))}
                </Select>
              </label>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setAssigning(null)} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={saveAssignment}
                disabled={saving || (scopeType !== 'company' && !scopeId)}
              >
                {saving ? 'Saving…' : 'Save assignment'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={editing !== null}
        onClose={close}
        size="full"
        title={editing?.isNew ? 'New commission plan' : detail?.name || 'Commission plan'}
      >
        <div className="space-y-4">
          {message && (
            <div className={`rounded-lg px-4 py-2 text-sm ${
              message.tone === 'error' ? 'bg-danger-surface text-danger' : 'bg-success-surface text-success'}`}>
              {message.text}
            </div>
          )}

          <Input label="Plan name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard realtor plan 2026" />

          <CommissionPlanEditor config={config} onChange={setConfig} />

          {detail?.versions?.length > 0 && (
            <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <h3 className="mb-1 text-sm font-semibold text-slate-900">Versions</h3>
              <p className="mb-3 text-xs text-slate-500">
                A deal is always paid by the version in force on the day it was attributed, so these
                are never edited — changing a plan adds a new one.
              </p>
              <div className="space-y-2">
                {detail.versions.map((version) => (
                  <div key={version.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-sm">
                      <span className="font-semibold text-slate-900">v{version.version}</span>
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[version.status] || ''}`}>
                        {version.status}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        from {formatDate(version.effective_from)}
                        {version.effective_to ? ` until ${formatDate(version.effective_to)}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="secondary" size="sm"
                        onClick={() => setConfig(version.config || BLANK_CONFIG)}>
                        Load
                      </Button>
                      {version.status === 'draft' && (
                        <Button type="button" size="sm" disabled={saving}
                          onClick={() => activate(version.id)}>
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={close} disabled={saving}>Close</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing?.isNew ? 'Create as draft' : 'Save as new draft version'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

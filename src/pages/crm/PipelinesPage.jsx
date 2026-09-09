import { useEffect, useMemo, useState } from 'react';
import {
  listPipelines,
  createPipeline,
  deletePipeline,
  listStages,
  createStage,
  updateStage,
  deleteStage,
  listLeadStages,
  createLeadStage,
  deleteLeadStage,
} from '../../api/crmApi';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const normalizeList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const emptyStageForm = (pipelineId = '') => ({
  name: '',
  pipeline_id: pipelineId ? String(pipelineId) : '',
  color: '#2563eb',
});

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [leadStages, setLeadStages] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPipeline, setSavingPipeline] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [savingLeadStage, setSavingLeadStage] = useState(false);
  const [error, setError] = useState('');
  const [leadStageError, setLeadStageError] = useState('');
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showLeadStageModal, setShowLeadStageModal] = useState(false);
  const [pipelineName, setPipelineName] = useState('');
  const [leadStageName, setLeadStageName] = useState('');
  const [editingStage, setEditingStage] = useState(null);
  const [stageForm, setStageForm] = useState(emptyStageForm());

  const loadData = async (preferredPipelineId) => {
    setLoading(true);
    setError('');
    setLeadStageError('');

    try {
      const [pipelineResponse, stageResponse, leadStageResponse] = await Promise.all([
        listPipelines(),
        listStages(),
        listLeadStages(),
      ]);
      const pipelineRows = normalizeList(pipelineResponse);
      const stageRows = normalizeList(stageResponse);
      const leadStageRows = normalizeList(leadStageResponse);

      setPipelines(pipelineRows);
      setStages(stageRows);
      setLeadStages(leadStageRows);

      setSelectedPipelineId((current) => {
        const requested = preferredPipelineId ? String(preferredPipelineId) : '';
        const active = requested || current;
        if (active && pipelineRows.some((pipeline) => String(pipeline.id) === active)) return active;
        return pipelineRows[0] ? String(pipelineRows[0].id) : '';
      });
    } catch (loadError) {
      console.error(loadError);
      setPipelines([]);
      setStages([]);
      setLeadStages([]);
      setSelectedPipelineId('');
      setError(loadError.userMessage || 'Failed to load pipelines.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedPipeline = useMemo(
    () => pipelines.find((pipeline) => String(pipeline.id) === String(selectedPipelineId)) || null,
    [pipelines, selectedPipelineId]
  );

  const filteredStages = useMemo(() => {
    if (!selectedPipeline) return [];
    return stages.filter((stage) => String(stage.pipeline_id) === String(selectedPipeline.id));
  }, [selectedPipeline, stages]);

  const openCreatePipeline = () => {
    setPipelineName('');
    setShowPipelineModal(true);
  };

  const closePipelineModal = (force = false) => {
    if (savingPipeline && !force) return;
    setShowPipelineModal(false);
    setPipelineName('');
  };

  const handleCreatePipeline = async (event) => {
    event.preventDefault();
    if (!pipelineName.trim()) return;

    setSavingPipeline(true);
    setError('');

    try {
      const response = await createPipeline({ name: pipelineName.trim() });
      const createdId = response?.data?.id ?? response?.id;
      closePipelineModal(true);
      await loadData(createdId);
    } catch (createError) {
      console.error(createError);
      setError(createError.userMessage || 'Failed to create pipeline.');
    } finally {
      setSavingPipeline(false);
    }
  };

  const handleDeletePipeline = async (pipeline) => {
    if (!window.confirm(`Delete pipeline "${pipeline.name}"?`)) return;

    setError('');

    try {
      await deletePipeline(pipeline.id);
      await loadData(String(selectedPipelineId) === String(pipeline.id) ? '' : selectedPipelineId);
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError.userMessage || 'Failed to delete pipeline.');
    }
  };

  const openCreateStage = () => {
    if (!selectedPipeline) return;
    setEditingStage(null);
    setStageForm(emptyStageForm(selectedPipeline.id));
    setShowStageModal(true);
  };

  const openEditStage = (stage) => {
    setEditingStage(stage);
    setStageForm({
      name: stage.name ?? '',
      pipeline_id: String(stage.pipeline_id ?? selectedPipeline?.id ?? ''),
      color: stage.color || '#2563eb',
    });
    setShowStageModal(true);
  };

  const closeStageModal = (force = false) => {
    if (savingStage && !force) return;
    setShowStageModal(false);
    setEditingStage(null);
    setStageForm(emptyStageForm(selectedPipeline?.id));
  };

  const handleSaveStage = async (event) => {
    event.preventDefault();
    if (!stageForm.name.trim() || !selectedPipeline) return;

    setSavingStage(true);
    setError('');

    const payload = {
      name: stageForm.name.trim(),
      pipeline_id: parseInt(stageForm.pipeline_id || selectedPipeline.id, 10),
      color: stageForm.color || '#2563eb',
    };

    try {
      if (editingStage) {
        await updateStage(editingStage.id, payload);
      } else {
        await createStage(payload);
      }
      closeStageModal(true);
      await loadData(selectedPipeline.id);
    } catch (stageError) {
      console.error(stageError);
      setError(`Failed to ${editingStage ? 'update' : 'create'} stage. Please try again.`);
    } finally {
      setSavingStage(false);
    }
  };

  const handleDeleteStage = async (stage) => {
    if (!window.confirm(`Delete stage "${stage.name}"?`)) return;

    setError('');

    try {
      await deleteStage(stage.id);
      await loadData(selectedPipeline?.id);
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError.userMessage || 'Failed to delete stage.');
    }
  };

  const closeLeadStageModal = (force = false) => {
    if (savingLeadStage && !force) return;
    setShowLeadStageModal(false);
    setLeadStageName('');
  };

  const handleCreateLeadStage = async (event) => {
    event.preventDefault();
    if (!leadStageName.trim()) return;

    setSavingLeadStage(true);
    setLeadStageError('');

    try {
      await createLeadStage({ name: leadStageName.trim() });
      closeLeadStageModal(true);
      await loadData(selectedPipeline?.id);
    } catch (createError) {
      console.error(createError);
      setLeadStageError(createError.userMessage || 'Failed to create lead stage.');
    } finally {
      setSavingLeadStage(false);
    }
  };

  const handleDeleteLeadStage = async (stage) => {
    if (!window.confirm(`Delete custom lead stage "${stage.name}"?`)) return;

    setLeadStageError('');

    try {
      await deleteLeadStage(stage.id);
      await loadData(selectedPipeline?.id);
    } catch (deleteError) {
      console.error(deleteError);
      setLeadStageError(deleteError.userMessage || 'Failed to delete lead stage.');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">Pipelines</h1>
            <p className="text-xs text-slate-500">Manage sales pipelines.</p>
          </div>
          <Button onClick={openCreatePipeline} className="px-3 py-2 text-xs">+ Add Pipeline</Button>
        </div>

        <div className="space-y-2">
          {pipelines.map((pipeline) => {
            const isActive = String(pipeline.id) === String(selectedPipelineId);
            const count = stages.filter((stage) => String(stage.pipeline_id) === String(pipeline.id)).length;

            return (
              <div
                key={pipeline.id}
                className={`flex items-center gap-2 rounded-lg border p-3 ${isActive ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'}`}
              >
                <Button
                  onClick={() => setSelectedPipelineId(String(pipeline.id))}
                  variant={isActive ? 'primary' : 'secondary'}
                  size="sm"
                  className="min-w-0 flex-1 justify-start text-left"
                >
                  <div className="truncate text-sm font-medium text-slate-900">{pipeline.name}</div>
                  <div className="text-xs text-slate-500">{count} stage{count === 1 ? '' : 's'}</div>
                </Button>
                <Button
                  onClick={() => handleDeletePipeline(pipeline)}
                  variant="danger"
                  size="sm"
                  aria-label={`Delete ${pipeline.name}`}
                >
                  Delete
                </Button>
              </div>
            );
          })}

          {!loading && !pipelines.length && (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              No pipelines yet.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{selectedPipeline ? selectedPipeline.name : 'Stages'}</h2>
              <p className="text-sm text-slate-500">
                {selectedPipeline ? 'Manage stages for the selected pipeline.' : 'Select a pipeline to manage its stages.'}
              </p>
            </div>
            <Button onClick={openCreateStage} disabled={!selectedPipeline}>+ Add Stage</Button>
          </div>
        </div>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {loading ? (
          <div className="rounded-xl bg-white p-8 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading pipelines...</div>
        ) : !selectedPipeline ? (
          <div className="rounded-xl bg-white p-8 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Create or select a pipeline to view its stages.</div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Color</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStages.map((stage) => (
                  <tr key={stage.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{stage.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: stage.color || '#2563eb' }} />
                        <span>{stage.color || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3">
                        <Button onClick={() => openEditStage(stage)} variant="primary" size="sm">Edit</Button>
                        <Button onClick={() => handleDeleteStage(stage)} variant="danger" size="sm">Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredStages.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      No stages yet for this pipeline.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Custom Lead Stages</h2>
              <p className="text-sm text-slate-500">Manage lead stages that are separate from sales pipeline stages.</p>
            </div>
            <Button onClick={() => setShowLeadStageModal(true)}>Add Stage</Button>
          </div>

          {leadStageError && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{leadStageError}</div>}

          <div className="space-y-3">
            {leadStages.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <div className="font-medium text-slate-900">{stage.name}</div>
                  <div className="text-xs text-slate-500">Custom lead stage</div>
                </div>
                <Button onClick={() => handleDeleteLeadStage(stage)} variant="danger" size="sm">Delete</Button>
              </div>
            ))}
            {!loading && !leadStages.length && (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                No custom lead stages yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={showPipelineModal} onClose={closePipelineModal} title="Add Pipeline">
        <form onSubmit={handleCreatePipeline} className="space-y-4">
          <Input
            label="Pipeline name"
            value={pipelineName}
            onChange={(event) => setPipelineName(event.target.value)}
            placeholder="Enter pipeline name"
            required
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={savingPipeline}>{savingPipeline ? 'Saving...' : 'Create pipeline'}</Button>
            <Button type="button" variant="secondary" onClick={closePipelineModal}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showStageModal} onClose={() => closeStageModal()} title={editingStage ? 'Edit Stage' : 'Add Stage'}>
        <form onSubmit={handleSaveStage} className="space-y-4">
          <Input
            label="Stage name"
            value={stageForm.name}
            onChange={(event) => setStageForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Enter stage name"
            required
          />

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Color</span>
            <input
              type="color"
              value={stageForm.color}
              onChange={(event) => setStageForm((current) => ({ ...current, color: event.target.value }))}
              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-1 py-1"
            />
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={savingStage}>{savingStage ? 'Saving...' : editingStage ? 'Save changes' : 'Create stage'}</Button>
            <Button type="button" variant="secondary" onClick={() => closeStageModal()}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showLeadStageModal} onClose={closeLeadStageModal} title="Add Custom Lead Stage" size="sm">
        <form onSubmit={handleCreateLeadStage} className="space-y-4">
          <Input
            label="Stage name"
            value={leadStageName}
            onChange={(event) => setLeadStageName(event.target.value)}
            placeholder="Enter stage name"
            required
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={savingLeadStage}>{savingLeadStage ? 'Saving...' : 'Create stage'}</Button>
            <Button type="button" variant="secondary" onClick={closeLeadStageModal}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

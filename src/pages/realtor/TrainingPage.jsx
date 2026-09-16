import { useEffect, useMemo, useState } from 'react';
import useAuthStore from '../../store/authStore';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import {
  listTrainingModules,
  createTrainingModule,
  updateTrainingModule,
  deleteTrainingModule,
  enrollTrainingModule,
  submitTrainingQuiz,
  listTrainingProgress,
  getTrainingCertificate,
} from '../../api/trainingApi';
import FieldMark from '../../components/ui/FieldMark';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const MODAL_OVERLAY_CLASS = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4';
// Capped and scrollable, like Modal.jsx. A modal taller than the viewport
// centres itself off both edges, and its submit button ends up out of
// reach with nothing to scroll — the form can be filled in and not saved.
const MODAL_CARD_CLASS = 'w-full rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto';
const MANAGER_ROLES = ['super_admin', 'admin', 'branch_manager'];
const CATEGORY_OPTIONS = [
  { value: 'sales', label: 'Sales' },
  { value: 'legal', label: 'Legal' },
  { value: 'operations', label: 'Operations' },
  { value: 'sop', label: 'SOP' },
];
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
];

const getItems = (response) => (Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []);
const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');
const emptyQuestion = () => ({ question: '', options: ['', '', '', ''], correct_index: 0 });
const emptyForm = () => ({
  title: '',
  category: 'sales',
  duration: '',
  description: '',
  video_url: '',
  resource_links: '',
  status: 'draft',
  has_quiz: false,
  quiz_data: [emptyQuestion()],
});

const getEmbedUrl = (url) => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed/${parsed.pathname.replace('/', '')}`;
    }
    if (parsed.hostname.includes('youtube.com')) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get('v') || ''}`;
    }
  } catch {
    return url;
  }
  return url;
};

export default function TrainingPage() {
  const user = useAuthStore((state) => state.user);
  const isManager = MANAGER_ROLES.includes(user?.type);
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState([]);
  const [activeTab, setActiveTab] = useState('modules');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [moduleDetailRow, setModuleDetailRow] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [certificate, setCertificate] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [progressFilters, setProgressFilters] = useState({ realtor_id: '', module_id: '' });

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [modulesResponse, progressResponse] = await Promise.all([
        listTrainingModules(isManager ? {} : undefined),
        listTrainingProgress(),
      ]);
      setModules(getItems(modulesResponse));
      setProgress(getItems(progressResponse));
    } catch (loadError) {
      console.error(loadError);
      setError(err.userMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const progressMap = useMemo(
    () => Object.fromEntries(progress.map((entry) => [String(entry.module_id), entry])),
    [progress]
  );

  const filteredProgress = useMemo(() => {
    return progress.filter((entry) => {
      if (progressFilters.realtor_id && String(entry.realtor_id) !== String(progressFilters.realtor_id)) return false;
      if (progressFilters.module_id && String(entry.module_id) !== String(progressFilters.module_id)) return false;
      return true;
    });
  }, [progress, progressFilters]);

  const realtorFilterOptions = useMemo(() => {
    const seen = new Map();
    progress.forEach((entry) => {
      if (!seen.has(String(entry.realtor_id))) seen.set(String(entry.realtor_id), entry.realtor_name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [progress]);

  const selectedEnrollment = selectedModule ? progressMap[String(selectedModule.id)] : null;
  const quizResult = selectedEnrollment?.score >= 0 && selectedEnrollment?.status !== 'in_progress' ? selectedEnrollment : null;

  const openCreate = () => {
    setEditingModule(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (module) => {
    setEditingModule(module);
    setForm({
      title: module.title || '',
      category: module.category || 'sales',
      duration: module.duration || '',
      description: module.description || '',
      video_url: module.video_url || '',
      resource_links: Array.isArray(module.resource_links) ? module.resource_links.join('\n') : '',
      status: module.status || 'draft',
      has_quiz: Boolean(module.has_quiz),
      quiz_data: Array.isArray(module.quiz_data) && module.quiz_data.length
        ? module.quiz_data.map((item) => ({
            question: item.question || '',
            options: Array.isArray(item.options) ? [...item.options] : ['', '', '', ''],
            correct_index: Number(item.correct_index) || 0,
          }))
        : [emptyQuestion()],
    });
    setShowModal(true);
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setShowModal(false);
    setEditingModule(null);
    setForm(emptyForm());
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    category: form.category,
    duration: form.duration.trim(),
    description: form.description.trim(),
    video_url: form.video_url.trim(),
    resource_links: form.resource_links,
    status: form.status,
    has_quiz: form.has_quiz,
    quiz_data: form.has_quiz ? form.quiz_data : [],
  });

  const handleSaveModule = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.duration.trim()) return;

    setSaving(true);
    setError('');
    try {
      const payload = buildPayload();
      if (editingModule) await updateTrainingModule(editingModule.id, payload);
      else await createTrainingModule(payload);
      closeModal(true);
      await loadData();
    } catch (saveError) {
      console.error(saveError);
      setError(`Failed to ${editingModule ? 'update' : 'create'} module. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModule = async (module) => {
    if (!window.confirm(`Delete module "${module.title}"?`)) return;
    try {
      await deleteTrainingModule(module.id);
      if (selectedModule?.id === module.id) setSelectedModule(null);
      await loadData();
    } catch (deleteError) {
      console.error(deleteError);
      setError(err.userMessage);
    }
  };

  const handleOpenModule = async (module) => {
    setError('');
    try {
      if (!progressMap[String(module.id)]) {
        await enrollTrainingModule(module.id);
      }
      setSelectedModule(module);
      await loadData();
    } catch (openError) {
      console.error(openError);
      setError(err.userMessage);
    }
  };

  const handleOpenQuiz = () => {
    if (!selectedModule?.has_quiz) return;
    setQuizAnswers(Array(selectedModule.quiz_data?.length || 0).fill(null));
    setShowQuiz(true);
  };

  const handleSubmitQuiz = async (event) => {
    event.preventDefault();
    if (!selectedModule) return;

    setSaving(true);
    setError('');
    try {
      await submitTrainingQuiz(selectedModule.id, { answers: quizAnswers });
      setShowQuiz(false);
      await loadData();
    } catch (submitError) {
      console.error(submitError);
      setError(err.userMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleShowCertificate = async () => {
    if (!selectedModule) return;
    try {
      const response = await getTrainingCertificate(selectedModule.id);
      setCertificate(response?.data || null);
    } catch (certificateError) {
      console.error(certificateError);
      setError(err.userMessage);
    }
  };

  const moduleColumns = useMemo(() => [
    { key: 'title', label: 'Title', render: (row) => row.title || '—' },
    { key: 'category', label: 'Category', render: (row) => titleCase(row.category) },
    { key: 'duration', label: 'Duration', render: (row) => row.duration || '—' },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status || 'draft'} /> },
    { key: 'enrolled_count', label: 'Enrolled', render: (row) => row.enrolled_count || 0 },
  ], []);

  const moduleDetailFields = useMemo(() => [
    { label: 'Title', key: 'title' },
    { label: 'Category', render: (row) => titleCase(row.category) },
    { label: 'Duration', key: 'duration' },
    {
      label: 'Video URL',
      render: (row) => row.video_url ? <a href={row.video_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{row.video_url}</a> : '—',
    },
    { label: 'Status', render: (row) => <Badge value={row.status || 'draft'} /> },
    { label: 'Enrolled', render: (row) => row.enrolled_count || 0 },
    { label: 'Description', key: 'description' },
    {
      label: 'Resource Links',
      render: (row) => Array.isArray(row.resource_links) ? row.resource_links.join(', ') : row.resource_links || '—',
    },
    { label: 'Has Quiz', render: (row) => row.has_quiz ? 'Yes' : 'No' },
  ], []);

  const progressColumns = useMemo(() => [
    { key: 'realtor_name', label: 'Realtor Name', render: (row) => row.realtor_name || '—' },
    { key: 'module', label: 'Module', render: (row) => row.module?.title || '—' },
    { key: 'score', label: 'Score', render: (row) => `${row.score || 0}%` },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status || 'in_progress'} /> },
    { key: 'completed_at', label: 'Completed At', render: (row) => formatDate(row.completed_at) },
  ], []);

  if (loading) {
    return <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading training hub...</div>;
  }

  if (isManager) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Training &amp; LMS</h1>
            <p className="text-sm text-slate-500">Create modules, manage quizzes, and monitor realtor progress.</p>
          </div>
          {activeTab === 'modules' && <Button onClick={openCreate}>Create Module</Button>}
        </div>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-5 flex gap-2 border-b border-slate-200">
            {[
              { key: 'modules', label: 'Modules' },
              { key: 'progress', label: 'Submissions / Progress' },
            ].map((tab) => (
              <Button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                variant={activeTab === tab.key ? 'primary' : 'ghost'}
                size="sm"
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {activeTab === 'modules' ? (
            <Table
              columns={moduleColumns}
              data={modules}
              renderActions={(row) => (
                <div className="flex justify-end gap-3">
                  <Button type="button" onClick={() => openEdit(row)} variant="primary" size="sm">Edit</Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setActiveTab('progress');
                      setProgressFilters((current) => ({ ...current, module_id: String(row.id) }));
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    View Submissions
                  </Button>
                  <ActionsMenu
                    items={[
                      { label: '👁 View Details', onClick: () => setModuleDetailRow(row) },
                      { label: '🗑 Delete', variant: 'danger', onClick: () => handleDeleteModule(row) },
                    ]}
                  />
                </div>
              )}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Filter by Realtor<FieldMark /></span>
                  <Select
                    value={progressFilters.realtor_id}
                    onChange={(event) => setProgressFilters((current) => ({ ...current, realtor_id: event.target.value }))}
                    className={INPUT_CLASS}
                  >
                    <option value="">All realtors</option>
                    {realtorFilterOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </Select>
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Filter by Module<FieldMark /></span>
                  <Select
                    value={progressFilters.module_id}
                    onChange={(event) => setProgressFilters((current) => ({ ...current, module_id: event.target.value }))}
                    className={INPUT_CLASS}
                  >
                    <option value="">All modules</option>
                    {modules.map((module) => (
                      <option key={module.id} value={module.id}>{module.title}</option>
                    ))}
                  </Select>
                </label>
              </div>
              <Table columns={progressColumns} data={filteredProgress} />
            </div>
          )}
        </div>

        <DetailsModal
          open={!!moduleDetailRow}
          onClose={() => setModuleDetailRow(null)}
          title={moduleDetailRow?.title || 'Module Details'}
          record={moduleDetailRow}
          fields={moduleDetailFields}
        />

        {showModal && (
          <div className={MODAL_OVERLAY_CLASS}>
            <div className={`${MODAL_CARD_CLASS} max-w-4xl`}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{editingModule ? 'Edit Module' : 'Create Module'}</h2>
                  <p className="text-sm text-slate-500">Add content, resources, and quiz questions for your realtors.</p>
                </div>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleSaveModule} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-700">Title<FieldMark required /></span>
                    <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className={INPUT_CLASS} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-700">Category<FieldMark /></span>
                    <Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className={INPUT_CLASS}>
                      {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-700">Duration<FieldMark required /></span>
                    <input required value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))} className={INPUT_CLASS} placeholder="e.g. 45 mins" />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-700">Status<FieldMark /></span>
                    <Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={INPUT_CLASS}>
                      {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Description<FieldMark /></span>
                  <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={`${INPUT_CLASS} min-h-28`} />
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Video URL<FieldMark /></span>
                  <input value={form.video_url} onChange={(event) => setForm((current) => ({ ...current, video_url: event.target.value }))} className={INPUT_CLASS} placeholder="https://youtube.com/watch?v=..." />
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Resource Links<FieldMark /></span>
                  <textarea value={form.resource_links} onChange={(event) => setForm((current) => ({ ...current, resource_links: event.target.value }))} className={`${INPUT_CLASS} min-h-24`} placeholder="One URL per line" />
                </label>

                <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.has_quiz}
                    onChange={(event) => setForm((current) => ({ ...current, has_quiz: event.target.checked, quiz_data: event.target.checked ? current.quiz_data : [emptyQuestion()] }))}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Add quiz to this module
                </label>

                {form.has_quiz && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Quiz Questions</h3>
                      <Button
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, quiz_data: [...current.quiz_data, emptyQuestion()] }))}
                        variant="primary"
                        size="sm"
                      >
                        + Add Question
                      </Button>
                    </div>

                    {form.quiz_data.map((question, index) => (
                      <div key={index} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-medium text-slate-700">Question {index + 1}</p>
                          {form.quiz_data.length > 1 && (
                            <Button
                              type="button"
                              onClick={() => setForm((current) => ({ ...current, quiz_data: current.quiz_data.filter((_, itemIndex) => itemIndex !== index) }))}
                              variant="danger" size="sm"
                            >Remove</Button>
                          )}
                        </div>
                        <input
                          value={question.question}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            quiz_data: current.quiz_data.map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item),
                          }))}
                          className={INPUT_CLASS}
                          placeholder="Enter question text"
                        />
                        <div className="grid gap-3 md:grid-cols-2">
                          {question.options.map((option, optionIndex) => (
                            <input
                              key={optionIndex}
                              value={option}
                              onChange={(event) => setForm((current) => ({
                                ...current,
                                quiz_data: current.quiz_data.map((item, itemIndex) => itemIndex === index ? {
                                  ...item,
                                  options: item.options.map((currentOption, currentOptionIndex) => currentOptionIndex === optionIndex ? event.target.value : currentOption),
                                } : item),
                              }))}
                              className={INPUT_CLASS}
                              placeholder={`Option ${optionIndex + 1}`}
                            />
                          ))}
                        </div>
                        <label className="block space-y-1">
                          <span className="text-sm font-medium text-slate-700">Correct Answer<FieldMark /></span>
                          <Select
                            value={question.correct_index}
                            onChange={(event) => setForm((current) => ({
                              ...current,
                              quiz_data: current.quiz_data.map((item, itemIndex) => itemIndex === index ? { ...item, correct_index: Number(event.target.value) } : item),
                            }))}
                            className={INPUT_CLASS}
                          >
                            {[0, 1, 2, 3].map((optionIndex) => (
                              <option key={optionIndex} value={optionIndex}>Option {optionIndex + 1}</option>
                            ))}
                          </Select>
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingModule ? 'Save Changes' : 'Create Module'}</Button>
                  <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Training &amp; LMS</h1>
        <p className="text-sm text-slate-500">Build your skills, take quizzes, and track your completion progress.</p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {selectedModule ? (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Button type="button" onClick={() => setSelectedModule(null)} variant="primary" size="sm" className="mb-2">← Back to modules</Button>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold text-slate-900">{selectedModule.title}</h2>
                <Badge value={selectedModule.category} />
              </div>
              <p className="mt-1 text-sm text-slate-500">Duration: {selectedModule.duration || '—'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p>Status: <span className="font-medium text-slate-900">{titleCase(selectedEnrollment?.status || 'in_progress')}</span></p>
              <p>Score: <span className="font-medium text-slate-900">{selectedEnrollment?.score || 0}%</span></p>
            </div>
          </div>

          {selectedModule.video_url && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 aspect-video">
              <iframe title={selectedModule.title} src={getEmbedUrl(selectedModule.video_url)} className="h-full w-full" allowFullScreen />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Overview</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{selectedModule.description || 'No description available yet.'}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Resources</h3>
                <div className="mt-2 space-y-2">
                  {Array.isArray(selectedModule.resource_links) && selectedModule.resource_links.length ? selectedModule.resource_links.map((link) => (
                    <a key={link} href={link} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 px-3 py-2 text-sm text-blue-600 hover:bg-slate-50 hover:underline">
                      {link}
                    </a>
                  )) : <p className="text-sm text-slate-500">No resource links added yet.</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div>
                <p className="text-sm font-medium text-slate-600">Progress</p>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${selectedEnrollment?.status === 'passed' || selectedEnrollment?.status === 'failed' ? 100 : 0}%` }} />
                </div>
                <p className="mt-2 text-sm text-slate-500">{selectedEnrollment?.status === 'passed' || selectedEnrollment?.status === 'failed' ? '100%' : '0%'} complete</p>
              </div>

              {selectedModule.has_quiz ? (
                <>
                  <Button onClick={handleOpenQuiz} className="w-full">Take Quiz</Button>
                  {quizResult && (
                    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                      <p className="text-sm font-medium text-slate-900">Latest Result</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{quizResult.score || 0}%</p>
                      <p className="mt-1 text-sm text-slate-500">{titleCase(quizResult.status)}</p>
                      <Button type="button" variant="secondary" onClick={handleShowCertificate} className="mt-3 w-full" disabled={quizResult.status !== 'passed'}>
                        Download Certificate
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                  This module has no quiz yet. Review the video and resources above.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const enrollment = progressMap[String(module.id)];
            const isComplete = enrollment?.status === 'passed' || enrollment?.status === 'failed';
            return (
              <div key={module.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{module.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{module.duration || '—'}</p>
                  </div>
                  <Badge value={module.category} />
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{module.description || 'Explore this training module to sharpen your field expertise.'}</p>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Progress</span>
                    <span>{isComplete ? '100%' : '0%'}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${isComplete ? 100 : 0}%` }} />
                  </div>
                </div>
                <Button className="mt-5 w-full" onClick={() => handleOpenModule(module)}>{enrollment ? 'Continue' : 'Start'}</Button>
              </div>
            );
          })}
        </div>
      )}

      {showQuiz && selectedModule && (
        <div className={MODAL_OVERLAY_CLASS}>
          <div className={`${MODAL_CARD_CLASS} max-w-3xl`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selectedModule.title} Quiz</h2>
                <p className="text-sm text-slate-500">Answer all questions and score at least 70% to pass.</p>
              </div>
              <button type="button" onClick={() => setShowQuiz(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSubmitQuiz} className="space-y-4">
              {selectedModule.quiz_data?.map((question, index) => (
                <div key={index} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">{index + 1}. {question.question}</p>
                  <div className="mt-3 space-y-2">
                    {question.options?.map((option, optionIndex) => (
                      <label key={optionIndex} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <input
                          type="radio"
                          name={`question-${index}`}
                          checked={quizAnswers[index] === optionIndex}
                          onChange={() => setQuizAnswers((current) => {
                            const next = [...current];
                            next[index] = optionIndex;
                            return next;
                          })}
                          className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit Quiz'}</Button>
                <Button type="button" variant="secondary" onClick={() => setShowQuiz(false)} disabled={saving}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {certificate && (
        <div className={MODAL_OVERLAY_CLASS}>
          <div className={`${MODAL_CARD_CLASS} max-w-xl`}>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">Certificate of Completion</p>
              <h3 className="mt-4 text-2xl font-semibold text-slate-900">{certificate.realtor_name}</h3>
              <p className="mt-2 text-sm text-slate-600">has successfully completed</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{certificate.module_title}</p>
              <p className="mt-3 text-sm text-slate-500">Completed on {formatDate(certificate.completed_at)}</p>
              <p className="mt-5 text-xs text-slate-500">A downloadable copy is not available yet.</p>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setCertificate(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

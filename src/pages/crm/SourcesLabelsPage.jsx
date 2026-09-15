import { useEffect, useState } from 'react';
import {
  listSources, createSource, deleteSource,
  listLabels, createLabel, deleteLabel,
} from '../../api/crmApi';
import Button from '../../components/ui/Button';

const INPUT_CLASS = 'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const PRESET_COLORS = [
  '#ef4444','#f97316','#f59e0b','#10b981','#06b6d4',
  '#3b82f6','#6366f1','#8b5cf6','#ec4899','#64748b',
];

function TagChip({ name, color, onDelete, isDefault }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-white"
      style={{ backgroundColor: color || '#6366f1' }}>
      {name}
      {!isDefault && (
        <button type="button" onClick={onDelete}
          className="ml-0.5 text-white/70 hover:text-white leading-none"
          title="Remove">✕</button>
      )}
    </span>
  );
}

export default function SourcesLabelsPage() {
  const [tab, setTab] = useState('sources');

  // Sources state
  const [sources, setSources] = useState([]);
  const [newSource, setNewSource] = useState('');
  const [savingSource, setSavingSource] = useState(false);
  const [sourceError, setSourceError] = useState('');

  // Labels state
  const [labels, setLabels] = useState([]);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [savingLabel, setSavingLabel] = useState(false);
  const [labelError, setLabelError] = useState('');

  const DEFAULT_SOURCE_NAMES = new Set([
    'AI Chatbot','Website','Referral','Social Media','Walk-In','Phone Call',
    'Email Campaign','Property Exhibition','WhatsApp','Instagram','Facebook',
    'Google Ads','Agent Referral','Cold Outreach','Partner Channel',
  ]);

  const DEFAULT_LABEL_NAMES = new Set([
    'Hot Lead','Warm Lead','Cold Lead','VIP Client','Investor','First-Time Buyer',
    'Returning Client','Needs Follow-Up','Do Not Contact','High Budget','Low Budget',
    'Commercial','Residential','Shortlet','Land',
  ]);

  const load = async () => {
    /*
     * All of them. This screen MANAGES sources and labels, so a paginated
     * response hides rows an administrator is trying to edit — and with fifteen
     * of each against a default page of ten, a third of them were invisible.
     */
    const [s, l] = await Promise.all([
      listSources({ limit: 'all' }),
      listLabels({ limit: 'all' }),
    ]);
    setSources(Array.isArray(s) ? s : s?.data ?? []);
    setLabels(Array.isArray(l) ? l : l?.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleAddSource = async (e) => {
    e.preventDefault();
    const name = newSource.trim();
    if (!name) return;
    setSavingSource(true);
    setSourceError('');
    try {
      await createSource({ name });
      setNewSource('');
      await load();
    } catch (err) {
      setSourceError(err?.response?.data?.message || 'Failed to create source.');
    } finally {
      setSavingSource(false);
    }
  };

  const handleDeleteSource = async (id) => {
    if (!window.confirm('Remove this source?')) return;
    try { await deleteSource(id); await load(); }
    catch (err) { setSourceError(err?.response?.data?.message || 'Failed to delete source.'); }
  };

  const handleAddLabel = async (e) => {
    e.preventDefault();
    const name = newLabel.trim();
    if (!name) return;
    setSavingLabel(true);
    setLabelError('');
    try {
      await createLabel({ name, color: newColor });
      setNewLabel('');
      setNewColor('#6366f1');
      await load();
    } catch (err) {
      setLabelError(err?.response?.data?.message || 'Failed to create label.');
    } finally {
      setSavingLabel(false);
    }
  };

  const handleDeleteLabel = async (id) => {
    if (!window.confirm('Remove this label?')) return;
    try { await deleteLabel(id); await load(); }
    catch (err) { setLabelError(err?.response?.data?.message || 'Failed to delete label.'); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Sources &amp; Labels</h1>
        <p className="text-sm text-slate-500">
          Manage lead sources and labels used across the CRM. Default entries cannot be deleted.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {['sources', 'labels'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium capitalize transition',
              tab === t
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'sources' && (
        <div className="space-y-5">
          {/* Add new */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Add New Source</h2>
            <form onSubmit={handleAddSource} className="flex gap-3">
              <input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="e.g. LinkedIn, Newspaper Ad…"
                className={`${INPUT_CLASS} flex-1`}
              />
              <Button type="submit" disabled={savingSource}>
                {savingSource ? 'Adding…' : '+ Add'}
              </Button>
            </form>
            {sourceError && <p className="mt-2 text-xs text-rose-600">{sourceError}</p>}
          </div>

          {/* List */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              All Sources <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{sources.length}</span>
            </h2>
            {sources.length === 0 ? (
              <p className="text-sm text-slate-400">No sources yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => {
                  const isDefault = DEFAULT_SOURCE_NAMES.has(s.name) && !s.company_id;
                  return (
                    <span key={s.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                      {s.name}
                      {isDefault
                        ? <span className="text-xs text-slate-400">(default)</span>
                        : (
                          <button type="button"
                            onClick={() => handleDeleteSource(s.id)}
                            className="text-slate-400 hover:text-rose-600 leading-none"
                            title="Remove">✕</button>
                        )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'labels' && (
        <div className="space-y-5">
          {/* Add new */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Add New Label</h2>
            <form onSubmit={handleAddLabel} className="flex flex-wrap gap-3">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Diaspora Buyer, Agricultural Land…"
                className={`${INPUT_CLASS} flex-1 min-w-[200px]`}
              />
              {/* Color picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Color:</span>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      style={{ backgroundColor: c }}
                      className={`h-6 w-6 rounded-full transition ${newColor === c ? 'ring-2 ring-offset-1 ring-slate-700' : ''}`}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-6 w-6 cursor-pointer rounded-full border-0 p-0"
                    title="Custom color"
                  />
                </div>
              </div>
              <Button type="submit" disabled={savingLabel}>
                {savingLabel ? 'Adding…' : '+ Add'}
              </Button>
            </form>
            {/* Preview */}
            {newLabel.trim() && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-500">Preview:</span>
                <TagChip name={newLabel} color={newColor} />
              </div>
            )}
            {labelError && <p className="mt-2 text-xs text-rose-600">{labelError}</p>}
          </div>

          {/* List */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              All Labels <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{labels.length}</span>
            </h2>
            {labels.length === 0 ? (
              <p className="text-sm text-slate-400">No labels yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {labels.map((l) => {
                  const isDefault = DEFAULT_LABEL_NAMES.has(l.name) && !l.company_id;
                  return (
                    <TagChip
                      key={l.id}
                      name={l.name}
                      color={l.color}
                      isDefault={isDefault}
                      onDelete={() => handleDeleteLabel(l.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

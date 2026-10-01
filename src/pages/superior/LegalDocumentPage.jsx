import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileText, Users } from 'lucide-react';
import {
  getLegalDocument, getLegalVersion, publishLegalDocument, saveLegalDraft,
} from '../../api/legalApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/common/Modal';
import TermsDocument, { formatLegalDate } from '../../components/legal/TermsDocument';

/**
 * Platform admins: edit the Terms of Use and Privacy Policy, and publish it.
 *
 * The draft is a working copy — saving it changes nothing anybody sees.
 * Publishing turns it into the next version, stamped with the moment it was
 * published, which is the document's "Last Updated" date. It is refused while
 * any placeholder remains, and a material change can ask every realtor and
 * client to agree again (clause 67.2). Published versions are kept whole: the
 * history shows exactly what each person agreed to.
 */

// Same rule the server enforces (shared/src/legalTerms.js findPlaceholders).
const PLACEHOLDERS = [/\[[^\]\n]+\](?!\()/g, /_{3,}/g, /\b(TBD|TBC|XXX+)\b/g];
const findPlaceholders = (content) => String(content || '').split('\n').flatMap((line, index) => PLACEHOLDERS
  .flatMap((pattern) => [...line.matchAll(pattern)].map((m) => ({ text: m[0], line: index + 1 }))));

export default function LegalDocumentPage() {
  const [doc, setDoc] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', effective_date: '' });
  const [saved, setSaved] = useState(null);
  const [tab, setTab] = useState('edit');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishForm, setPublishForm] = useState({ requires_acceptance: false, change_note: '' });
  const [viewing, setViewing] = useState(null);

  const load = async () => {
    const data = await getLegalDocument();
    setDoc(data);
    const draft = data?.draft;
    const next = {
      title: draft?.title || 'Realx8 Terms of Use and Privacy Policy',
      content: draft?.content || '',
      effective_date: draft?.effective_date ? String(draft.effective_date).slice(0, 10) : '',
    };
    setForm(next);
    setSaved(next);
  };
  useEffect(() => { load().catch((err) => setMessage({ type: 'error', text: err.userMessage || 'Could not load the document.' })); }, []);

  const placeholders = useMemo(() => findPlaceholders(form.content), [form.content]);
  const dirty = saved && (form.title !== saved.title || form.content !== saved.content || form.effective_date !== saved.effective_date);
  const versions = doc?.versions || [];
  const current = versions[0] || null;
  const firstVersion = versions.length === 0;

  const save = async () => {
    setBusy('save');
    setMessage(null);
    try {
      await saveLegalDraft({ ...form, effective_date: form.effective_date || null });
      setSaved(form);
      setMessage({ type: 'success', text: 'Draft saved. Nothing changes for users until you publish.' });
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.message || err.userMessage || 'Could not save the draft.' });
      return false;
    } finally {
      setBusy('');
    }
  };

  const openPublish = () => {
    setPublishForm({ requires_acceptance: firstVersion, change_note: '' });
    setPublishing(true);
  };

  const publish = async () => {
    setBusy('publish');
    setMessage(null);
    try {
      if (dirty && !(await save())) return;
      setBusy('publish');
      const result = await publishLegalDocument(publishForm);
      setPublishing(false);
      setMessage({
        type: 'success',
        text: `Version ${result.version} published. Last Updated is now ${formatLegalDate(result.published_at)}.`
          + (result.requires_acceptance ? ' Every realtor and client will be asked to agree to it.' : ''),
      });
      await load();
    } catch (err) {
      const data = err?.response?.data;
      setMessage({ type: 'error', text: data?.message || err.userMessage || 'Could not publish.' });
      setPublishing(false);
    } finally {
      setBusy('');
    }
  };

  const view = async (id) => {
    try { setViewing(await getLegalVersion(id)); } catch { setMessage({ type: 'error', text: 'Could not open that version.' }); }
  };

  if (!doc) return <p className="text-sm text-slate-500">{message?.text || 'Loading…'}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Terms of Use &amp; Privacy Policy</h1>
          <p className="mt-1 text-sm text-slate-500">
            {current
              ? `Live: version ${current.version} · Last Updated ${formatLegalDate(current.published_at)} · Effective ${formatLegalDate(current.effective_date)}`
              : 'Not published yet — realtors and clients are not asked to agree until it is.'}
          </p>
        </div>
        <Link to="/superior/legal/acceptances" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary ring-1 ring-slate-200 hover:bg-slate-50">
          <Users size={16} aria-hidden="true" /> Who has agreed
        </Link>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`} role="status">{message.text}</div>
      )}

      <div className={`flex items-start gap-3 rounded-xl p-4 ring-1 ${placeholders.length ? 'bg-amber-50 ring-amber-200' : 'bg-emerald-50 ring-emerald-200'}`}>
        {placeholders.length
          ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />}
        <div className="min-w-0 text-sm">
          {placeholders.length ? (
            <>
              <p className="font-semibold text-amber-900">{placeholders.length} placeholder{placeholders.length === 1 ? '' : 's'} to fill in before this can be published</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {placeholders.map((p, i) => (
                  <li key={`${p.line}-${i}`} className="rounded bg-white px-2 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200">
                    line {p.line}: <span className="font-mono">{p.text}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="font-semibold text-emerald-900">No placeholders left — this draft can be published.</p>}
        </div>
      </div>

      <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Title</span>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Effective date</span>
            <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div role="tablist" className="inline-flex rounded-lg bg-slate-100 p-1">
            {[['edit', 'Edit'], ['preview', 'Preview']].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {dirty ? 'Unsaved changes' : (doc.draft?.updated_at ? `Draft saved ${formatLegalDate(doc.draft.updated_at)}` : '')}
          </p>
        </div>

        {tab === 'edit' ? (
          <>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              spellCheck
              aria-label="Document text"
              className="h-[60vh] w-full rounded-lg border border-slate-200 p-3 font-mono text-[13px] leading-relaxed text-slate-800 focus:border-[color:var(--primary)] focus:outline-none"
            />
            <p className="text-xs text-slate-500">
              <span className="font-mono">## Part …</span> for a part, <span className="font-mono">### 12. …</span> for a clause,
              <span className="font-mono"> - </span> for a list item, <span className="font-mono">**bold**</span>, and
              <span className="font-mono"> | a | b |</span> rows for a table.
            </p>
          </>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 p-5">
            <TermsDocument
              terms={{ title: form.title, content: form.content, effective_date: form.effective_date, last_updated: null }}
              highlightPlaceholders
            />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={save} disabled={Boolean(busy) || !dirty}>
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </Button>
          <Button type="button" onClick={openPublish} disabled={Boolean(busy) || placeholders.length > 0}>
            Publish…
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Version history</h2>
        {versions.length ? (
          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Version</th>
                  <th className="px-4 py-2.5">Last Updated</th>
                  <th className="px-4 py-2.5">Effective</th>
                  <th className="px-4 py-2.5">Published by</th>
                  <th className="px-4 py-2.5">Asked to agree</th>
                  <th className="px-4 py-2.5">Agreements</th>
                  <th className="px-4 py-2.5">Note</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">v{v.version}{v === current && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Live</span>}</td>
                    <td className="px-4 py-2.5">{formatLegalDate(v.published_at)}</td>
                    <td className="px-4 py-2.5">{formatLegalDate(v.effective_date)}</td>
                    <td className="px-4 py-2.5">{v.published_by_name || '—'}</td>
                    <td className="px-4 py-2.5">{v.requires_acceptance ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2.5">
                      <Link to={`/superior/legal/acceptances?version=${v.version}`} className="font-semibold text-primary hover:underline">{v.acceptances.toLocaleString()}</Link>
                    </td>
                    <td className="max-w-[16rem] truncate px-4 py-2.5 text-slate-600" title={v.change_note || ''}>{v.change_note || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" onClick={() => view(v.id)} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                        <FileText size={14} aria-hidden="true" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="rounded-xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">No version has been published yet.</p>}
      </div>

      <Modal open={publishing} onClose={() => setPublishing(false)} title={`Publish version ${(current?.version || 0) + 1}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            The draft becomes the live Terms of Use and Privacy Policy. Its Last Updated date will be today, and the text is
            kept unchanged in the history as the version people agree to.
          </p>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">What changed (for the history)</span>
            <Input value={publishForm.change_note} onChange={(e) => setPublishForm({ ...publishForm, change_note: e.target.value })} placeholder="e.g. Added the Data Protection Officer's details" />
          </label>
          <label className="flex items-start gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
              checked={publishForm.requires_acceptance}
              disabled={firstVersion}
              onChange={(e) => setPublishForm({ ...publishForm, requires_acceptance: e.target.checked })}
            />
            <span>
              <span className="font-semibold">Ask every realtor and client to agree again</span>
              <span className="block text-xs text-slate-500">
                {firstVersion
                  ? 'Always on for the first version: nobody has agreed to anything yet.'
                  : 'For a material change (clause 67.2). They are asked the next time they open the app.'}
              </span>
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPublishing(false)} disabled={busy === 'publish'}>Cancel</Button>
            <Button type="button" onClick={publish} disabled={busy === 'publish'}>{busy === 'publish' ? 'Publishing…' : 'Publish'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing ? `Version ${viewing.version}` : ''} size="xl">
        {viewing && <TermsDocument terms={{ ...viewing, last_updated: viewing.published_at }} />}
      </Modal>
    </div>
  );
}

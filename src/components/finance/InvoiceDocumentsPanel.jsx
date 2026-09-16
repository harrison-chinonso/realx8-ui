import { useCallback, useEffect, useState } from 'react';
import { FileText, UploadCloud, Trash2, Download, Eye } from 'lucide-react';
import { listInvoiceDocuments, attachInvoiceDocument, deleteInvoiceDocument } from '../../api/financeApi';
import { uploadPropertyMedia } from '../../api/propertyApi';
import { downloadUrl } from '../../utils/downloadUrl';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import FieldMark from '../ui/FieldMark';

/**
 * Paperwork attached to one invoice — agreements, receipts, title copies.
 *
 * Both audiences use this component. Staff get the upload box and a remove
 * action; the buyer gets the list. Nothing is hidden from the buyer here: a
 * document was attached to THEIR invoice, which is the act of giving it to
 * them, so they may view it and download the original.
 *
 * That is the deliberate difference from a property document, which a buyer can
 * only view and only when an admin has marked it shareable.
 */

const TYPE_LABELS = {
  agreement: 'Agreement',
  receipt: 'Receipt',
  property_document: 'Property document',
  title: 'Title',
  other: 'Other',
};

const TYPE_TONE = {
  agreement: 'bg-indigo-100 text-indigo-700',
  receipt: 'bg-emerald-100 text-emerald-700',
  property_document: 'bg-sky-100 text-sky-700',
  title: 'bg-amber-100 text-amber-800',
  other: 'bg-slate-100 text-slate-600',
};

const formatSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (!n) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export default function InvoiceDocumentsPanel({ invoiceId, canManage = false }) {
  const [docs, setDocs] = useState(null);
  const [types, setTypes] = useState(Object.keys(TYPE_LABELS));
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'agreement', url: '', size: null, public_id: null });

  const load = useCallback(() => {
    if (!invoiceId) return;
    listInvoiceDocuments(invoiceId)
      .then((res) => {
        setDocs(res?.data ?? []);
        if (Array.isArray(res?.types) && res.types.length) setTypes(res.types);
      })
      .catch((err) => setError(err?.response?.data?.message || err?.userMessage || 'Could not load documents.'));
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await uploadPropertyMedia([file]);
      const first = uploaded?.[0];
      if (!first?.url) throw new Error('Upload did not return a file URL.');
      setForm((f) => ({
        ...f,
        url: first.url,
        size: first.size ?? file.size ?? null,
        public_id: first.public_id ?? null,
        // The filename is the obvious name; still editable before saving.
        name: f.name || file.name,
      }));
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not upload that file.');
    } finally {
      setUploading(false);
    }
  };

  const attach = async (event) => {
    event.preventDefault();
    if (!form.url || !form.name.trim()) { setError('Give the document a name and upload a file.'); return; }
    setSaving(true);
    setError('');
    try {
      await attachInvoiceDocument(invoiceId, { ...form, name: form.name.trim() });
      setForm({ name: '', type: 'agreement', url: '', size: null, public_id: null });
      load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not attach that document.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (doc) => {
    setBusyId(doc.id);
    setError('');
    try {
      await deleteInvoiceDocument(invoiceId, doc.id);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not remove that document.');
    } finally {
      setBusyId(null);
    }
  };

  // Nothing attached and nothing the buyer can do about it — no empty panel.
  if (!canManage && docs !== null && docs.length === 0) return null;

  return (
    <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="text-lg font-semibold">Documents</h2>
        <p className="text-sm text-slate-500">
          {canManage
            ? 'Attach agreements, receipts and property paperwork. The buyer can view and download whatever you attach here.'
            : 'Paperwork for this invoice. Open a document to read it, or download the original copy.'}
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {docs === null && <p className="text-sm text-slate-500">Loading documents…</p>}

      {docs?.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
          {docs.map((doc) => (
            <li key={doc.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <FileText size={18} className="shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900" title={doc.name}>{doc.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${TYPE_TONE[doc.type] || TYPE_TONE.other}`}>
                      {TYPE_LABELS[doc.type] || doc.type}
                    </span>
                    {formatSize(doc.size) && <span>{formatSize(doc.size)}</span>}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200 hover:bg-slate-50"
                  style={{ color: 'var(--primary)' }}
                >
                  <Eye size={14} /> View
                </a>
                {/*
                  * downloadUrl, not a bare `download` attribute: the attribute
                  * is ignored cross-origin, so these opened in a tab instead of
                  * saving. It also returns the ORIGINAL rather than a
                  * re-encoded derivative.
                  */}
                <a
                  href={downloadUrl(doc.url, doc.name)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  <Download size={14} /> Download
                </a>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => remove(doc)}
                    disabled={busyId === doc.id}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Trash2 size={14} /> {busyId === doc.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {docs?.length === 0 && canManage && (
        <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Nothing attached yet.
        </p>
      )}

      {canManage && (
        <form onSubmit={attach} className="space-y-3 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-700">Attach a document</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Name<FieldMark /></span>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Sale Agreement"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Type<FieldMark /></span>
              <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {types.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
              </Select>
            </label>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500 hover:border-slate-400">
            <UploadCloud size={16} />
            <span>{uploading ? 'Uploading…' : form.url ? 'Replace file' : 'Choose a file'}<FieldMark /></span>
            <input
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          {form.url && (
            <a href={form.url} target="_blank" rel="noreferrer" className="block text-xs hover:underline" style={{ color: 'var(--primary)' }}>
              Preview the uploaded file
            </a>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving || uploading || !form.url || !form.name.trim()}>
              {saving ? 'Attaching…' : 'Attach document'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

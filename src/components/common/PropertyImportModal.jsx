import { useState } from 'react';
import { bulkImportProperties, downloadBulkTemplate } from '../../api/propertyApi';
import Modal from './Modal';
import Button from '../ui/Button';
import useAuthStore from '../../store/authStore';

/**
 * Bulk-create properties from a spreadsheet. The template is generated server
 * side and already matches the caller's role, so a company admin never sees a
 * Company ID column to fill in.
 */
export default function PropertyImportModal({ open, onClose, onImported }) {
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [rowErrors, setRowErrors] = useState([]);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError('');
    setRowErrors([]);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleTemplate = async () => {
    setDownloading(true);
    setError('');
    try {
      await downloadBulkTemplate();
    } catch (err) {
      setError(err?.userMessage || 'Could not download the template.');
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setRowErrors([]);
    setResult(null);
    try {
      const response = await bulkImportProperties(file);
      setResult(response);
      onImported?.();
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.message || err?.userMessage || 'Import failed.');
      setRowErrors(Array.isArray(data?.errors) ? data.errors : []);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Bulk Import Properties" size="lg">
      <div className="space-y-5">
        <ol className="space-y-3 text-sm text-slate-700">
          <li className="flex flex-wrap items-center gap-3">
            <span className="font-medium">1. Download the template</span>
            <Button type="button" variant="secondary" size="sm" onClick={handleTemplate} disabled={downloading}>
              {downloading ? 'Preparing...' : '⬇ Download Template'}
            </Button>
          </li>
          <li>
            <span className="font-medium">2. Fill in one property per row</span>
            <p className="mt-1 text-xs text-slate-500">
              Only <strong>Name</strong>{isSuperiorAdmin && <> and <strong>Company Code</strong></>} {isSuperiorAdmin ? 'are' : 'is'} required.
              Delete the example row before uploading. The Instructions sheet explains every column{isSuperiorAdmin ? ', and the Companies sheet lists every company code' : ''}.
              {!isSuperiorAdmin && ' Imported properties are assigned to your company automatically.'}
            </p>
          </li>
          <li>
            <span className="font-medium">3. Upload the completed sheet</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => { setFile(event.target.files?.[0] || null); setError(''); setRowErrors([]); setResult(null); }}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </li>
        </ol>

        {result && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            {result.message} They are queued for approval.
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {rowErrors.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-red-200">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-red-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-red-800">Row</th>
                  <th className="px-3 py-2 text-left font-semibold text-red-800">Problem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {rowErrors.map(({ row, errors }) => (
                  <tr key={row}>
                    <td className="px-3 py-2 align-top font-mono text-red-700">{row}</td>
                    <td className="px-3 py-2 text-red-700">{errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          <Button type="button" onClick={handleUpload} disabled={!file || busy}>
            {busy ? 'Importing...' : 'Import Properties'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

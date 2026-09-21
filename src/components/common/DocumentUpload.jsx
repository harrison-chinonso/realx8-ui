import { useRef, useState } from 'react';
import Button from '../ui/Button';
import { uploadMediaFiles } from '../../api/mediaApi';
import { extractError } from '../../utils/extractError';

/**
 * One document, uploaded and handed back as a URL.
 *
 * ── Why this is a component rather than a fourth copy ───────────────────────
 *
 * Receipts, the blog and media posts each grew their own version of the same
 * twenty lines, and each had to rediscover the same two browser details. Every
 * new evidence field — a handover acknowledgement, an outgoing accountant's
 * sign-off — would have been another copy.
 *
 * The two details worth keeping in one place:
 *
 * Cancelling the file dialog fires `change` with NO file. Treating that as a
 * selection clears a document the user had already attached, which they did
 * not ask for and will not notice until it matters.
 *
 * Re-picking the SAME file fires nothing, because the input's value has not
 * changed. Clearing the input afterwards is what makes a second attempt
 * possible after a failed upload — which is exactly when somebody retries.
 */
export default function DocumentUpload({
  value,
  onChange,
  accept = 'image/*,application/pdf',
  label = 'Choose a file',
}) {
  const input = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState('');
  const [name, setName] = useState('');

  const pick = async (event) => {
    const file = event.target.files?.[0];
    // A cancelled dialog must not clear what is already attached.
    if (!file) return;

    setUploading(true);
    setFailed('');
    try {
      const uploaded = await uploadMediaFiles([file]);
      const first = uploaded?.files?.[0] ?? uploaded?.[0];
      if (!first?.url) throw new Error('The upload returned no file.');
      setName(first.name || file.name);
      onChange(first.url);
    } catch (error) {
      setFailed(extractError(error, 'That file could not be uploaded.'));
    } finally {
      setUploading(false);
      // Reset, so re-picking the same file after a failure fires change again.
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept={accept} onChange={pick} className="hidden" />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? 'Uploading…' : label}
        </Button>
        {value && (
          <>
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm text-blue-600 hover:underline"
            >
              {name || 'View the attached document'}
            </a>
            <button
              type="button"
              onClick={() => { setName(''); onChange(''); }}
              className="text-xs text-slate-400 hover:text-danger"
            >
              Remove
            </button>
          </>
        )}
      </div>
      {failed && <p className="text-xs text-danger">{failed}</p>}
    </div>
  );
}

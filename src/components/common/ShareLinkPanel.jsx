import { useState } from 'react';
import Button from '../ui/Button';

/**
 * Copyable share link, shown after a share token is issued on devices without
 * a native share sheet.
 */
export default function ShareLinkPanel({ share, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const encoded = encodeURIComponent(`${share.name} — ${share.url}`);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Share “{share.name}”</p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">✕</button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Anyone with this link can view the property and request to purchase it — no account needed to look.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={share.url}
          onFocus={(event) => event.target.select()}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs"
        />
        <Button type="button" size="sm" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</Button>
        <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noreferrer">
          <Button type="button" variant="secondary" size="sm">WhatsApp</Button>
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(share.name)}&body=${encoded}`}>
          <Button type="button" variant="secondary" size="sm">Email</Button>
        </a>
      </div>
    </div>
  );
}

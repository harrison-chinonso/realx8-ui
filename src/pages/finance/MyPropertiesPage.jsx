import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Download, Eye, Lock } from 'lucide-react';
import { getMyProperties } from '../../api/financeApi';
import { useCurrency, useAppearance } from '../../context/useAppearance';
import { openReceipt } from '../../utils/receiptDocument';
import { resolveMedia } from '../../utils/mediaUrl';
import { downloadUrl } from '../../utils/downloadUrl';
import { STATE_TONE, STATE_LABEL } from '../../utils/invoiceState';
import SummaryTile from '../../components/dashboard/SummaryTile';
import Button from '../../components/ui/Button';
import { safeHref } from '../../utils/safeHref';

/**
 * What a buyer owns, and everything that hangs off it.
 *
 * Until now a client could see their invoices and their payments as two flat
 * lists, and nothing at all tied either back to the property. This is the view
 * from the other end: start from the thing they bought, and show the unit, the
 * invoice, what they have paid, where each of their proofs stands, and the
 * paperwork they hold.
 *
 * One endpoint assembles it, because five separate fetches per property would
 * either be slow or let one panel drift out of step with the others.
 */

const PROOF_STATE = {
  pending:   { label: 'Under review', tone: 'bg-amber-100 text-amber-800' },
  verified:  { label: 'Approved',     tone: 'bg-emerald-100 text-emerald-800' },
  rejected:  { label: 'Rejected',     tone: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Cancelled',    tone: 'bg-slate-100 text-slate-600' },
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Pictures and videos, side by side, as the property stores them. */
function MediaStrip({ items }) {
  if (!items?.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.slice(0, 8).map((item, index) => {
        const url = typeof item === 'string' ? item : item?.url;
        if (!url) return null;
        const media = resolveMedia(url, typeof item === 'string' ? undefined : item?.type);
        const key = `${url}-${index}`;

        if (media.kind === 'image') {
          return (
            <a key={key} href={media.src} target="_blank" rel="noreferrer" className="shrink-0">
              <img src={media.src} alt="" className="h-20 w-28 rounded-lg object-cover ring-1 ring-slate-200" loading="lazy" />
            </a>
          );
        }
        // Video or provider embed: a poster where one exists, otherwise a plain
        // tile. Either way it links out rather than autoplaying in a list.
        return (
          <a key={key} href={media.kind === 'embed' ? media.src : url} target="_blank" rel="noreferrer"
             className="relative flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-800 ring-1 ring-slate-200">
            {media.poster && <img src={media.poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
            <span className="relative text-2xl text-white/90">▶</span>
          </a>
        );
      })}
    </div>
  );
}

function DocumentRow({ doc }) {
  return (
    <li className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex min-w-0 items-center gap-2">
        <FileText size={15} className="shrink-0 text-slate-400" />
        <span className="min-w-0">
          <span className="block truncate text-sm text-slate-800" title={doc.name}>{doc.name}</span>
          {doc.type && <span className="text-xs capitalize text-slate-500">{String(doc.type).replace(/_/g, ' ')}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <a href={safeHref(doc.url) ?? undefined} target="_blank" rel="noreferrer"
           className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-slate-200 hover:bg-slate-50"
           style={{ color: 'var(--primary)' }}>
          <Eye size={13} /> View
        </a>
        {doc.can_download ? (
          <a href={downloadUrl(doc.url, doc.name)}
             className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            <Download size={13} /> Download
          </a>
        ) : (
          /* Shared to read, not to keep — see the note under the list. */
          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-slate-100">
            <Lock size={13} /> View only
          </span>
        )}
      </span>
    </li>
  );
}

export default function MyPropertiesPage() {
  const fmt = useCurrency();
  const appearance = useAppearance();
  const [rows, setRows] = useState(null);
  const [totals, setTotals] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getMyProperties()
      .then((res) => { if (!cancelled) { setRows(res?.data ?? []); setTotals(res?.totals ?? null); } })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || err?.userMessage || 'Could not load your properties.'); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="rounded-xl bg-rose-50 p-6 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>;
  if (rows === null) return <div className="rounded-xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">Loading your properties…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Properties</h1>
        <p className="text-sm text-slate-500">
          Everything you have purchased — the unit, the invoice, what you have paid, and your documents.
        </p>
      </div>

      {totals && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Properties" value={totals.properties} sub={`${totals.purchases} purchases`} accent />
          <SummaryTile label="Total Value" value={fmt(totals.value)} />
          <SummaryTile label="Paid" value={fmt(totals.paid)} />
          <SummaryTile label="Outstanding" value={fmt(totals.balance)} />
        </div>
      )}

      {rows.length === 0 && (
        <div className="rounded-xl bg-white p-10 text-center ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-700">You have not purchased a property yet.</p>
          <p className="mt-1 text-sm text-slate-500">Anything you buy will appear here with its invoice and paperwork.</p>
        </div>
      )}

      {rows.map((row) => (
        <div key={row.id} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 sm:flex-1">
              <h2 className="truncate text-base font-semibold text-slate-900">{row.property.name || 'Property'}</h2>
              {row.property.location && <p className="mt-0.5 truncate text-sm text-slate-500">{row.property.location}</p>}
              <p className="mt-1 text-sm text-slate-600">
                {row.unit.label || 'Unit'}
                {row.unit.quantity ? ` × ${row.unit.quantity}` : ''}
                {row.unit.price ? ` · ${fmt(row.unit.price)} each` : ''}
              </p>
            </div>
            {row.invoice && (
              <span className={`shrink-0 self-start whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATE_TONE[row.invoice.state] || 'bg-slate-100 text-slate-600'}`}>
                {STATE_LABEL[row.invoice.state] || row.invoice.state}
              </span>
            )}
          </div>

          <MediaStrip items={row.property.media} />

          {/* ── The invoice, and what has been paid against it ── */}
          {row.invoice ? (
            <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">Invoice</div>
                  <Link to={`/finance/invoices/${row.invoice.id}`} className="mt-0.5 block text-sm font-semibold hover:underline" style={{ color: 'var(--primary)' }}>
                    {row.invoice.reference || `#${row.invoice.id}`}
                  </Link>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Amount</div>
                  <div className="mt-0.5 text-sm text-slate-800">{fmt(row.invoice.amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Paid</div>
                  <div className="mt-0.5 text-sm text-slate-800">{fmt(row.invoice.paid)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Outstanding</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">{fmt(row.invoice.balance)}</div>
                </div>
              </div>

              {row.payments.length > 0 && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How you paid</p>
                  <ul className="mt-2 space-y-1">
                    {row.payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap justify-between gap-2 text-sm text-slate-600">
                        <span>{formatDate(p.created_at)} · <span className="capitalize">{String(p.payment_method || '').replace(/_/g, ' ')}</span></span>
                        <span className="font-medium text-slate-900">{fmt(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {row.proofs.length > 0 && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your proofs of payment</p>
                  <ul className="mt-2 space-y-2">
                    {row.proofs.map((proof) => {
                      const state = PROOF_STATE[proof.status] || PROOF_STATE.pending;
                      return (
                        <li key={proof.id} className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-900">{fmt(proof.amount)}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${state.tone}`}>{state.label}</span>
                              <span className="text-xs text-slate-500">{formatDate(proof.created_at)}</span>
                            </span>
                            <span className="flex items-center gap-3">
                              {proof.document_url && (
                                <a href={proof.document_url} target="_blank" rel="noreferrer" className="text-xs font-semibold hover:underline" style={{ color: 'var(--primary)' }}>
                                  View proof
                                </a>
                              )}
                              {/*
                                The company's receipt, which is the thing the
                                buyer actually wants to keep — their proof is
                                what they already had. Labelled distinctly for
                                that reason: two links both called "receipt"
                                would be worse than one.
                              */}
                              {proof.status === 'verified' && (
                                <button
                                  type="button"
                                  onClick={() => openReceipt(proof, { appearance, fmt })}
                                  className="text-xs font-semibold hover:underline"
                                  style={{ color: 'var(--primary)' }}
                                >
                                  Download receipt
                                </button>
                              )}
                            </span>
                          </div>
                          {/* The reason is the instruction — shown, not hidden. */}
                          {proof.status === 'rejected' && proof.rejection_reason && (
                            <p className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-800">
                              <span className="font-semibold">Reason: </span>{proof.rejection_reason}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Link to={`/finance/invoices/${row.invoice.id}`}>
                  <Button type="button" variant="secondary" size="sm">View invoice details</Button>
                </Link>
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This purchase has not been invoiced yet. You will be told when it is.
            </p>
          )}

          {/* ── Paperwork ── */}
          {(row.documents.length > 0 || row.property_documents.length > 0) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents</p>
              <ul className="mt-1 divide-y divide-slate-100">
                {row.documents.map((doc) => <DocumentRow key={`d-${doc.id}`} doc={doc} />)}
                {row.property_documents.map((doc) => <DocumentRow key={`p-${doc.id}`} doc={doc} />)}
              </ul>
              {row.property_documents.length > 0 && (
                <p className="mt-2 text-xs text-slate-400">
                  Property documents are shared for reading. Documents attached to your invoice are yours to download.
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

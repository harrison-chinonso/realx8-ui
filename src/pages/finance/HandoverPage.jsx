import { useCallback, useEffect, useMemo, useState } from 'react';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import FieldMark from '../../components/ui/FieldMark';
import DocumentUpload from '../../components/common/DocumentUpload';
import { useCurrency } from '../../context/useAppearance';
import { extractError } from '../../utils/extractError';
import {
  listHandovers, awaitingHandover, deferredRevenue,
  recordHandover, attachAcknowledgement, reverseHandover,
} from '../../api/accountingApi';

/**
 * Handover — when a sale becomes revenue.
 *
 * ── Why this screen exists at all ───────────────────────────────────────────
 *
 * For a unit sold off-plan on a 24-month plan, the invoice and the moment the
 * company has actually earned the money are years apart. Until this existed the
 * platform had only the invoice date to point at, so every revenue figure it
 * produced was really a figure about paperwork.
 *
 * ── The queue is the feature ────────────────────────────────────────────────
 *
 * "Waiting to be recognised" is a list of money the company has earned or is
 * about to, and nobody had it before. It leads, because it is the thing a
 * finance team will open this screen to see.
 *
 * ── Why the acknowledgement is asked for so insistently ─────────────────────
 *
 * It is the document an auditor asks for when they ask why revenue moved. A
 * handover can be recorded without it — the event happened — but revenue does
 * not move until it is attached. An optional evidence field is an empty
 * evidence field within a quarter.
 */

export default function HandoverPage() {
  const fmt = useCurrency();
  const show = useMemo(() => (minor) => fmt(Number(minor || 0) / 100), [fmt]);

  const [tab, setTab] = useState('awaiting');
  const [waiting, setWaiting] = useState([]);
  const [done, setDone] = useState([]);
  const [deferred, setDeferred] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [recording, setRecording] = useState(null);
  const [form, setForm] = useState({ handover_date: '', acknowledgement_url: '', notes: '' });
  const [attaching, setAttaching] = useState(null);
  const [attachUrl, setAttachUrl] = useState('');
  const [reversing, setReversing] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      const [w, d] = await Promise.all([awaitingHandover(), listHandovers()]);
      setWaiting(w);
      setDone(d);
    } catch (error) {
      setFailed(extractError(error, 'Could not load the handovers.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'deferred' || deferred) return;
    deferredRevenue().then(setDeferred).catch(() => setDeferred(null));
  }, [tab, deferred]);

  const act = async (fn, fallback) => {
    setBusy(true);
    setMessage('');
    setFailed('');
    try {
      const result = await fn();
      setMessage(result?.message || fallback);
      setDeferred(null);
      await load();
      return true;
    } catch (error) {
      setFailed(extractError(error, 'That could not be done.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /* A handover that posted nothing is the one somebody has to come back to. */
  const unrecognised = done.filter(
    (row) => row.status === 'recorded' && !Number(row.revenue_recognised_minor) && !row.acknowledgement_url,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Handovers</h1>
        <p className="text-sm text-slate-500">
          When control of a unit passes to the buyer. This is the moment the sale becomes revenue
          and the unit&apos;s share of what the project cost is charged against it — in one entry,
          because revenue and its cost move together or neither should.
        </p>
      </div>

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}
      {message && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}
      {unrecognised.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {unrecognised.length} handover{unrecognised.length === 1 ? '' : 's'} recorded without the
          buyer&apos;s signed acknowledgement. Revenue has not moved on any of them.
        </div>
      )}

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {[
          ['awaiting', `Waiting${waiting.length ? ` (${waiting.length})` : ''}`],
          ['done', 'Handed over'],
          ['deferred', 'Still deferred'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'awaiting' && (
        <Table
          columns={[
            { key: 'reference', label: 'Invoice' },
            { key: 'client_name', label: 'Buyer', render: (row) => row.client_name || `#${row.client_id}` },
            { key: 'property_name', label: 'Project', render: (row) => row.property_name || '—' },
            { key: 'unit_name', label: 'Unit', render: (row) => row.unit_name || '—' },
            {
              key: 'deferred_minor',
              label: 'Waiting to be earned',
              render: (row) => <span className="font-semibold">{show(row.deferred_minor)}</span>,
            },
          ]}
          data={waiting}
          loading={loading}
          exportName="awaiting-handover"
          emptyMessage="Nothing is waiting. Every sale with deferred revenue has been handed over."
          renderActions={(row) => (
            <Button
              size="sm"
              onClick={() => {
                setRecording(row);
                setForm({ handover_date: '', acknowledgement_url: '', notes: '' });
              }}
            >
              Hand over
            </Button>
          )}
        />
      )}

      {tab === 'done' && (
        <Table
          columns={[
            { key: 'reference', label: 'Handover' },
            { key: 'invoice_reference', label: 'Invoice', render: (row) => row.invoice_reference || '—' },
            { key: 'client_name', label: 'Buyer', render: (row) => row.client_name || '—' },
            { key: 'unit_name', label: 'Unit', render: (row) => row.unit_name || row.property_name || '—' },
            {
              key: 'handover_date',
              label: 'Date control passed',
              render: (row) => (row.handover_date ? new Date(row.handover_date).toLocaleDateString() : '—'),
            },
            {
              key: 'revenue_recognised_minor',
              label: 'Revenue',
              render: (row) => show(row.revenue_recognised_minor),
            },
            {
              key: 'cost_released_minor',
              label: 'Cost charged',
              render: (row) => show(row.cost_released_minor),
            },
            {
              key: 'status',
              label: 'State',
              render: (row) => {
                if (row.status === 'reversed') return <Badge value="reversed" tone="muted" />;
                if (!row.acknowledgement_url) return <Badge value="no signature" tone="warning" />;
                return <Badge value="recognised" tone="success" />;
              },
            },
          ]}
          data={done}
          loading={loading}
          exportName="handovers"
          emptyMessage="No handovers recorded."
          renderActions={(row) => (
            <div className="flex gap-1.5">
              {row.status === 'recorded' && !row.acknowledgement_url && (
                <Button size="sm" onClick={() => { setAttaching(row); setAttachUrl(''); }}>
                  Attach signature
                </Button>
              )}
              {row.status === 'recorded' && (
                <Button
                  size="sm" variant="secondary"
                  onClick={() => { setReversing(row); setReason(''); }}
                >
                  Reverse
                </Button>
              )}
            </div>
          )}
        />
      )}

      {tab === 'deferred' && (
        <>
          {/* Loaded AND non-zero — see DevelopmentCostPage for why. */}
          {deferred && Number(deferred.unexplained_minor) !== 0 && (
            <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {show(deferred.unexplained_minor)} sits in deferred revenue against something this
              report cannot see. The rows below should add up to the account.
            </div>
          )}
          <Table
            columns={[
              { key: 'reference', label: 'Invoice' },
              { key: 'client_name', label: 'Buyer', render: (row) => row.client_name || '—' },
              { key: 'property_name', label: 'Project', render: (row) => row.property_name || '—' },
              { key: 'unit_name', label: 'Unit', render: (row) => row.unit_name || '—' },
              { key: 'raised_minor', label: 'Deferred when invoiced', render: (row) => show(row.raised_minor) },
              { key: 'recognised_minor', label: 'Earned since', render: (row) => show(row.recognised_minor) },
              {
                key: 'deferred_minor',
                label: 'Still owed to the buyer in work',
                render: (row) => <span className="font-semibold">{show(row.deferred_minor)}</span>,
              },
            ]}
            data={deferred?.rows ?? []}
            exportName="deferred-revenue"
            emptyMessage="Nothing is deferred."
          />
          {deferred && (
            <p className="text-right text-sm text-slate-600">
              Total deferred <strong>{show(deferred.total_minor)}</strong>
            </p>
          )}
        </>
      )}

      {/* ── Record a handover ────────────────────────────────────────────── */}
      <Modal open={recording !== null} onClose={() => !busy && setRecording(null)} title="Hand the unit over" size="md">
        {recording && (
          <div className="space-y-3 text-sm">
            <p>
              {recording.unit_name || recording.property_name} to{' '}
              {recording.client_name || `client #${recording.client_id}`}.{' '}
              <strong>{show(recording.deferred_minor)}</strong> becomes revenue, and this
              unit&apos;s share of what the project cost is charged against it.
            </p>
            <Input
              label="Date control passed" type="date" required
              value={form.handover_date}
              onChange={(e) => setForm((c) => ({ ...c, handover_date: e.target.value }))}
            />
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              The date the keys changed hands, not today. A handover entered three weeks late still
              belongs to the month it happened in.
            </p>

            <div className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                The buyer&apos;s signed acknowledgement<FieldMark required />
              </span>
              <DocumentUpload
                value={form.acknowledgement_url}
                onChange={(url) => setForm((c) => ({ ...c, acknowledgement_url: url }))}
                label="Attach the signed acknowledgement"
              />
              <p className="text-xs text-slate-500">
                Revenue will not move without it. It is the document an auditor asks for when they
                ask why revenue moved — you can record the handover now and attach it later.
              </p>
            </div>

            <Input
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
            />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setRecording(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button" disabled={busy || !form.handover_date}
                onClick={async () => {
                  const ok = await act(
                    () => recordHandover({
                      invoice_id: recording.id,
                      property_unit_id: recording.property_unit_id || null,
                      handover_date: form.handover_date,
                      acknowledgement_url: form.acknowledgement_url || null,
                      notes: form.notes || null,
                    }),
                    'Recorded.',
                  );
                  if (ok) setRecording(null);
                }}
              >
                {busy ? 'Recording…' : 'Hand it over'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Attach the signature afterwards ──────────────────────────────── */}
      <Modal open={attaching !== null} onClose={() => !busy && setAttaching(null)} title="Attach the signed acknowledgement" size="sm">
        {attaching && (
          <div className="space-y-3 text-sm">
            <p>
              {attaching.reference} was recorded without it, so nothing has been recognised yet.
              Attaching it is what moves the revenue.
            </p>
            <DocumentUpload value={attachUrl} onChange={setAttachUrl} label="Choose the signed document" />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setAttaching(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button" disabled={busy || !attachUrl}
                onClick={async () => {
                  const ok = await act(
                    () => attachAcknowledgement(attaching.id, attachUrl),
                    'Attached.',
                  );
                  if (ok) setAttaching(null);
                }}
              >
                {busy ? 'Attaching…' : 'Attach it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Reverse ──────────────────────────────────────────────────────── */}
      <Modal open={reversing !== null} onClose={() => !busy && setReversing(null)} title="Reverse this handover" size="sm">
        {reversing && (
          <div className="space-y-3 text-sm">
            <p>
              {show(reversing.revenue_recognised_minor)} of revenue and{' '}
              {show(reversing.cost_released_minor)} of cost go back where they came from, by their
              own dated journal. Nothing is deleted.
            </p>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Why<FieldMark required /></span>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="The keys were not actually given."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setReversing(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button" variant="danger" disabled={busy || !reason.trim()}
                onClick={async () => {
                  const ok = await act(
                    () => reverseHandover(reversing.id, reason.trim()),
                    'Reversed.',
                  );
                  if (ok) setReversing(null);
                }}
              >
                {busy ? 'Reversing…' : 'Reverse it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

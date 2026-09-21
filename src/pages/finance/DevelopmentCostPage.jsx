import { useCallback, useEffect, useMemo, useState } from 'react';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';
import { useCurrency } from '../../context/useAppearance';
import { extractError } from '../../utils/extractError';
import {
  wipReport, projectCost, assessNrv, releaseCatchUp, writeDownProject,
  listCostTypes, createCostType, updateCostType, listCodingAccounts,
  saveAccountingPolicy,
} from '../../api/accountingApi';

/**
 * What a project cost, and where that cost is.
 *
 * ── The number a developer most wants ───────────────────────────────────────
 *
 * Gross margin per project and per unit. Every developer wants it; almost none
 * of them have it reliably, because it lives in a spreadsheet that somebody
 * updates when they remember. Once costs capitalise by project and release by
 * unit it falls out of the ledger instead, which is what this screen shows.
 *
 * ── Work in progress is not a number, it is four ────────────────────────────
 *
 * What went in, what came out at handover, what was written off, and what is
 * left. A single balance answers "how much is on the balance sheet" and
 * nothing else — and the questions people actually ask are about the other
 * three.
 *
 * ── Two things here post to the ledger, and neither is automatic ────────────
 *
 * Releasing a catch-up and writing a project down are both judgements. Each is
 * offered with the figure already computed and a reason required, because a
 * number somebody can type is a number somebody can choose, and both of these
 * go straight to profit.
 */

const money = (fmt) => (minor) => fmt(Number(minor || 0) / 100);

export default function DevelopmentCostPage() {
  const fmt = useCurrency();
  const show = useMemo(() => money(fmt), [fmt]);

  const [tab, setTab] = useState('projects');
  const [report, setReport] = useState(null);
  const [types, setTypes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [open, setOpen] = useState(null);
  const [nrv, setNrv] = useState(null);
  const [nrvValue, setNrvValue] = useState('');
  const [nrvNote, setNrvNote] = useState('');
  const [writing, setWriting] = useState(null);
  const [writeReason, setWriteReason] = useState('');
  const [editType, setEditType] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      setReport(await wipReport());
    } catch (error) {
      setFailed(extractError(error, 'Could not read what the projects have cost.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'types' || types.length) return;
    listCostTypes().then(setTypes).catch(() => setTypes([]));
    listCodingAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [tab, types.length]);

  const act = async (fn, success) => {
    setBusy(true);
    setMessage('');
    setFailed('');
    try {
      const result = await fn();
      setMessage(result?.message || success);
      await load();
      if (open) setOpen(await projectCost(open.property_id));
      return true;
    } catch (error) {
      setFailed(extractError(error, 'That could not be done.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const projects = report?.projects ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Project cost</h1>
        <p className="text-sm text-slate-500">
          What each development has cost so far, whose unit it belongs to, and what is still
          carried on the balance sheet. Every figure is read from the ledger.
        </p>
      </div>

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}
      {message && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}

      {/*
        The one discrepancy this screen exists to catch: cost posted to work in
        progress with no project on the line belongs to nobody and can never be
        released. Better said here than found at a year end.
      */}
      {/*
        `Number(undefined)` is NaN and NaN !== 0 is TRUE, so testing the
        figure alone showed this warning before the report had loaded — and
        then read a property off null. The condition has to be that the
        report EXISTS and the figure is non-zero, which is what it meant.
      */}
      {report && report.unassigned_minor !== 0 && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {show(report.unassigned_minor)} is in work in progress against no project, so nothing
          will ever release it. Find it in the journal and recode it.
        </div>
      )}
      {Number(report?.catch_up_minor) > 0 && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {show(report.catch_up_minor)} of cost landed after units had already been handed over.
          Open the project to charge it.
        </div>
      )}

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {[['projects', 'Projects'], ['types', 'Kinds of cost']].map(([key, label]) => (
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

      {tab === 'projects' && (
        <Table
          columns={[
            { key: 'property_name', label: 'Project', render: (row) => row.property_name || `#${row.property_id}` },
            {
              key: 'capitalised',
              label: 'Capitalised',
              render: (row) => show(row.movements.capitalised_minor),
            },
            { key: 'released', label: 'Charged out', render: (row) => show(row.movements.released_minor) },
            {
              key: 'written',
              label: 'Written down',
              render: (row) => (row.movements.written_down_minor
                ? <span className="text-danger">{show(row.movements.written_down_minor)}</span>
                : '—'),
            },
            {
              key: 'balance',
              label: 'Still carried',
              render: (row) => <span className="font-semibold">{show(row.movements.balance_minor)}</span>,
            },
            {
              key: 'basis',
              label: 'Divided by',
              render: (row) => (
                <Badge
                  value={row.basis === 'sales_value' ? 'sales value' : 'saleable area'}
                  tone="muted"
                />
              ),
            },
            {
              key: 'flags',
              label: '',
              render: (row) => (
                <div className="flex flex-col gap-1 text-xs">
                  {row.catch_up_minor > 0 && (
                    <span className="text-amber-700">{show(row.catch_up_minor)} to charge out</span>
                  )}
                  {row.unallocated_minor > 0 && (
                    <span className="text-amber-700">no unit sizes — nothing allocable</span>
                  )}
                  {row.nrv_shortfall_minor > 0 && (
                    <span className="text-danger">{show(row.nrv_shortfall_minor)} above what it will fetch</span>
                  )}
                </div>
              ),
            },
          ]}
          data={projects}
          loading={loading}
          exportName="development-cost"
          emptyMessage="No project carries any development cost yet. A bill of a capitalisable kind, coded to a project, is what starts one."
          renderActions={(row) => (
            <Button size="sm" variant="secondary" onClick={() => setOpen(row)}>Open</Button>
          )}
        />
      )}

      {tab === 'types' && (
        <>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditType({ name: '', capitalisable: false, note: '' })}>
              Add a kind
            </Button>
          </div>
          <p className="rounded-lg bg-slate-50 px-4 py-2 text-xs text-slate-600">
            A build cost belongs to the unit and sits on the balance sheet until the unit is handed
            over. Selling, administration and general financing are the cost of running the company
            and belong to the year they happened in — IAS 2 is explicit about it. Changing a kind
            affects bills raised from then on; bills already posted keep what they posted with.
          </p>
          <Table
            columns={[
              { key: 'name', label: 'Kind' },
              {
                key: 'capitalisable',
                label: 'Treatment',
                render: (row) => (
                  <Badge
                    value={row.capitalisable ? 'build cost' : 'this year'}
                    tone={row.capitalisable ? 'info' : 'muted'}
                  />
                ),
              },
              { key: 'note', label: 'Why', render: (row) => <span className="text-xs text-slate-500">{row.note || '—'}</span> },
              {
                key: 'is_active',
                label: 'In use',
                render: (row) => (row.is_active ? 'Yes' : 'No'),
              },
            ]}
            data={types}
            exportName="cost-types"
            emptyMessage="No kinds of cost yet."
            renderActions={(row) => (
              <Button size="sm" variant="secondary" onClick={() => setEditType(row)}>Edit</Button>
            )}
          />
        </>
      )}

      {/* ── One project ──────────────────────────────────────────────────── */}
      <Modal open={open !== null} onClose={() => !busy && setOpen(null)} title={open?.property_name || 'Project'} size="lg">
        {open && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Capitalised', open.movements.capitalised_minor],
                ['Charged out', open.movements.released_minor],
                ['Written down', open.movements.written_down_minor],
                ['Still carried', open.movements.balance_minor],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="font-semibold text-slate-800">{show(value)}</div>
                </div>
              ))}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
                Per unit, divided by {open.basis === 'sales_value' ? 'sales value' : 'saleable area'}
              </h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Unit</th>
                      <th className="px-3 py-2 text-right">Weight</th>
                      <th className="px-3 py-2 text-right">Allocated</th>
                      <th className="px-3 py-2 text-right">Charged out</th>
                      <th className="px-3 py-2 text-left">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.units.map((unit) => (
                      <tr key={unit.unit_id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{unit.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{unit.weight || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{show(unit.allocated_minor)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{show(unit.released_minor)}</td>
                        <td className="px-3 py-2">
                          {unit.handed_over
                            ? (
                              <span className={unit.outstanding_minor > 0 ? 'text-amber-700' : 'text-slate-500'}>
                                handed over
                                {unit.outstanding_minor > 0 ? ` · ${show(unit.outstanding_minor)} to charge` : ''}
                              </span>
                            )
                            : <span className="text-slate-400">held</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {open.unallocated_minor > 0 && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {show(open.unallocated_minor)} cannot be allocated: no unit on this project has a
                  size recorded. Nothing is spread evenly, because an even split would be an
                  invented answer.
                </p>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {open.policy.nrv_proceeds_minor == null
                ? 'Nobody has said what this project is now expected to fetch, so no write-down test has been made.'
                : `Expected to fetch ${show(open.policy.nrv_proceeds_minor)}${open.policy.nrv_note ? ` — ${open.policy.nrv_note}` : ''}.`}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              <Select
                className="h-9 w-auto"
                value={open.basis}
                onChange={async (e) => {
                  await act(
                    () => saveAccountingPolicy({
                      scope: 'property',
                      property_id: open.property_id,
                      revenue_recognition: open.policy.revenue_recognition,
                      cost_allocation_basis: e.target.value,
                    }),
                    'Cost now divides differently. Units already handed over keep what was charged.',
                  );
                }}
              >
                <option value="saleable_area">Divide by saleable area</option>
                <option value="sales_value">Divide by sales value</option>
              </Select>
              <Button
                size="sm" variant="secondary" disabled={busy}
                onClick={() => {
                  setNrv(open);
                  setNrvValue(open.policy.nrv_proceeds_minor != null
                    ? String(Number(open.policy.nrv_proceeds_minor) / 100) : '');
                  setNrvNote(open.policy.nrv_note || '');
                }}
              >
                What will it fetch?
              </Button>
              {open.catch_up_minor > 0 && (
                <Button
                  size="sm" disabled={busy}
                  onClick={() => act(
                    () => releaseCatchUp(open.property_id, {}),
                    'Charged to cost of sales.',
                  )}
                >
                  Charge out {show(open.catch_up_minor)}
                </Button>
              )}
              {open.nrv_shortfall_minor > 0 && (
                <Button
                  size="sm" variant="danger" disabled={busy}
                  onClick={() => { setWriting(open); setWriteReason(''); }}
                >
                  Write down {show(open.nrv_shortfall_minor)}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── What will it fetch ───────────────────────────────────────────── */}
      <Modal open={nrv !== null} onClose={() => !busy && setNrv(null)} title="What the project will fetch" size="sm">
        {nrv && (
          <div className="space-y-3 text-sm">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Net of what it will still cost to finish and to sell. A project carried above this
              figure is written down to it — IAS 2 carries inventory at the lower of cost and what
              it will fetch, and for a stalled or repriced estate that is not theoretical.
            </p>
            <Input
              label="Expected proceeds, net" type="number" step="0.01" min="0"
              value={nrvValue}
              onChange={(e) => setNrvValue(e.target.value)}
            />
            <Input
              label="What changed"
              value={nrvNote}
              onChange={(e) => setNrvNote(e.target.value)}
              placeholder="Repriced after the road scheme moved"
            />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setNrv(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button" disabled={busy || !String(nrvValue).trim()}
                onClick={async () => {
                  const ok = await act(
                    () => assessNrv(nrv.property_id, {
                      nrv_proceeds_minor: Math.round(Number(nrvValue) * 100),
                      note: nrvNote.trim() || null,
                    }),
                    'Recorded.',
                  );
                  if (ok) setNrv(null);
                }}
              >
                {busy ? 'Saving…' : 'Record it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Write down ───────────────────────────────────────────────────── */}
      <Modal open={writing !== null} onClose={() => !busy && setWriting(null)} title="Write the project down" size="sm">
        {writing && (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{show(writing.nrv_shortfall_minor)}</strong> comes off the balance sheet and
              is charged as a loss on this project.
            </p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              It is charged to its own account rather than to the cost of units sold, so that a bad
              project and an expensive one do not read the same — and because the amount written
              down in a period is a disclosure in its own right.
            </p>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Why<FieldMark required /></span>
              <textarea
                rows={3}
                value={writeReason}
                onChange={(e) => setWriteReason(e.target.value)}
                placeholder="Repriced after the road scheme moved"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setWriting(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button" variant="danger" disabled={busy || !writeReason.trim()}
                onClick={async () => {
                  const ok = await act(
                    () => writeDownProject(writing.property_id, { reason: writeReason.trim() }),
                    'Written down.',
                  );
                  if (ok) setWriting(null);
                }}
              >
                {busy ? 'Posting…' : 'Write it down'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── A kind of cost ───────────────────────────────────────────────── */}
      <Modal
        open={editType !== null}
        onClose={() => !busy && setEditType(null)}
        title={editType?.id ? 'Edit this kind of cost' : 'Add a kind of cost'}
        size="md"
      >
        {editType && (
          <div className="space-y-3 text-sm">
            <Input
              label="Name" required
              value={editType.name}
              onChange={(e) => setEditType((c) => ({ ...c, name: e.target.value }))}
            />
            <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={Boolean(editType.capitalisable)}
                onChange={(e) => setEditType((c) => ({ ...c, capitalisable: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-600"
              />
              <span className="text-sm text-slate-700">
                This is part of what a unit cost to build
                <span className="block text-xs text-slate-500">
                  It goes onto the balance sheet as work in progress and is charged against the sale
                  when the unit is handed over. A bill of this kind must be coded to a project.
                </span>
              </span>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Code it to<FieldMark /></span>
              <Select
                value={editType.account_id || ''}
                onChange={(e) => setEditType((c) => ({ ...c, account_id: e.target.value }))}
              >
                <option value="">Nothing — code each bill by hand</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </Select>
            </label>
            <Input
              label="A note for whoever raises the bill"
              value={editType.note || ''}
              onChange={(e) => setEditType((c) => ({ ...c, note: e.target.value }))}
            />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setEditType(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button" disabled={busy || !String(editType.name).trim()}
                onClick={async () => {
                  const payload = {
                    name: editType.name.trim(),
                    capitalisable: Boolean(editType.capitalisable),
                    account_id: editType.account_id || null,
                    note: editType.note || null,
                  };
                  setBusy(true);
                  setFailed('');
                  try {
                    const result = editType.id
                      ? await updateCostType(editType.id, payload)
                      : await createCostType(payload);
                    setMessage(result?.message || 'Saved.');
                    setTypes(await listCostTypes());
                    setEditType(null);
                  } catch (error) {
                    setFailed(extractError(error, 'That could not be saved.'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

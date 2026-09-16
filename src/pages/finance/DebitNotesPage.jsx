import { useEffect, useState } from 'react';
import { listDebitNotes, createDebitNote, updateDebitNote, listTaxes } from '../../api/financeApi';
import PartySelect from '../../components/finance/PartySelect';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import NoteApprovalActions from '../../components/finance/NoteApprovalActions';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import MoneyInput from '../../components/ui/MoneyInput';
import { useCurrency } from '../../context/useAppearance';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';

const EMPTY_FORM = {
  debit_note_id: '',
  client_id: '',
  party_type: 'client',
  amount: '',
  tax_id: '',
  description: '',
};

/**
 * How each state reads to a person.
 *
 * The raw values are for the database. "pending_approval" on a screen makes a
 * reader translate; "Waiting for approval" tells them what is happening and who
 * it is waiting on.
 */
const STATUS_LABELS = {
  pending_approval: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Refused',
  paid: 'Paid out',
  cancelled: 'Cancelled',
  draft: 'Draft',
  sent: 'Sent',
  partial: 'Part paid',
};
const statusLabel = (status) => STATUS_LABELS[status] || status || '—';

/**
 * The page opens on what is WAITING, not on everything ever raised.
 *
 * An approver's question is "what needs me", and a flat list in id order
 * answers a different one — they have to read every row to find the two that
 * matter. Each tab also says what an empty one MEANS: the table's own default
 * is "No data available", which on a queue reads as a loading failure rather
 * than as the good news that there is nothing to do.
 */
const TABS = [
  { key: 'pending_approval', label: 'Waiting for approval', empty: 'Nothing is waiting for approval.' },
  { key: 'approved', label: 'Approved', empty: 'Nothing has been approved yet.' },
  { key: 'rejected', label: 'Refused', empty: 'Nothing has been refused.' },
  { key: 'paid', label: 'Paid out', empty: 'Nothing has been settled yet.' },
  { key: 'all', label: 'All', empty: 'No debit notes have been raised yet.' },
];

const getItems = (response) => response?.data ?? response ?? [];
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

export default function DebitNotesPage() {
  const fmt = useCurrency();
  const [items, setItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('pending_approval');

  const load = async () => {
    setLoading(true);
    try {
      const res = await listDebitNotes();
      setItems(getItems(res));
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    listTaxes().then((res) => setTaxes(getItems(res))).catch(() => setTaxes([]));
  }, []);

  const openCreate = () => {
    setEditing({});
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      debit_note_id: row.debit_note_id || '',
      client_id: row.client_id ?? '',
      party_type: row.party_type ?? 'client',
      amount: row.amount ?? '',
      tax_id: row.tax_id ?? '',
      status: row.status || 'draft',
      description: row.reason || row.description || '',
    });
  };

  const closeModal = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        client_id: Number(form.client_id),
        party_type: form.party_type || 'client',
        amount: Number(form.amount),
        tax_id: form.tax_id ? Number(form.tax_id) : null,
        status: form.status,
        reason: form.description.trim() || null,
      };

      if (editing?.id) await updateDebitNote(editing.id, payload);
      else await createDebitNote(payload);

      await load();
      closeModal();
    } catch {
      alert('Failed to save debit note.');
    } finally {
      setSaving(false);
    }
  };


  const getTaxLabel = (row) => {
    const tax = row.tax || taxes.find((item) => item.id === row.tax_id);
    return tax ? `${tax.name} (${tax.rate}%)` : '—';
  };

  const columns = [
    { header: 'Debit Note #', accessor: 'debit_note_id' },
    {
      header: 'Raised against',
      accessor: 'client_id',
      render: (row) => (
        <span>
          {row.party_name || `#${row.client_id ?? '—'}`}
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
            {row.party_type || 'client'}
          </span>
        </span>
      ),
    },
    { header: 'Amount', render: (row) => fmt(Number(row.amount || 0)) },
    { header: 'Status', render: (row) => <Badge value={row.status} /> },
    { header: 'Tax', render: getTaxLabel },
    { header: 'Created At', render: (row) => formatDate(row.createdAt || row.created_at) },
  ];

  const countFor = (key) => (key === 'all' ? items.length : items.filter((row) => row.status === key).length);
  const active = TABS.find((entry) => entry.key === tab) || TABS[0];
  const visible = tab === 'all' ? items : items.filter((row) => row.status === tab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Debit Notes</h1>
        <Button onClick={openCreate}>+ New Debit Note</Button>
      </div>

      {/* Wraps rather than scrolls, so no tab can be pushed out of sight. */}
      <div className="flex flex-wrap border-b border-slate-200">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === entry.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {entry.label}
            {countFor(entry.key) > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {countFor(entry.key)}
              </span>
            )}
          </button>
        ))}
      </div>
      <Table
        columns={columns}
        data={visible}
        loading={loading}
        emptyMessage={active.empty}
        renderActions={(row) => (
          <div className="flex items-center justify-end gap-2">
            {/*
              Editable only while it is still waiting. Once somebody has
              approved or refused it, what they signed off on has to stay the
              thing that was signed off on — an edit afterwards would change the
              amount under an approval that had already been given.
            */}
            {row.status === 'pending_approval' && (
              <Button onClick={() => openEdit(row)} variant="primary" size="sm">Edit</Button>
            )}
            <NoteApprovalActions kind="debit" note={row} onChanged={load} />
          </div>
        )}
      />
      <Modal open={editing !== null} onClose={closeModal} title={`${editing?.id ? 'Edit' : 'New'} Debit Note`}>
        <form onSubmit={handleSave} className="space-y-3">
          {/*
            The number is assigned by the server, not typed.

            It has to be unique within the company, and only the database can
            guarantee that against two people saving at once — so asking for it
            here offered a value that was discarded on create and could clash
            on edit. Existing notes show theirs; a new one says where it comes
            from.
          */}
          <div className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">Debit Note #</span>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {form.debit_note_id || 'Assigned automatically when you save'}
            </p>
          </div>
          <PartySelect
            partyType={form.party_type}
            userId={form.client_id}
            onChange={(next) => setForm((f) => ({ ...f, ...next }))}
            required
          />
          <MoneyInput label="Amount" value={form.amount} onChange={(amount) => setForm((current) => ({ ...current, amount }))} required />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Tax<FieldMark /></span>
            <Select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={form.tax_id}
              onChange={handleChange('tax_id')}
            >
              <option value="">No tax</option>
              {taxes.map((tax) => (
                <option key={tax.id} value={tax.id}>
                  {tax.name} ({tax.rate}%)
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Description<FieldMark /></span>
            <textarea
              rows={4}
              value={form.description}
              onChange={handleChange('description')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          {/*
            Said before they save, not after. Somebody who expects the note to
            take effect immediately needs to know it will not, and finding that
            out from a status badge afterwards is finding it out too late.
          */}
          {!editing?.id && (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              This goes to an approver before it can be paid out.
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

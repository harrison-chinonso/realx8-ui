import { useEffect, useState } from 'react';
import { listPaymentReminders, createPaymentReminder, updatePaymentReminder, listInvoices } from '../../api/financeApi';
import { listClients } from '../../api/userApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import EntitySearchSelect from '../../components/common/EntitySearchSelect';
import Select from '../../components/ui/Select';
import ReminderSchedulePanel from '../../components/finance/ReminderSchedulePanel';
import FieldMark from '../../components/ui/FieldMark';

const EMPTY_FORM = {
  invoice_id: '',
  client_id: '',
  reminder_date: '',
  status: 'pending',
};

const STATUS_OPTIONS = ['pending', 'sent', 'cancelled'];

const getItems = (response) => response?.data ?? response ?? [];
const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export default function PaymentRemindersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listPaymentReminders();
      setItems(getItems(res));
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);


  const openEdit = (row) => {
    setEditing(row);
    setForm({
      invoice_id: row.invoice_id ?? '',
      client_id: row.client_id ?? '',
      reminder_date: row.reminder_date ? String(row.reminder_date).slice(0, 10) : '',
      status: row.status || 'pending',
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
        invoice_id: Number(form.invoice_id),
        client_id: Number(form.client_id),
        reminder_date: form.reminder_date,
        status: form.status,
      };

      if (editing?.id) await updatePaymentReminder(editing.id, payload);
      else await createPaymentReminder(payload);

      await load();
      closeModal();
    } catch {
      alert('Failed to save payment reminder.');
    } finally {
      setSaving(false);
    }
  };


  const columns = [
    { header: 'Invoice ID', accessor: 'invoice_id' },
    { header: 'Client ID', accessor: 'client_id' },
    { header: 'Reminder Date', render: (row) => formatDate(row.reminder_date) },
    { header: 'Status', render: (row) => <Badge value={row.status} /> },
  ];

  return (
    <div className="space-y-4">
      {/*
        The RULES come first, because they are what decides when almost every
        buyer hears from the company. The list below is the exceptions — a
        one-off reminder somebody scheduled by hand.
      */}
      <ReminderSchedulePanel />

      <div>
        <h1 className="text-xl font-bold text-slate-800">Reminders already scheduled</h1>
        {/*
          Reminders are raised by the schedule above, not typed in one at a
          time. This list is the record of what it has queued and sent — the
          heading says so, because a bare "Payment Reminders" over a table with
          no way to add to it reads as a broken screen rather than a log.
        */}
        <p className="text-sm text-slate-500">
          Raised automatically from the schedule above. Edit one to change or cancel it.
        </p>
      </div>
      <Table
      /*
        This page has its own search box, which filters on the SERVER and
        therefore searches every row rather than the page in view. The
        table's built-in search would sit beside it searching only the
        loaded rows — two boxes, different answers.
      */
      searchable={false}
        columns={columns}
        data={items}
        loading={loading}
        renderActions={(row) => (
          <div className="flex justify-end gap-3">
            <Button onClick={() => openEdit(row)} variant="primary" size="sm">Edit</Button>
          </div>
        )}
      />
      <Modal open={editing !== null} onClose={closeModal} title="Edit Payment Reminder">
        <form onSubmit={handleSave} className="space-y-3">
          <EntitySearchSelect
            label="Client"
            placeholder="Search client by name…"
            value={form.client_id}
            onChange={(id) => setForm((f) => ({ ...f, client_id: id }))}
            fetchItems={() => listClients({ limit: 1000 })}
            getLabel={(c) => c.name || c.email || `Client #${c.id}`}
            required
          />
          <EntitySearchSelect
            label="Invoice"
            placeholder="Search invoice by ID…"
            value={form.invoice_id}
            onChange={(id) => setForm((f) => ({ ...f, invoice_id: id }))}
            fetchItems={() => listInvoices({ limit: 1000 })}
            getLabel={(inv) => inv.invoice_id || `Invoice #${inv.id}`}
            required
          />
          <Input label="Reminder Date" type="date" value={form.reminder_date} onChange={handleChange('reminder_date')} required />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Status<FieldMark /></span>
            <Select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={form.status}
              onChange={handleChange('status')}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

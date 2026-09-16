import { useEffect, useMemo, useState } from 'react';
import { createAlert, createCommunication, createVipClient, listAlerts, listCommunications, listVipClients, updateVipClient } from '../../api/careApi';
import { listClients } from '../../api/userApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import MoneyInput from '../../components/ui/MoneyInput';
import { useCurrency } from '../../context/useAppearance';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';

const tabs = [
  { id: 'vip', label: 'VIP Clients' },
  { id: 'communications', label: 'Communications Log' },
  { id: 'alerts', label: 'Scheduled Alerts' },
];

const messageTypes = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'festival', label: 'Festival' },
  { value: 'maturity', label: 'Maturity Alert' },
  { value: 'balance', label: 'Balance Reminder' },
  { value: 'custom', label: 'Custom' },
];

const alertTypes = messageTypes.filter((item) => item.value !== 'custom');
const toList = (response) => response?.data || [];
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '—');
const preview = (value) => value ? `${String(value).slice(0, 60)}${String(value).length > 60 ? '…' : ''}` : '—';

const emptyVipForm = {
  client_id: '',
  client_name: '',
  email: '',
  phone: '',
  total_amount: '',
  investment_count: '',
  status: 'active',
  notes: '',
};

const emptyCommunicationForm = {
  client_name: '',
  type: 'birthday',
  message: '',
  mode: 'now',
  scheduled_at: '',
};

const emptyAlertForm = {
  client_name: '',
  alert_type: 'birthday',
  trigger_date: '',
  message: '',
};

/**
 * `section` comes from the route rather than local state so each Customer Care
 * menu item is a real destination. They previously all pointed at /care and
 * landed on VIP Clients, which is why the menu looked broken.
 */
export default function CustomerCarePage({ section = 'vip' }) {
  const fmt = useCurrency();
  const [tab, setTab] = useState(section);

  // Follow the route when the user moves between menu items.
  useEffect(() => { setTab(section); }, [section]);
  const [vipClients, setVipClients] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vipTier, setVipTier] = useState('');
  const [communicationFilter, setCommunicationFilter] = useState({ type: '', date: '' });
  const [showVipModal, setShowVipModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [vipForm, setVipForm] = useState(emptyVipForm);
  const [communicationForm, setCommunicationForm] = useState(emptyCommunicationForm);
  const [alertForm, setAlertForm] = useState(emptyAlertForm);
  const [vipDetailRow, setVipDetailRow] = useState(null);
  const [selectedVip, setSelectedVip] = useState(null);
  const [editingVip, setEditingVip] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vipResponse, communicationResponse, alertResponse, clientResponse] = await Promise.all([
        listVipClients({ limit: 200 }),
        listCommunications({ limit: 200 }),
        listAlerts({ limit: 200 }),
        listClients({ limit: 200 }),
      ]);
      setVipClients(toList(vipResponse));
      setCommunications(toList(communicationResponse));
      setAlerts(toList(alertResponse));
      setClients(toList(clientResponse));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredVipClients = useMemo(
    () => vipClients.filter((client) => !vipTier || client.tier === vipTier),
    [vipClients, vipTier]
  );

  const filteredCommunications = useMemo(
    () => communications.filter((item) => {
      const matchesType = !communicationFilter.type || item.type === communicationFilter.type;
      const rawDate = item.sent_at || item.scheduled_at;
      const matchesDate = !communicationFilter.date || (rawDate && new Date(rawDate).toISOString().slice(0, 10) === communicationFilter.date);
      return matchesType && matchesDate;
    }),
    [communicationFilter.date, communicationFilter.type, communications]
  );

  const vipColumns = [
    { key: 'client_name', label: 'Name' },
    { key: 'email', label: 'Email', render: (row) => row.email || '—' },
    { key: 'tier', label: 'VIP Tier', render: (row) => <Badge value={row.tier} /> },
    { key: 'total_amount', label: 'Total Investment Amount', render: (row) => fmt(row.total_amount || 0) },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
  ];

  const vipDetailFields = [
    { label: 'Client Name', key: 'client_name' },
    { label: 'Email', render: (row) => row.email || '—' },
    { label: 'Phone', render: (row) => row.phone || '—' },
    { label: 'VIP Tier', render: (row) => <Badge value={row.tier} /> },
    { label: 'Total Amount', render: (row) => fmt(row.total_amount || 0) },
    { label: 'Investment Count', render: (row) => row.investment_count ?? '—' },
    { label: 'Status', render: (row) => <Badge value={row.status} /> },
    { label: 'Notes', key: 'notes' },
  ];

  const communicationColumns = [
    { key: 'client_name', label: 'Client Name' },
    {
      key: 'type',
      label: 'Type',
      render: (row) => messageTypes.find((item) => item.value === row.type)?.label || row.type,
    },
    { key: 'message', label: 'Message Preview', render: (row) => preview(row.message) },
    { key: 'sent_at', label: 'Sent At', render: (row) => formatDateTime(row.sent_at || row.scheduled_at) },
    { key: 'delivery_status', label: 'Delivery Status', render: (row) => <Badge value={row.delivery_status} /> },
  ];

  const alertColumns = [
    { key: 'client_name', label: 'Client Name' },
    {
      key: 'alert_type',
      label: 'Alert Type',
      render: (row) => alertTypes.find((item) => item.value === row.alert_type)?.label || row.alert_type,
    },
    { key: 'trigger_date', label: 'Trigger Date', render: (row) => row.trigger_date ? new Date(`${row.trigger_date}T00:00:00`).toLocaleDateString() : '—' },
    { key: 'message', label: 'Message', render: (row) => preview(row.message) },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
  ];

  const pickClient = (clientId, setter, state) => {
    const match = clients.find((client) => String(client.id) === String(clientId));
    setter({
      ...state,
      client_id: clientId,
      client_name: match?.name || state.client_name,
      email: match?.email || '',
      phone: match?.phone || '',
    });
  };

  const openVipModal = (vipClient = null) => {
    setEditingVip(vipClient);
    setVipForm(vipClient ? {
      client_id: vipClient.client_id ? String(vipClient.client_id) : '',
      client_name: vipClient.client_name || '',
      email: vipClient.email || '',
      phone: vipClient.phone || '',
      total_amount: vipClient.total_amount || '',
      investment_count: vipClient.investment_count || '',
      status: vipClient.status || 'active',
      notes: vipClient.notes || '',
    } : emptyVipForm);
    setShowVipModal(true);
  };

  const submitVip = async (event) => {
    event.preventDefault();
    const payload = {
      client_id: vipForm.client_id || null,
      client_name: vipForm.client_name,
      email: vipForm.email,
      phone: vipForm.phone,
      total_amount: Number(vipForm.total_amount || 0),
      investment_count: Number(vipForm.investment_count || 0),
      status: vipForm.status,
      notes: vipForm.notes,
    };
    if (editingVip) {
      await updateVipClient(editingVip.id, payload);
    } else {
      await createVipClient(payload);
    }
    setShowVipModal(false);
    setEditingVip(null);
    setVipForm(emptyVipForm);
    loadData();
  };

  const submitCommunication = async (event) => {
    event.preventDefault();
    await createCommunication({
      client_name: communicationForm.client_name,
      type: communicationForm.type,
      message: communicationForm.message,
      send_now: communicationForm.mode === 'now',
      scheduled_at: communicationForm.mode === 'schedule' ? communicationForm.scheduled_at : null,
    });
    setShowCommunicationModal(false);
    setCommunicationForm(emptyCommunicationForm);
    loadData();
  };

  const submitAlert = async (event) => {
    event.preventDefault();
    await createAlert(alertForm);
    setShowAlertModal(false);
    setAlertForm(emptyAlertForm);
    loadData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customer Care</h1>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {tabs.map((item) => (
            <Button key={item.id} variant={tab === item.id ? 'primary' : 'secondary'} size="sm" onClick={() => setTab(item.id)}>
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {tab === 'vip' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Filter by tier<FieldMark /></label>
              <Select value={vipTier} onChange={(event) => setVipTier(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                <option value="">All tiers</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
              </Select>
            </div>
            <Button onClick={() => openVipModal()}>+ Add VIP Client</Button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading VIP clients...</p>
          ) : (
            <Table
              columns={vipColumns}
              data={filteredVipClients}
              renderActions={(row) => (
                <div className="flex justify-end gap-3">
                  <Button onClick={() => { setSelectedVip(row); setShowProfileModal(true); }} variant="primary" size="sm">View Profile</Button>
                  <Button onClick={() => openVipModal(row)} variant="secondary" size="sm">Edit</Button>
                  <ActionsMenu items={[{ label: '👁 View Details', onClick: () => setVipDetailRow(row) }]} />
                </div>
              )}
            />
          )}
        </div>
      )}

      <DetailsModal
        open={!!vipDetailRow}
        onClose={() => setVipDetailRow(null)}
        title={vipDetailRow?.client_name || 'VIP Client Details'}
        record={vipDetailRow}
        fields={vipDetailFields}
      />

      {tab === 'communications' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Filter by type<FieldMark /></label>
                <Select value={communicationFilter.type} onChange={(event) => setCommunicationFilter((current) => ({ ...current, type: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="">All types</option>
                  {messageTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Filter by date<FieldMark /></label>
                <input type="date" value={communicationFilter.date} onChange={(event) => setCommunicationFilter((current) => ({ ...current, date: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
            <Button onClick={() => setShowCommunicationModal(true)}>+ Send Message</Button>
          </div>

          {loading ? <p className="text-sm text-slate-500">Loading communications...</p> : <Table columns={communicationColumns} data={filteredCommunications} />}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div>
              <h2 className="font-semibold text-slate-800">Scheduled Alerts</h2>
              <p className="text-sm text-slate-500">Manage upcoming customer reminders and care touchpoints.</p>
            </div>
            <Button onClick={() => setShowAlertModal(true)}>+ Create Alert</Button>
          </div>

          {loading ? <p className="text-sm text-slate-500">Loading alerts...</p> : <Table columns={alertColumns} data={alerts} />}
        </div>
      )}

      <Modal open={showVipModal} onClose={() => setShowVipModal(false)} title={editingVip ? 'Edit VIP Client' : 'Add VIP Client'}>
        <form onSubmit={submitVip} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Select Client<FieldMark /></span>
            <Select value={vipForm.client_id} onChange={(event) => pickClient(event.target.value, setVipForm, vipForm)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              <option value="">Custom client entry</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.email})</option>)}
            </Select>
          </label>
          <Input label="Client Name" value={vipForm.client_name} onChange={(event) => setVipForm((current) => ({ ...current, client_name: event.target.value }))} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Email" type="email" value={vipForm.email} onChange={(event) => setVipForm((current) => ({ ...current, email: event.target.value }))} />
            <Input label="Phone" value={vipForm.phone} onChange={(event) => setVipForm((current) => ({ ...current, phone: event.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyInput label="Total Investment Amount" value={vipForm.total_amount} onChange={(total_amount) => setVipForm((current) => ({ ...current, total_amount }))} required />
            <Input label="Investment Count" type="number" min="0" value={vipForm.investment_count} onChange={(event) => setVipForm((current) => ({ ...current, investment_count: event.target.value }))} required />
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Status<FieldMark /></span>
            <Select value={vipForm.status} onChange={(event) => setVipForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Notes<FieldMark /></span>
            <textarea rows={3} value={vipForm.notes} onChange={(event) => setVipForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit">{editingVip ? 'Save Changes' : 'Save VIP Client'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowVipModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showProfileModal} onClose={() => setShowProfileModal(false)} title="VIP Client Profile">
        {selectedVip && (
          <div className="space-y-3 text-sm text-slate-700">
            <div><span className="font-medium">Name:</span> {selectedVip.client_name}</div>
            <div><span className="font-medium">Email:</span> {selectedVip.email || '—'}</div>
            <div><span className="font-medium">Phone:</span> {selectedVip.phone || '—'}</div>
            <div><span className="font-medium">Total Investment:</span> {fmt(selectedVip.total_amount || 0)}</div>
            <div><span className="font-medium">Investment Count:</span> {selectedVip.investment_count || 0}</div>
            <div><span className="font-medium">Tier:</span> <Badge value={selectedVip.tier} /></div>
            <div><span className="font-medium">Status:</span> <Badge value={selectedVip.status} /></div>
            <div><span className="font-medium">Notes:</span> {selectedVip.notes || '—'}</div>
          </div>
        )}
      </Modal>

      <Modal open={showCommunicationModal} onClose={() => setShowCommunicationModal(false)} title="Send Message">
        <form onSubmit={submitCommunication} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Select Client<FieldMark required /></span>
            <Select value={communicationForm.client_name} onChange={(event) => setCommunicationForm((current) => ({ ...current, client_name: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" required>
              <option value="">Choose client</option>
              {clients.map((client) => <option key={client.id} value={client.name}>{client.name}</option>)}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Message Type<FieldMark /></span>
            <Select value={communicationForm.type} onChange={(event) => setCommunicationForm((current) => ({ ...current, type: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              {messageTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Message Body<FieldMark required /></span>
            <textarea rows={4} value={communicationForm.message} onChange={(event) => setCommunicationForm((current) => ({ ...current, message: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" required />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Delivery<FieldMark /></span>
            <Select value={communicationForm.mode} onChange={(event) => setCommunicationForm((current) => ({ ...current, mode: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              <option value="now">Send Now</option>
              <option value="schedule">Schedule</option>
            </Select>
          </label>
          {communicationForm.mode === 'schedule' && <Input label="Scheduled At" type="datetime-local" value={communicationForm.scheduled_at} onChange={(event) => setCommunicationForm((current) => ({ ...current, scheduled_at: event.target.value }))} required />}
          <div className="flex gap-2 pt-2">
            <Button type="submit">Save Message</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCommunicationModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showAlertModal} onClose={() => setShowAlertModal(false)} title="Create Alert">
        <form onSubmit={submitAlert} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Client Name<FieldMark required /></span>
            <Select value={alertForm.client_name} onChange={(event) => setAlertForm((current) => ({ ...current, client_name: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" required>
              <option value="">Choose client</option>
              {clients.map((client) => <option key={client.id} value={client.name}>{client.name}</option>)}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Alert Type<FieldMark /></span>
            <Select value={alertForm.alert_type} onChange={(event) => setAlertForm((current) => ({ ...current, alert_type: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              {alertTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </label>
          <Input label="Trigger Date" type="date" value={alertForm.trigger_date} onChange={(event) => setAlertForm((current) => ({ ...current, trigger_date: event.target.value }))} required />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Message<FieldMark required /></span>
            <textarea rows={4} value={alertForm.message} onChange={(event) => setAlertForm((current) => ({ ...current, message: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" required />
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit">Save Alert</Button>
            <Button type="button" variant="secondary" onClick={() => setShowAlertModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

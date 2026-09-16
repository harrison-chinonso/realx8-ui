import { useEffect, useMemo, useState } from 'react';
import { createAttendance, createVisitor, checkoutVisitor, listAttendance, listVisitors } from '../../api/frontDeskApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';

const tabs = [
  { id: 'visitors', label: 'Visitor Log' },
  { id: 'attendance', label: 'Staff Attendance' },
];

const emptyVisitorForm = {
  full_name: '',
  phone: '',
  email: '',
  purpose: '',
  host_name: '',
  note: '',
};

const emptyAttendanceForm = {
  employee_name: '',
  employee_role: '',
  date: '',
  check_in_time: '',
  check_out_time: '',
  status: 'present',
};

const toList = (response) => response?.data || [];
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '—');
const formatTime = (value) => (value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const sameDay = (value, filter) => !filter || (value && new Date(value).toISOString().slice(0, 10) === filter);
const inRange = (value, start, end) => {
  if (!value) return false;
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
};
const combineDateTime = (date, time) => (date && time ? `${date}T${time}:00` : null);

export default function FrontDeskPage() {
  const [tab, setTab] = useState('visitors');
  const [visitors, setVisitors] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [visitorDetailRow, setVisitorDetailRow] = useState(null);
  const [attendanceDetailRow, setAttendanceDetailRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [visitorForm, setVisitorForm] = useState(emptyVisitorForm);
  const [attendanceForm, setAttendanceForm] = useState(emptyAttendanceForm);
  const [visitorDate, setVisitorDate] = useState('');
  const [attendanceRange, setAttendanceRange] = useState({ start: '', end: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [visitorResponse, attendanceResponse] = await Promise.all([
        listVisitors({ limit: 200 }),
        listAttendance({ limit: 200 }),
      ]);
      setVisitors(toList(visitorResponse));
      setAttendance(toList(attendanceResponse));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredVisitors = useMemo(
    () => visitors.filter((visitor) => sameDay(visitor.check_in, visitorDate)),
    [visitorDate, visitors]
  );

  const filteredAttendance = useMemo(
    () => attendance.filter((record) => inRange(record.date, attendanceRange.start, attendanceRange.end)),
    [attendance, attendanceRange.end, attendanceRange.start]
  );

  const visitorColumns = [
    { key: 'pass_number', label: 'Pass#' },
    { key: 'full_name', label: 'Full Name' },
    { key: 'purpose', label: 'Purpose of Visit' },
    { key: 'check_in', label: 'Check-in Time', render: (row) => formatDateTime(row.check_in) },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
  ];

  const attendanceColumns = [
    { key: 'employee_name', label: 'Employee Name' },
    { key: 'employee_role', label: 'Role', render: (row) => row.employee_role || '—' },
    { key: 'check_in', label: 'Check-in Time', render: (row) => formatTime(row.check_in) },
    { key: 'date', label: 'Date', render: (row) => row.date ? new Date(`${row.date}T00:00:00`).toLocaleDateString() : '—' },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
  ];

  const visitorDetailFields = [
    { label: 'Pass Number', key: 'pass_number' },
    { label: 'Full Name', key: 'full_name' },
    { label: 'Phone', key: 'phone' },
    { label: 'Purpose', key: 'purpose' },
    { label: 'Host', key: 'host_name' },
    { label: 'Check-In', render: (row) => formatDateTime(row.check_in) },
    { label: 'Check-Out', render: (row) => formatDateTime(row.check_out) },
    { label: 'Status', render: (row) => <Badge value={row.status} /> },
    { label: 'Email', key: 'email' },
    { label: 'Note', key: 'note' },
  ];

  const attendanceDetailFields = [
    { label: 'Employee Name', key: 'employee_name' },
    { label: 'Role', render: (row) => row.employee_role || '—' },
    { label: 'Check-In', render: (row) => formatTime(row.check_in) },
    { label: 'Check-Out', render: (row) => formatTime(row.check_out) },
    { label: 'Date', render: (row) => row.date ? new Date(`${row.date}T00:00:00`).toLocaleDateString() : '—' },
    { label: 'Status', render: (row) => <Badge value={row.status} /> },
  ];

  const handleVisitorSubmit = async (event) => {
    event.preventDefault();
    await createVisitor(visitorForm);
    setVisitorForm(emptyVisitorForm);
    setShowVisitorModal(false);
    loadData();
  };

  const handleAttendanceSubmit = async (event) => {
    event.preventDefault();
    await createAttendance({
      employee_name: attendanceForm.employee_name,
      employee_role: attendanceForm.employee_role,
      date: attendanceForm.date,
      check_in: combineDateTime(attendanceForm.date, attendanceForm.check_in_time),
      check_out: combineDateTime(attendanceForm.date, attendanceForm.check_out_time),
      status: attendanceForm.status,
    });
    setAttendanceForm(emptyAttendanceForm);
    setShowAttendanceModal(false);
    loadData();
  };

  const handleCheckout = async (visitorId) => {
    await checkoutVisitor(visitorId);
    loadData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Front Desk</h1>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {tabs.map((item) => (
            <Button
              key={item.id}
              variant={tab === item.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {tab === 'visitors' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Filter by date<FieldMark /></label>
              <input type="date" value={visitorDate} onChange={(event) => setVisitorDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <Button onClick={() => setShowVisitorModal(true)}>+ New Visitor</Button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading visitors...</p>
          ) : (
            <Table
              columns={visitorColumns}
              data={filteredVisitors}
              renderActions={(row) => (
                <div className="flex items-center justify-end gap-2">
                  {row.status === 'in' ? (
                    <Button onClick={() => handleCheckout(row.id)} variant="primary" size="sm">
                      Check Out
                    </Button>
                  ) : <span className="text-xs text-slate-400">Completed</span>}
                  <ActionsMenu items={[{ label: '👁 View Details', onClick: () => setVisitorDetailRow(row) }]} />
                </div>
              )}
            />
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Start date<FieldMark /></label>
                <input type="date" value={attendanceRange.start} onChange={(event) => setAttendanceRange((current) => ({ ...current, start: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">End date<FieldMark /></label>
                <input type="date" value={attendanceRange.end} onChange={(event) => setAttendanceRange((current) => ({ ...current, end: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
            <Button onClick={() => setShowAttendanceModal(true)}>+ Mark Attendance</Button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading attendance...</p>
          ) : (
            <Table
              columns={attendanceColumns}
              data={filteredAttendance}
              renderActions={(row) => <ActionsMenu items={[{ label: '👁 View Details', onClick: () => setAttendanceDetailRow(row) }]} />}
            />
          )}
        </div>
      )}

      <DetailsModal
        open={!!visitorDetailRow}
        onClose={() => setVisitorDetailRow(null)}
        title={visitorDetailRow?.full_name || 'Visitor Details'}
        record={visitorDetailRow}
        fields={visitorDetailFields}
      />

      <DetailsModal
        open={!!attendanceDetailRow}
        onClose={() => setAttendanceDetailRow(null)}
        title={attendanceDetailRow?.employee_name || 'Attendance Details'}
        record={attendanceDetailRow}
        fields={attendanceDetailFields}
      />

      <Modal open={showVisitorModal} onClose={() => setShowVisitorModal(false)} title="New Visitor">
        <form onSubmit={handleVisitorSubmit} className="space-y-3">
          <Input label="Full Name" value={visitorForm.full_name} onChange={(event) => setVisitorForm((current) => ({ ...current, full_name: event.target.value }))} required />
          <Input label="Phone" value={visitorForm.phone} onChange={(event) => setVisitorForm((current) => ({ ...current, phone: event.target.value }))} required />
          <Input label="Email" type="email" value={visitorForm.email} onChange={(event) => setVisitorForm((current) => ({ ...current, email: event.target.value }))} />
          <Input label="Purpose of Visit" value={visitorForm.purpose} onChange={(event) => setVisitorForm((current) => ({ ...current, purpose: event.target.value }))} required />
          <Input label="Host Staff Member" value={visitorForm.host_name} onChange={(event) => setVisitorForm((current) => ({ ...current, host_name: event.target.value }))} required />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Note<FieldMark /></span>
            <textarea rows={3} value={visitorForm.note} onChange={(event) => setVisitorForm((current) => ({ ...current, note: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit">Save Visitor</Button>
            <Button type="button" variant="secondary" onClick={() => setShowVisitorModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showAttendanceModal} onClose={() => setShowAttendanceModal(false)} title="Mark Attendance">
        <form onSubmit={handleAttendanceSubmit} className="space-y-3">
          <Input label="Employee Name" value={attendanceForm.employee_name} onChange={(event) => setAttendanceForm((current) => ({ ...current, employee_name: event.target.value }))} required />
          <Input label="Role" value={attendanceForm.employee_role} onChange={(event) => setAttendanceForm((current) => ({ ...current, employee_role: event.target.value }))} />
          <Input label="Date" type="date" value={attendanceForm.date} onChange={(event) => setAttendanceForm((current) => ({ ...current, date: event.target.value }))} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Check-in Time" type="time" value={attendanceForm.check_in_time} onChange={(event) => setAttendanceForm((current) => ({ ...current, check_in_time: event.target.value }))} />
            <Input label="Check-out Time" type="time" value={attendanceForm.check_out_time} onChange={(event) => setAttendanceForm((current) => ({ ...current, check_out_time: event.target.value }))} />
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Status<FieldMark /></span>
            <Select value={attendanceForm.status} onChange={(event) => setAttendanceForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </Select>
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit">Save Attendance</Button>
            <Button type="button" variant="secondary" onClick={() => setShowAttendanceModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

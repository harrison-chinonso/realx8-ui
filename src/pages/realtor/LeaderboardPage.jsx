import { useEffect, useMemo, useState } from 'react';
import useAuthStore from '../../store/authStore';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import { useCurrency } from '../../context/useAppearance';
import { getLeaderboard, listLeaderboardStats, saveLeaderboardStat } from '../../api/leaderboardApi';
import MoneyInput from '../../components/ui/MoneyInput';
import Select from '../../components/ui/Select';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const MODAL_OVERLAY_CLASS = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4';
// Capped and scrollable, like Modal.jsx. A modal taller than the viewport
// centres itself off both edges, and its submit button ends up out of
// reach with nothing to scroll — the form can be filled in and not saved.
const MODAL_CARD_CLASS = 'w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto';
const MANAGER_ROLES = ['super_admin', 'admin', 'branch_manager'];
const RANGE_OPTIONS = [
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom' },
];
const PODIUM_STYLES = ['border-amber-300 bg-amber-50', 'border-slate-300 bg-slate-50', 'border-orange-300 bg-orange-50'];
const PODIUM_BADGES = ['🥇', '🥈', '🥉'];

const getItems = (response) => (Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []);
const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;
const emptyForm = () => ({
  id: '',
  realtor_id: '',
  realtor_name: '',
  branch: '',
  total_sales: '',
  inspections_count: '',
  leads_closed: '',
  active_deals: '',
  period_start: '',
  period_end: '',
});

export default function LeaderboardPage() {
  const user = useAuthStore((state) => state.user);
  const formatCurrency = useCurrency();
  const isManager = MANAGER_ROLES.includes(user?.type);
  const [rows, setRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [filters, setFilters] = useState({ range: 'this_month', branch: '', start_date: '', end_date: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [rankingDetailRow, setRankingDetailRow] = useState(null);
  const [historyDetailRow, setHistoryDetailRow] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const loadData = async (override = filters) => {
    setLoading(true);
    setError('');
    try {
      const params = override.range === 'custom'
        ? override
        : { range: override.range, branch: override.branch || undefined };
      const [leaderboardResponse, statsResponse] = await Promise.all([
        getLeaderboard(params),
        isManager ? listLeaderboardStats(params) : Promise.resolve({ data: [] }),
      ]);
      setRows(getItems(leaderboardResponse));
      setHistoryRows(getItems(statsResponse));
    } catch (loadError) {
      console.error(loadError);
      setError(getErrorMessage(loadError, 'Failed to load leaderboard.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const branchOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.branch).filter(Boolean))), [rows]);
  const topThree = rows.slice(0, 3);

  const rankingColumns = useMemo(() => [
    { key: 'rank', label: 'Rank', render: (row) => row.rank },
    { key: 'realtor_name', label: 'Name', render: (row) => row.realtor_name || '—' },
    { key: 'total_sales', label: 'Total Sales (₦)', render: (row) => formatCurrency(row.total_sales || 0) },
    { key: 'points', label: 'Points', render: (row) => row.points || 0 },
    { key: 'trend', label: 'Trend', render: (row) => <span className={`font-semibold ${row.trend === 'up' ? 'text-emerald-600' : 'text-rose-500'}`}>{row.trend === 'up' ? '↑' : '↓'}</span> },
  ], [formatCurrency]);

  const rankingDetailFields = useMemo(() => [
    { label: 'Rank', render: (row) => row.rank ?? '—' },
    { label: 'Realtor', key: 'realtor_name' },
    { label: 'Branch', key: 'branch' },
    { label: 'Total Sales', render: (row) => formatCurrency(row.total_sales || 0) },
    { label: 'Inspections', render: (row) => row.inspections_count || 0 },
    { label: 'Leads Closed', render: (row) => row.leads_closed || 0 },
    { label: 'Active Deals', render: (row) => row.active_deals || 0 },
    { label: 'Points', render: (row) => row.points || 0 },
    { label: 'Trend', render: (row) => row.trend === 'up' ? 'Up' : row.trend === 'down' ? 'Down' : '—' },
  ], [formatCurrency]);

  const openCreate = () => {
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (row) => {
    setForm({
      id: row.id || '',
      realtor_id: row.realtor_id || '',
      realtor_name: row.realtor_name || '',
      branch: row.branch || '',
      total_sales: row.total_sales || '',
      inspections_count: row.inspections_count || '',
      leads_closed: row.leads_closed || '',
      active_deals: row.active_deals || '',
      period_start: row.period_start || '',
      period_end: row.period_end || '',
    });
    setShowModal(true);
  };

  const handleApplyFilters = () => {
    const payload = filters.range === 'custom'
      ? { range: 'custom', branch: filters.branch || undefined, start_date: filters.start_date || undefined, end_date: filters.end_date || undefined }
      : { range: filters.range, branch: filters.branch || undefined };
    return loadData(payload);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.realtor_name.trim() || !form.branch.trim()) return;

    setSaving(true);
    setError('');
    try {
      await saveLeaderboardStat({
        ...form,
        realtor_id: form.realtor_id || null,
      });
      setShowModal(false);
      setForm(emptyForm());
      await handleApplyFilters();
    } catch (saveError) {
      console.error(saveError);
      setError(getErrorMessage(saveError, 'Failed to save leaderboard stat.'));
    } finally {
      setSaving(false);
    }
  };

  const historyColumns = useMemo(() => [
    { key: 'realtor_name', label: 'Realtor', render: (row) => row.realtor_name || '—' },
    { key: 'branch', label: 'Branch', render: (row) => row.branch || '—' },
    { key: 'period', label: 'Period', render: (row) => `${row.period_start || '—'} → ${row.period_end || '—'}` },
    { key: 'total_sales', label: 'Total Sales', render: (row) => formatCurrency(row.total_sales || 0) },
    { key: 'points', label: 'Points', render: (row) => row.points || 0 },
  ], [formatCurrency]);

  const historyDetailFields = useMemo(() => [
    { label: 'Realtor', key: 'realtor_name' },
    { label: 'Branch', key: 'branch' },
    { label: 'Period', render: (row) => `${row.period_start || '—'} → ${row.period_end || '—'}` },
    { label: 'Total Sales', render: (row) => formatCurrency(row.total_sales || 0) },
    { label: 'Inspections', render: (row) => row.inspections_count || 0 },
    { label: 'Leads Closed', render: (row) => row.leads_closed || 0 },
    { label: 'Active Deals', render: (row) => row.active_deals || 0 },
    { label: 'Points', render: (row) => row.points || 0 },
  ], [formatCurrency]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Leaderboard</h1>
          <p className="text-sm text-slate-500">Track top performers across sales, inspections, and deal activity.</p>
        </div>
        {isManager && <Button onClick={openCreate}>Add / Update Stats</Button>}
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-4">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              onClick={() => setFilters((current) => ({ ...current, range: option.value }))}
              variant={filters.range === option.value ? 'primary' : 'secondary'}
              size="sm"
              className="rounded-full"
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="block space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Branch</span>
            <Select value={filters.branch} onChange={(event) => setFilters((current) => ({ ...current, branch: event.target.value }))}>
              <option value="">All branches</option>
              {branchOptions.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
            </Select>
          </label>
          {filters.range === 'custom' && (
            <>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Start Date</span>
                <input type="date" value={filters.start_date} onChange={(event) => setFilters((current) => ({ ...current, start_date: event.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">End Date</span>
                <input type="date" value={filters.end_date} onChange={(event) => setFilters((current) => ({ ...current, end_date: event.target.value }))} className={INPUT_CLASS} />
              </label>
            </>
          )}
        </div>

        <div>
          <Button onClick={handleApplyFilters} disabled={loading}>{loading ? 'Loading…' : 'Apply Filters'}</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {topThree.map((row, index) => (
          <div key={row.id || row.rank} className={`rounded-2xl border p-5 shadow-sm ${PODIUM_STYLES[index]}`}>
            <div className="flex items-center justify-between">
              <span className="text-3xl">{PODIUM_BADGES[index]}</span>
              <Badge value={`#${row.rank}`} />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">{row.realtor_name}</h2>
            <p className="text-sm text-slate-500">{row.branch || '—'}</p>
            <p className="mt-5 text-3xl font-semibold text-slate-900">{row.points}</p>
            <p className="text-sm text-slate-500">points</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div className="rounded-xl bg-white/80 px-3 py-2">Sales<br /><span className="font-semibold text-slate-900">{formatCurrency(row.total_sales || 0)}</span></div>
              <div className="rounded-xl bg-white/80 px-3 py-2">Closed<br /><span className="font-semibold text-slate-900">{row.leads_closed || 0}</span></div>
            </div>
          </div>
        ))}
        {!topThree.length && <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200 md:col-span-3">No leaderboard stats available yet.</div>}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Full Ranking</h2>
          <p className="text-sm text-slate-500">Points = Sales × 10 + Leads Closed × 5 + Inspections × 2</p>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading leaderboard...</p>
        ) : (
          <Table
            columns={rankingColumns}
            data={rows}
            renderActions={(row) => (
              <div className="flex items-center justify-end gap-2">
                {isManager && (
                  <Button type="button" onClick={() => openEdit(row)} variant="primary" size="sm">Edit</Button>
                )}
                <ActionsMenu items={[{ label: '👁 View Details', onClick: () => setRankingDetailRow(row) }]} />
              </div>
            )}
          />
        )}
      </div>

      {isManager && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Stats History</h2>
            <p className="text-sm text-slate-500">Historical leaderboard records for the selected filters.</p>
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading stats history...</p>
          ) : (
            <Table
              columns={historyColumns}
              data={historyRows}
              renderActions={(row) => <ActionsMenu items={[{ label: '👁 View Details', onClick: () => setHistoryDetailRow(row) }]} />}
            />
          )}
        </div>
      )}

      <DetailsModal
        open={!!rankingDetailRow}
        onClose={() => setRankingDetailRow(null)}
        title={rankingDetailRow?.realtor_name || 'Ranking Details'}
        record={rankingDetailRow}
        fields={rankingDetailFields}
      />

      <DetailsModal
        open={!!historyDetailRow}
        onClose={() => setHistoryDetailRow(null)}
        title={historyDetailRow?.realtor_name || 'History Details'}
        record={historyDetailRow}
        fields={historyDetailFields}
      />

      {showModal && (
        <div className={MODAL_OVERLAY_CLASS}>
          <div className={MODAL_CARD_CLASS}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Update Leaderboard Stat' : 'Add Leaderboard Stat'}</h2>
                <p className="text-sm text-slate-500">Manually record realtor performance for the selected period.</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Realtor ID</span>
                  <input value={form.realtor_id} onChange={(event) => setForm((current) => ({ ...current, realtor_id: event.target.value }))} className={INPUT_CLASS} placeholder="Optional" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Realtor Name</span>
                  <input required value={form.realtor_name} onChange={(event) => setForm((current) => ({ ...current, realtor_name: event.target.value }))} className={INPUT_CLASS} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Branch</span>
                  <input required value={form.branch} onChange={(event) => setForm((current) => ({ ...current, branch: event.target.value }))} className={INPUT_CLASS} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Total Sales</span>
                  <MoneyInput value={form.total_sales} onChange={(total_sales) => setForm((current) => ({ ...current, total_sales }))} className={INPUT_CLASS} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Inspections</span>
                  <input type="number" min="0" value={form.inspections_count} onChange={(event) => setForm((current) => ({ ...current, inspections_count: event.target.value }))} className={INPUT_CLASS} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Leads Closed</span>
                  <input type="number" min="0" value={form.leads_closed} onChange={(event) => setForm((current) => ({ ...current, leads_closed: event.target.value }))} className={INPUT_CLASS} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Active Deals</span>
                  <input type="number" min="0" value={form.active_deals} onChange={(event) => setForm((current) => ({ ...current, active_deals: event.target.value }))} className={INPUT_CLASS} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Period Start</span>
                  <input type="date" value={form.period_start} onChange={(event) => setForm((current) => ({ ...current, period_start: event.target.value }))} className={INPUT_CLASS} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Period End</span>
                  <input type="date" value={form.period_end} onChange={(event) => setForm((current) => ({ ...current, period_end: event.target.value }))} className={INPUT_CLASS} />
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : form.id ? 'Save Changes' : 'Save Stat'}</Button>
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

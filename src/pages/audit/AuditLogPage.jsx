import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuditLog, getAuditFilters, listAuditLogs } from '../../api/auditApi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import Modal from '../../components/common/Modal';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import CompanySelect from '../../components/common/CompanySelect';
import useAuthStore from '../../store/authStore';
import FieldMark from '../../components/ui/FieldMark';

/**
 * The audit trail.
 *
 * A read-only screen, and deliberately so: there is no edit control, no delete
 * control and no bulk action, because the API offers none and the database
 * refuses both. What an administrator can do here is look, narrow and open an
 * entry — nothing else exists to do.
 *
 * ── What each viewer sees ───────────────────────────────────────────────────
 *
 * A platform administrator sees every company, with a company picker to narrow
 * to one. Everyone else sees their own company's activity and nothing else, and
 * the scope is applied by the server rather than by this page — so an empty
 * company picker is not what keeps one company's activity out of another's
 * view.
 */

const EMPTY = { data: [], pagination: { page: 1, totalPages: 1, total: 0 } };
const PAGE_SIZE = 25;

const formatWhen = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/**
 * An action's name, for an action nobody has written a label for.
 *
 * `properties.units.manage` reads as "Properties · Units · Manage", which is
 * legible enough that a route added tomorrow needs no edit anywhere to appear
 * sensibly on this screen.
 */
const titleise = (action) => String(action || '')
  .split('.')
  .map((part) => part.replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase()))
  .join(' · ');

const actionLabel = (row) => row?.action_label || titleise(row?.action);

const ACTOR_TONE = {
  superior_admin: 'bg-primary-soft text-primary',
  super_admin: 'bg-primary-soft text-primary',
  admin: 'bg-primary-soft text-primary',
};

function ActorCell({ row }) {
  const tone = ACTOR_TONE[row.actor_type] || 'bg-surface-sunken text-content-muted';
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-slate-800">{row.actor_name || 'Unknown'}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
          {titleise(row.actor_type || 'unknown')}
        </span>
        {/* Says WHOSE administrator did this, which is the question a platform
            admin reading a mixed list is usually asking. */}
        {row.actor_is_platform && (
          <span className="rounded-full bg-warning-surface px-2 py-0.5 text-[11px] font-semibold text-warning">
            Platform
          </span>
        )}
        {row.actor_email && <span className="truncate">{row.actor_email}</span>}
      </div>
    </div>
  );
}

function TargetCell({ row }) {
  if (!row.entity_type && !row.entity_id) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-0">
      <div className="truncate text-slate-800">{row.entity_label || titleise(row.entity_type)}</div>
      <div className="text-xs text-slate-500">
        {titleise(row.entity_type)}{row.entity_id ? ` #${row.entity_id}` : ''}
      </div>
    </div>
  );
}

/** The recorded detail of one entry, shown as it was stored. */
function EntryDetail({ entry }) {
  if (!entry) return <p className="text-sm text-slate-500">Loading…</p>;

  const rows = [
    ['When', formatWhen(entry.created_at)],
    ['Action', actionLabel(entry)],
    ['Action name', entry.action],
    ['Performed by', entry.actor_name || 'Unknown'],
    ['Account', entry.actor_email || '—'],
    ['Profile', titleise(entry.actor_type || 'unknown')],
    ['Company', entry.company_id ? `#${entry.company_id}` : 'Platform-level'],
    ['Target', entry.entity_id ? `${titleise(entry.entity_type)} #${entry.entity_id}` : titleise(entry.entity_type) || '—'],
    ['Request', `${entry.method || ''} ${entry.path || ''}`.trim() || '—'],
    ['From', entry.ip || '—'],
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="break-words text-sm text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          What was submitted
        </h4>
        {/*
          Shown verbatim rather than prettified into sentences. This is the
          record, and a screen that paraphrased it would be asking the reader to
          trust the paraphrase. Passwords and anything like them were replaced
          with "[redacted]" before the entry was ever written.
        */}
        {entry.metadata
          ? (
            <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          )
          : <p className="text-sm text-slate-500">Nothing was submitted with this request.</p>}
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Audit entries cannot be edited or deleted — by anyone, including a platform
        administrator. This is a permanent record.
      </p>
    </div>
  );
}

export default function AuditLogPage() {
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);

  const [result, setResult] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [facets, setFacets] = useState({ actions: [], modules: [], actors: [] });
  const [open, setOpen] = useState(null);      // the entry being read, or null
  const [entry, setEntry] = useState(null);

  const [filters, setFilters] = useState({
    module: '', action: '', actor_id: '', from: '', to: '', company_id: '',
  });

  const query = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.company_id ? { company_id: filters.company_id } : {}),
    ...(filters.module ? { 'filter[module]': filters.module } : {}),
    ...(filters.action ? { 'filter[action]': filters.action } : {}),
    ...(filters.actor_id ? { 'filter[actor_id]': filters.actor_id } : {}),
  }), [page, search, filters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed('');
    listAuditLogs(query)
      .then((response) => { if (!cancelled) setResult(response ?? EMPTY); })
      .catch((error) => {
        if (cancelled) return;
        setResult(EMPTY);
        setFailed(error?.userMessage || 'The audit trail could not be loaded.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  // The dropdowns list what actually occurs, so they never offer an action that
  // returns nothing or omit one that happened.
  useEffect(() => {
    let cancelled = false;
    getAuditFilters(filters.company_id ? { company_id: filters.company_id } : undefined)
      .then((data) => { if (!cancelled && data) setFacets(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [filters.company_id]);

  // Any change to what is being asked for starts again at the first page —
  // otherwise a narrower filter lands on page 6 of 2 and looks like no results.
  const setFilter = (field) => (event) => {
    setPage(1);
    setFilters((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSearch = useCallback((value) => {
    setPage(1);
    setSearch(value);
  }, []);

  const openEntry = async (row) => {
    setOpen(row);
    setEntry(null);
    try {
      setEntry(await getAuditLog(row.id));
    } catch {
      setEntry({ ...row, metadata: null });
    }
  };

  const columns = [
    { header: 'When', accessor: 'created_at', render: (row) => formatWhen(row.created_at) },
    { header: 'Action', accessor: 'action', render: (row) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-800">{actionLabel(row)}</div>
        <div className="text-xs text-slate-500">{titleise(row.module)}</div>
      </div>
    ) },
    { header: 'Performed by', accessor: 'actor_name', render: (row) => <ActorCell row={row} /> },
    { header: 'Target', accessor: 'entity_label', render: (row) => <TargetCell row={row} /> },
    ...(isSuperiorAdmin
      ? [{ header: 'Company', accessor: 'company_id', render: (row) => (row.company_id ? `#${row.company_id}` : 'Platform') }]
      : []),
  ];

  const clearable = Object.values(filters).some(Boolean) || search;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Audit Trail</h1>
        <p className="text-sm text-slate-500">
          Every administrative action, who performed it and when.
          {isSuperiorAdmin
            ? ' You are seeing every company.'
            : ' You are seeing your company’s activity.'}
          {' '}Entries are permanent and cannot be edited or deleted.
        </p>
      </div>

      {failed && (
        <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-4">
        {isSuperiorAdmin && (
          <CompanySelect
            label="Company"
            required={false}
            value={filters.company_id}
            onChange={setFilter('company_id')}
          />
        )}
        <label className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">Area<FieldMark /></span>
          <Select value={filters.module} onChange={setFilter('module')}>
            <option value="">All areas</option>
            {facets.modules.filter((m) => m.module).map((m) => (
              <option key={m.module} value={m.module}>{titleise(m.module)} ({m.total})</option>
            ))}
          </Select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">Action<FieldMark /></span>
          <Select value={filters.action} onChange={setFilter('action')}>
            <option value="">All actions</option>
            {facets.actions.map((a) => (
              <option key={a.action} value={a.action}>
                {a.action_label || titleise(a.action)} ({a.total})
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">Performed by<FieldMark /></span>
          <Select value={filters.actor_id} onChange={setFilter('actor_id')}>
            <option value="">Anyone</option>
            {facets.actors.filter((a) => a.actor_id).map((a) => (
              <option key={a.actor_id} value={a.actor_id}>
                {a.actor_name || `User #${a.actor_id}`} ({a.total})
              </option>
            ))}
          </Select>
        </label>
        <Input label="From" type="date" value={filters.from} onChange={setFilter('from')} />
        <Input label="To" type="date" value={filters.to} onChange={setFilter('to')} />
        {clearable && (
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPage(1);
                setSearch('');
                setFilters({ module: '', action: '', actor_id: '', from: '', to: '', company_id: '' });
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      <Table
        columns={columns}
        data={result.data}
        loading={loading}
        /*
         * Searched on the SERVER. This table is paginated there, so the
         * client-side search Table does by default would only have searched the
         * twenty-five rows on screen while appearing to search everything.
         */
        onSearch={handleSearch}
        searchPlaceholder="Search by person, action or record…"
        exportName="audit-trail"
        exportTitle="Audit Trail"
        emptyMessage="No activity matches these filters yet."
        renderActions={(row) => (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={() => openEntry(row)}>
              View
            </Button>
          </div>
        )}
      />

      <Pagination
        page={result.pagination?.page || 1}
        totalPages={result.pagination?.totalPages || 1}
        onPageChange={setPage}
      />

      <Modal
        open={open !== null}
        onClose={() => { setOpen(null); setEntry(null); }}
        title={open ? actionLabel(open) : 'Audit entry'}
        size="lg"
      >
        <EntryDetail entry={entry} />
      </Modal>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { exportTable, exportableColumns, cellValue } from '../../utils/tableExport';

/**
 * The application's table: rendering, searching, filtering and export.
 *
 * All four live here rather than in each page because there are thirty-odd
 * tables and they were otherwise going to diverge — three different search
 * boxes behaving three different ways is worse than none. A page opts out with
 * `searchable={false}` or `exportable={false}`; everything else it gets for
 * free.
 *
 * ── Searching and filtering are client-side ─────────────────────────────────
 *
 * They operate on the rows the page has already fetched. That is the whole
 * result set for every table in this application bar one, so it is genuinely
 * complete rather than "the visible page" — but a page that paginates on the
 * SERVER should pass `onSearch` and do the filtering there, or its search box
 * would quietly only search the page in view. That is the one case where this
 * default would mislead.
 *
 * ── What is searched ────────────────────────────────────────────────────────
 *
 * The exported value of each column, not the rendered one: `render` returns
 * JSX, and searching it would mean searching React elements. So what you can
 * search matches what you can export, which is also what a person sees in the
 * cell for all but the badge-style columns.
 */

const norm = (value) => String(value ?? '').toLowerCase().trim();

/** Distinct values in a column, for a generated filter dropdown. */
const optionsFor = (rows, column) => {
  const seen = new Map();
  rows.forEach((row) => {
    const value = cellValue(row, column);
    const text = String(value ?? '').trim();
    if (text) seen.set(text, true);
  });
  return [...seen.keys()].sort((a, b) => a.localeCompare(b));
};

export default function Table({
  columns,
  rows,
  data,
  renderActions,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search…',
  /** Column keys to offer as dropdown filters. Options are derived from the data. */
  filterable = [],
  exportable = true,
  /** Base filename and PDF heading. Falls back to something neutral. */
  exportName = 'report',
  exportTitle,
  /** Supply to search on the SERVER instead — required for server-paginated tables. */
  onSearch,
}) {
  const tableRows = rows ?? data ?? [];
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [busy, setBusy] = useState('');
  const [failed, setFailed] = useState('');

  const filterColumns = useMemo(
    () => columns.filter((c) => filterable.includes(c.accessor ?? c.key)),
    [columns, filterable],
  );

  const searchColumns = useMemo(() => exportableColumns(columns), [columns]);

  const visible = useMemo(() => {
    let result = tableRows;

    // With onSearch the server has already applied the query; filtering again
    // here would hide rows it deliberately returned.
    if (query && !onSearch) {
      const needle = norm(query);
      result = result.filter((row) => searchColumns.some(
        (column) => norm(cellValue(row, column)).includes(needle),
      ));
    }

    const active = Object.entries(filters).filter(([, v]) => v);
    if (active.length) {
      result = result.filter((row) => active.every(([key, value]) => {
        const column = columns.find((c) => (c.accessor ?? c.key) === key);
        return column ? String(cellValue(row, column) ?? '') === value : true;
      }));
    }

    return result;
  }, [tableRows, query, filters, searchColumns, columns, onSearch]);

  const runExport = async (format) => {
    setFailed('');
    setBusy(format);
    try {
      await exportTable({
        format,
        // Exports what is on screen: if someone has searched or filtered, the
        // file is that view. Exporting everything regardless would quietly
        // hand back rows they had just excluded.
        rows: visible,
        columns,
        filename: exportName,
        title: exportTitle || exportName,
      });
    } catch (error) {
      setFailed(error?.message || 'Export failed.');
    } finally {
      setBusy('');
    }
  };

  const handleQuery = (value) => {
    setQuery(value);
    if (onSearch) onSearch(value);
  };

  const showToolbar = searchable || filterColumns.length > 0 || exportable;
  const columnCount = columns.length + (renderActions ? 1 : 0);

  return (
    <div className="space-y-3">
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <input
              type="search"
              value={query}
              onChange={(event) => handleQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search this table"
              className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm
                         text-slate-700 placeholder:text-slate-400 focus:border-slate-400
                         focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          )}

          {filterColumns.map((column) => {
            const key = column.accessor ?? column.key;
            return (
              <select
                key={key}
                value={filters[key] || ''}
                aria-label={`Filter by ${column.label ?? column.header ?? key}`}
                onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700
                           focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="">All {String(column.label ?? column.header ?? key).toLowerCase()}</option>
                {optionsFor(tableRows, column).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            );
          })}

          {exportable && (
            <div className="ml-auto flex items-center gap-1">
              {[['csv', 'CSV'], ['excel', 'Excel'], ['pdf', 'PDF']].map(([format, label]) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => runExport(format)}
                  disabled={Boolean(busy) || !visible.length}
                  title={visible.length ? `Export ${visible.length} row(s) as ${label}` : 'Nothing to export'}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700
                             hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === format ? '…' : label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {failed && (
        <p role="alert" className="text-sm text-red-600">{failed}</p>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((column, i) => (
                  <th key={column.key ?? column.accessor ?? i}
                    className="whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-600">
                    {column.label ?? column.header}
                  </th>
                ))}
                {renderActions && (
                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((row, ri) => (
                <tr key={row.id ?? ri} className="hover:bg-slate-50">
                  {columns.map((column, ci) => (
                    <td key={column.key ?? column.accessor ?? ci} className="px-4 py-3 text-slate-700">
                      {column.render
                        ? column.render(row)
                        : row[column.key ?? column.accessor]}
                    </td>
                  ))}
                  {renderActions && (
                    <td className="px-4 py-3 text-right">{renderActions(row)}</td>
                  )}
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-8 text-center text-slate-500">
                    {loading
                      ? 'Loading…'
                      : (tableRows.length
                        /**
                         * "No data" and "your search matched nothing" are
                         * different problems with different fixes, and telling
                         * someone a filtered table is empty sends them looking
                         * for missing records.
                         */
                        ? 'No rows match your search or filters.'
                        : 'No data available.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(query || Object.values(filters).some(Boolean)) && (
        <p className="text-xs text-slate-500">
          Showing {visible.length} of {tableRows.length} rows.
        </p>
      )}
    </div>
  );
}

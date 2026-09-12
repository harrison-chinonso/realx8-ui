import { useMemo, useState } from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ExportProgress from './ExportProgress';
import { isStaleBuildError } from '../../utils/lazyImport';
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
  /**
   * What to say when there is nothing to show.
   *
   * A specific message carries real information — "they arrive when someone
   * buys from a shared link" tells someone the feature works and they are not
   * missing data — and a generic "No data available." throws that away.
   */
  emptyMessage = 'No data available.',
  /** Supply to search on the SERVER instead — required for server-paginated tables. */
  onSearch,
}) {
  const tableRows = rows ?? data ?? [];
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [busy, setBusy] = useState('');
  const [failed, setFailed] = useState('');
  const [stale, setStale] = useState(false);
  const [progress, setProgress] = useState(null);

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
    setStale(false);
    setBusy(format);
    setProgress({ stage: 'Preparing', percent: 5 });
    try {
      await exportTable({
        format,
        onProgress: setProgress,
        // Exports what is on screen: if someone has searched or filtered, the
        // file is that view. Exporting everything regardless would quietly
        // hand back rows they had just excluded.
        rows: visible,
        columns,
        filename: exportName,
        title: exportTitle || exportName,
      });
    } catch (error) {
      /**
       * A stale build is not really an export failure — the app is simply out
       * of date — so it gets its own message and a Reload button rather than
       * the browser's "Failed to fetch dynamically imported module", which
       * tells the user nothing they can act on.
       */
      setStale(isStaleBuildError(error));
      setFailed(error?.message || 'Export failed.');
    } finally {
      setBusy('');
      setProgress(null);
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
        /**
         * Built from the shared ui/ primitives, not hand-styled controls.
         *
         * These were raw <input>/<select>/<button> elements with hardcoded
         * slate-* classes, which read as a different application sitting above
         * every table: the design system draws from tokens (--surface, --line-strong,
         * the tenant's brand colour) and renders its own option list, so a native
         * select's operating-system popup stood out immediately next to it.
         */
        <div className="flex flex-wrap items-end gap-2">
          {searchable && (
            <Input
              type="search"
              value={query}
              onChange={(event) => handleQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search this table"
              containerClassName="min-w-[12rem] flex-1"
            />
          )}

          {filterColumns.map((column) => {
            const key = column.accessor ?? column.key;
            const heading = String(column.label ?? column.header ?? key);
            return (
              <Select
                key={key}
                value={filters[key] || ''}
                aria-label={`Filter by ${heading}`}
                onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}
                className="min-w-[10rem]"
                options={[
                  { value: '', label: `All ${heading.toLowerCase()}` },
                  ...optionsFor(tableRows, column).map((option) => ({ value: option, label: option })),
                ]}
              />
            );
          })}

          {exportable && (
            <div className="ml-auto flex items-center gap-1.5">
              {[['csv', 'CSV'], ['excel', 'Excel'], ['pdf', 'PDF']].map(([format, label]) => (
                <Button
                  key={format}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => runExport(format)}
                  disabled={Boolean(busy) || !visible.length}
                  title={visible.length ? `Export ${visible.length} row(s) as ${label}` : 'Nothing to export'}
                >
                  {busy === format ? '…' : label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      <ExportProgress
        progress={progress}
        error={failed}
        staleBuild={stale}
        onDismiss={() => setFailed('')}
      />

      {/*
        ── Phones get cards, not a table ────────────────────────────────────

        A four-column table on a 375px screen is unusable however it is
        styled: either the columns crush to a few characters each, or the
        whole thing scrolls sideways and the first column — the name, the one
        you are scanning for — goes off the edge as soon as you scroll to see
        a status. Realtors and clients use this application on a phone, so
        that is the common case rather than the edge case.

        The same rows are rendered as stacked label/value cards below `sm`,
        where there is room for a full property name and nothing has to be
        scrolled horizontally to be read. The table returns at `sm` and up.
        Both views come from the same columns and the same render functions,
        so nothing can drift between them.
      */}
      <ul className="space-y-3 sm:hidden">
        {visible.map((row, ri) => (
          <li key={row.id ?? ri} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <dl className="space-y-2">
              {columns.map((column, ci) => (
                <div key={column.key ?? column.accessor ?? ci} className="flex items-start justify-between gap-3">
                  <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {column.label ?? column.header}
                  </dt>
                  {/* min-w-0 is what lets long values wrap instead of pushing
                      the label off the card. */}
                  <dd className="min-w-0 break-words text-right text-sm text-slate-700">
                    {column.render ? column.render(row) : row[column.key ?? column.accessor]}
                  </dd>
                </div>
              ))}
            </dl>
            {renderActions && (
              <div className="mt-3 border-t border-slate-100 pt-3">{renderActions(row)}</div>
            )}
          </li>
        ))}
        {!visible.length && (
          <li className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            {loading ? 'Loading…' : (tableRows.length ? 'No rows match your search or filters.' : emptyMessage)}
          </li>
        )}
      </ul>

      <div className="hidden overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 sm:block">
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
                    <td
                      key={column.key ?? column.accessor ?? ci}
                      /* max-w plus break-words keeps one long name from widening
                         the column past the viewport and pushing the rest off. */
                      className="max-w-[18rem] break-words px-4 py-3 align-top text-slate-700"
                    >
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
                        : emptyMessage)}
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

export default function Table({ columns, rows, data, renderActions }) {
  const tableRows = rows ?? data ?? [];

  return (
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
            {tableRows.map((row, ri) => (
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
            {!tableRows.length && (
              <tr>
                <td
                  colSpan={columns.length + (renderActions ? 1 : 0)}
                  className="px-4 py-8 text-center text-slate-500">
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

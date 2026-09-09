/**
 * DetailsModal — generic key/value detail panel for any record.
 *
 * Props:
 *   open:    boolean
 *   onClose: () => void
 *   title:   string (e.g. the record name)
 *   record:  object — the raw data row
 *   fields:  Array<{
 *     label: string,
 *     key?:  string,          // read record[key] directly
 *     render?: (record) => ReactNode  // custom renderer; takes priority over key
 *   }>
 */
export default function DetailsModal({ open, onClose, title, record, fields = [] }) {
  if (!open || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title || 'Details'}</h2>
            <p className="text-xs text-slate-500">Full record information</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body — 2-column grid */}
        <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
          {fields.map((field, i) => {
            const value = field.render
              ? field.render(record)
              : field.key != null
              ? record[field.key]
              : null;

            return (
              <div key={i} className="bg-white px-5 py-3">
                <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {field.label}
                </p>
                <div className="text-sm text-slate-800 break-words">
                  {value == null || value === '' ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    value
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

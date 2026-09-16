/**
 * EntitySearchSelect — searchable dropdown for any system entity.
 *
 * Props:
 *   label        string   — field label
 *   placeholder  string   — input placeholder
 *   value        any      — current selected ID
 *   onChange     fn(id)   — called with the selected entity's id
 *   fetchItems   async fn — returns array of items
 *   getLabel     fn(item) — returns display string for an item  (default: item.name || item.email)
 *   getId        fn(item) — returns the id value               (default: item.id)
 *   required     bool
 *   disabled     bool
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import FieldMark from '../ui/FieldMark';

export default function EntitySearchSelect({
  label,
  placeholder = 'Search…',
  value,
  onChange,
  fetchItems,
  getLabel = (item) => item.name || item.email || item.title || String(item.id),
  getId = (item) => item.id,
  required = false,
  disabled = false,
}) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  // Load entities once on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchItems()
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        setItems(rows);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = items.find((item) => String(getId(item)) === String(value));

  const filtered = query.trim()
    ? items.filter((item) => getLabel(item).toLowerCase().includes(query.toLowerCase()))
    : items;

  const handleSelect = useCallback((item) => {
    onChange(getId(item));
    setQuery('');
    setOpen(false);
  }, [onChange, getId]);

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  };

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {label}<FieldMark required={Boolean(required)} />
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-left transition-colors hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <span className={`flex-1 truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        {selected && !disabled && (
          <X size={13} onClick={handleClear} className="shrink-0 text-slate-400 hover:text-slate-700" />
        )}
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={13} className="shrink-0 text-slate-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto py-1">
            {loading && (
              <div className="px-3 py-4 text-center text-xs text-slate-400">Loading…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-slate-400">No results found</div>
            )}
            {!loading && filtered.map((item) => {
              const id = getId(item);
              const isSelected = String(id) === String(value);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-slate-50 ${isSelected ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700'}`}
                >
                  <span className="truncate">{getLabel(item)}</span>
                  <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-400">#{id}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

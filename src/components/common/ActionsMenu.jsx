import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ActionsMenu — horizontal ⋯ trigger that opens a dropdown of actions.
 * Uses a React portal so the dropdown is never clipped by overflow-hidden table containers.
 *
 * Props:
 *   items: Array<{ label: string, onClick: fn, disabled?: bool, variant?: 'default'|'danger' }>
 */
export default function ActionsMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Recalculate dropdown position every time it opens
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const DROPDOWN_WIDTH = 192;
    const left = Math.min(
      rect.right - DROPDOWN_WIDTH,
      window.innerWidth - DROPDOWN_WIDTH - 8
    );
    setPos({
      top: rect.bottom + window.scrollY + 4,
      left: Math.max(8, left + window.scrollX),
    });
  }, [open]);

  // Close when clicking outside both trigger and dropdown
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (dropdownRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="min-w-[192px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          disabled={item.disabled}
          onClick={() => {
            setOpen(false);
            item.onClick?.();
          }}
          className={[
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition',
            item.disabled
              ? 'cursor-not-allowed text-slate-300'
              : item.variant === 'danger'
              ? 'text-rose-600 hover:bg-rose-50'
              : 'text-slate-700 hover:bg-slate-50',
          ].join(' ')}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none"
        aria-label="More actions"
      >
        <span className="text-base font-bold leading-none">•</span>
        <span className="text-base font-bold leading-none">•</span>
        <span className="text-base font-bold leading-none">•</span>
      </button>
      {createPortal(dropdown, document.body)}
    </>
  );
}

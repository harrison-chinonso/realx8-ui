import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

/**
 * Select — a listbox that renders its own options.
 *
 * A native <select> draws its option list with the operating system, so no
 * amount of CSS reaches it: the popup keeps the platform's 1990s chrome no
 * matter how the closed control is styled. Rendering the list ourselves is the
 * only way to put it on the design tokens, which is why the reference app
 * reaches for Radix here.
 *
 * We portal + hand-roll instead of adding a dependency, matching ActionsMenu,
 * which already solves the same clipping problem for row action menus.
 *
 * The onChange contract is deliberately `{ target: { value, name } }`: ~330
 * existing handlers read `event.target.value`, and they keep working untouched.
 */

const isOptionElement = (node) => node?.props && node.props.value !== undefined;

/** Accepts either an `options` array or <option> children, so call sites can migrate as-is. */
function normaliseOptions(options, children) {
  if (Array.isArray(options)) {
    return options.map((o) => (
      typeof o === 'object' && o !== null
        ? { value: String(o.value ?? ''), label: String(o.label ?? o.value ?? ''), disabled: !!o.disabled }
        : { value: String(o), label: String(o), disabled: false }
    ));
  }
  const flat = [];
  const walk = (nodes) => {
    if (nodes === null || nodes === undefined || nodes === false) return;
    if (Array.isArray(nodes)) { nodes.forEach(walk); return; }
    if (!isOptionElement(nodes)) return;
    const { value, children: text, disabled } = nodes.props;
    flat.push({
      value: String(value ?? ''),
      // <option>{a}{b}</option> arrives as an array; join so labels never render "[object Object]".
      label: Array.isArray(text) ? text.filter((t) => typeof t !== 'object').join('') : String(text ?? ''),
      disabled: !!disabled,
    });
  };
  walk(children);
  return flat;
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.085l3.71-3.855a.75.75 0 111.08 1.04l-4.25 4.417a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
  </svg>
);

export default function Select({
  label,
  options,
  error,
  children,
  className = '',
  value,
  defaultValue,
  onChange,
  disabled = false,
  required = false,
  name,
  placeholder = 'Select…',
  id,
  ...props
}) {
  const items = useMemo(() => normaliseOptions(options, children), [options, children]);

  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '');
  const current = String((isControlled ? value : uncontrolled) ?? '');

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rect, setRect] = useState(null);
  const [dropUp, setDropUp] = useState(false);

  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const typeahead = useRef({ buffer: '', at: 0 });
  const reactId = useId();
  const listId = `${id || reactId}-listbox`;

  const selectedIndex = items.findIndex((o) => o.value === current);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  const position = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Flip above when the viewport below is too tight to be usable.
    const below = window.innerHeight - r.bottom;
    setDropUp(below < 200 && r.top > below);
    setRect({ top: r.top, bottom: r.bottom, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => { if (open) position(); }, [open, position]);

  useEffect(() => {
    if (!open) return undefined;
    // `true` captures scrolls inside modals and table wrappers, not just the window.
    const onScroll = () => position();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, position]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (triggerRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  // Keep the highlighted row in view for keyboard and typeahead navigation.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const commit = (option) => {
    if (!option || option.disabled) return;
    if (!isControlled) setUncontrolled(option.value);
    onChange?.({ target: { value: option.value, name }, currentTarget: { value: option.value, name } });
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openAt = (index) => {
    if (disabled) return;
    setActiveIndex(index);
    setOpen(true);
  };

  const step = (from, delta) => {
    const n = items.length;
    for (let i = 1; i <= n; i += 1) {
      const next = (from + delta * i + n * i) % n;
      if (!items[next].disabled) return next;
    }
    return from;
  };

  const onKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        openAt(selectedIndex >= 0 ? selectedIndex : step(-1, 1));
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault(); setOpen(false); triggerRef.current?.focus(); break;
      case 'Tab':
        setOpen(false); break;
      case 'ArrowDown':
        e.preventDefault(); setActiveIndex((i) => step(i < 0 ? -1 : i, 1)); break;
      case 'ArrowUp':
        e.preventDefault(); setActiveIndex((i) => step(i < 0 ? 0 : i, -1)); break;
      case 'Home':
        e.preventDefault(); setActiveIndex(step(-1, 1)); break;
      case 'End':
        e.preventDefault(); setActiveIndex(step(items.length, -1)); break;
      case 'Enter':
      case ' ':
        e.preventDefault(); commit(items[activeIndex]); break;
      default:
        // Typeahead: consecutive keystrokes within a second build one search string.
        if (e.key.length === 1) {
          const now = e.timeStamp;
          const t = typeahead.current;
          t.buffer = now - t.at < 1000 ? t.buffer + e.key : e.key;
          t.at = now;
          const q = t.buffer.toLowerCase();
          const hit = items.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(q));
          if (hit >= 0) setActiveIndex(hit);
        }
    }
  };

  const panel = open && rect ? createPortal(
    <div
      ref={listRef}
      role="listbox"
      id={listId}
      aria-label={typeof label === 'string' ? label : undefined}
      className="fixed z-[100] overflow-y-auto rounded-md border p-1 shadow-pop"
      style={{
        top: dropUp ? undefined : rect.bottom + 4,
        bottom: dropUp ? window.innerHeight - rect.top + 4 : undefined,
        left: rect.left,
        minWidth: rect.width,
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: 'min(20rem, 40vh)',
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--line)',
      }}
    >
      {items.length === 0 ? (
        <div className="px-2 py-6 text-center text-sm" style={{ color: 'var(--content-muted)' }}>
          No options
        </div>
      ) : items.map((option, index) => {
        const isSelected = option.value === current;
        const isActive = index === activeIndex;
        return (
          <div
            key={`${option.value}-${index}`}
            data-index={index}
            role="option"
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            onMouseEnter={() => !option.disabled && setActiveIndex(index)}
            // mousedown would fire before the click-outside handler settles; click is safe here.
            onClick={() => commit(option)}
            className={cn(
              'relative flex cursor-default select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm',
              option.disabled && 'pointer-events-none opacity-50',
            )}
            style={{
              backgroundColor: isActive && !option.disabled ? 'var(--surface-sunken)' : 'transparent',
              color: 'var(--content)',
              fontWeight: isSelected ? 600 : 400,
            }}
          >
            {isSelected && (
              <span className="absolute left-2 flex items-center" style={{ color: 'rgb(var(--primary-rgb))' }}>
                <CheckIcon />
              </span>
            )}
            <span className="truncate">{option.label}</span>
          </div>
        );
      })}
    </div>,
    document.body,
  ) : null;

  const control = (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex >= 0 ? selectedIndex : step(-1, 1)))}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-12 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3',
          'text-base md:text-sm transition-shadow',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:bg-surface-sunken',
          className,
        )}
        style={{ borderColor: error ? 'var(--danger)' : 'var(--line-strong)' }}
        {...props}
      >
        {/* An empty-valued option is still a real choice here ("All tiers", "Not set"),
            so it reads as content. The muted placeholder is only for no match at all. */}
        <span
          className="truncate text-left"
          style={{ color: selected ? 'var(--content)' : 'var(--content-subtle)' }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <span className="shrink-0" style={{ color: 'var(--content-subtle)' }}><ChevronIcon /></span>
      </button>
      {/* Keeps the value readable by any form-data / uncontrolled consumer. */}
      {name ? <input type="hidden" name={name} value={current} /> : null}
      {panel}
    </div>
  );

  // Always wrapped, even unlabelled: call sites lay out against `block space-y-1`.
  return (
    <label className="block space-y-1">
      {label && <span className="text-sm font-medium text-content">{label}</span>}
      {control}
      {error && <span className="text-xs" style={{ color: 'var(--danger)' }}>{error}</span>}
    </label>
  );
}

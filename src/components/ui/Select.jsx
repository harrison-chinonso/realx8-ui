import {
  Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import FieldMark from './FieldMark';
import { focusUnlessTouch, dismissKeyboard } from '../../utils/softKeyboard';

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

/**
 * An <optgroup>: a label and children, but no value of its own.
 *
 * Worth recognising rather than skipping. The walker used to test only for a
 * `value` prop, so a group was not an option AND its children were never
 * reached — a grouped list rendered as whatever plain options happened to sit
 * outside the groups, with no error anywhere. A fifty-bank picker came out
 * with two entries in it.
 */
const isGroupElement = (node) => node?.props
  && node.props.value === undefined
  && node.props.label !== undefined
  && node.props.children !== undefined;

/** Accepts either an `options` array or <option> children, so call sites can migrate as-is. */
function normaliseOptions(options, children) {
  if (Array.isArray(options)) {
    return options.map((o) => (
      typeof o === 'object' && o !== null
        ? {
          value: String(o.value ?? ''),
          label: String(o.label ?? o.value ?? ''),
          disabled: !!o.disabled,
          group: o.group ?? null,
        }
        : { value: String(o), label: String(o), disabled: false, group: null }
    ));
  }
  const flat = [];
  const walk = (nodes, group = null) => {
    if (nodes === null || nodes === undefined || nodes === false) return;
    if (Array.isArray(nodes)) { nodes.forEach((node) => walk(node, group)); return; }
    if (isGroupElement(nodes)) { walk(nodes.props.children, String(nodes.props.label)); return; }
    if (!isOptionElement(nodes)) return;
    const { value, children: text, disabled } = nodes.props;
    flat.push({
      value: String(value ?? ''),
      // <option>{a}{b}</option> arrives as an array; join so labels never render "[object Object]".
      label: Array.isArray(text) ? text.filter((t) => typeof t !== 'object').join('') : String(text ?? ''),
      disabled: !!disabled,
      group,
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
  /* true / false to force a search box; omitted, it appears on long lists. */
  searchable,
  id,
  /*
   * Taken by name rather than left in `...props`.
   *
   * Spread, a caller's `style` REPLACED this component's own — including the
   * border colour, which is how the one dark call site ended up with a control
   * whose border came from nowhere. Merged, a caller overrides the properties
   * it names and inherits the rest.
   */
  style,
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
  const searchRef = useRef(null);
  const typeahead = useRef({ buffer: '', at: 0 });
  const reactId = useId();
  const listId = `${id || reactId}-listbox`;

  /**
   * A search box, once the list is long enough to need one.
   *
   * Typeahead alone was the only way through a long list, and it has two
   * problems: nothing on screen says it exists, and it matches only the START
   * of a label — so "IBTC" never finds "Stanbic IBTC Bank Plc". A sixty-bank
   * picker is unusable that way.
   *
   * The threshold is deliberate rather than always-on: a search box above four
   * options is noise, and it costs a keystroke on every list somebody was
   * going to click anyway.
   */
  const [search, setSearch] = useState('');
  const canSearch = searchable === undefined ? items.length >= 10 : Boolean(searchable);

  /*
   * Matched anywhere in the label, and in the GROUP name too — somebody
   * looking for a microfinance bank types "microfinance", which is the
   * heading rather than part of most of the names under it.
   */
  const query = search.trim().toLowerCase();
  const shown = useMemo(() => (
    canSearch && query
      ? items.filter((option) => option.label.toLowerCase().includes(query)
        || String(option.group || '').toLowerCase().includes(query))
      : items
  ), [items, canSearch, query]);

  const selectedIndex = shown.findIndex((o) => o.value === current);
  const selected = items.find((o) => o.value === current) || null;

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

  /*
   * A fresh query each time it opens, and focus in the box.
   *
   * Reopening onto last time's search would show a filtered list with no
   * obvious reason, and the first thing somebody does with a long list is
   * type.
   */
  useEffect(() => {
    if (!open) { setSearch(''); return; }
    if (canSearch) {
      // After the portal has painted, or there is nothing to focus yet.
      // Not on a phone: focusing the search box IS opening the keyboard, and
      // opening a dropdown is not a request to type. Tapping the box still is.
      const id = requestAnimationFrame(() => focusUnlessTouch(searchRef.current));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open, canSearch]);

  /*
   * Typing narrows the list, so the old highlight may no longer be in it.
   *
   * Keyed on the QUERY alone on purpose: re-running this whenever the list
   * length changed would drag the highlight back to the top every time the
   * options were rebuilt, which on a parent that recreates its array each
   * render is every keystroke somewhere else on the page.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && canSearch) setActiveIndex(shown.length ? 0 : -1); }, [query]);

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
    // The search box is gone but a phone keeps the keyboard up for whatever is
    // still focused, which would cover the value just chosen. Blur first, then
    // hand focus back to the trigger.
    dismissKeyboard();
    triggerRef.current?.focus();
  };

  const openAt = (index) => {
    if (disabled) return;
    setActiveIndex(index);
    setOpen(true);
  };

  const step = (from, delta) => {
    const n = shown.length;
    if (!n) return -1;
    for (let i = 1; i <= n; i += 1) {
      const next = (from + delta * i + n * i) % n;
      if (!shown[next].disabled) return next;
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
        e.preventDefault(); setActiveIndex(step(shown.length, -1)); break;
      case 'Enter':
      case ' ':
        e.preventDefault(); commit(shown[activeIndex]); break;
      default:
        // Typeahead: consecutive keystrokes within a second build one search
        // string. Skipped where a search box is shown — that IS the typeahead,
        // and running both would fight over the highlight.
        if (!canSearch && e.key.length === 1) {
          const now = e.timeStamp;
          const t = typeahead.current;
          t.buffer = now - t.at < 1000 ? t.buffer + e.key : e.key;
          t.at = now;
          const q = t.buffer.toLowerCase();
          const hit = shown.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(q));
          if (hit >= 0) setActiveIndex(hit);
        }
    }
  };

  const panel = open && rect ? createPortal(
    /*
     * The popup is the container; the LISTBOX is the options inside it.
     *
     * With a search box in the panel the two cannot be the same element: a
     * listbox whose children include a textbox is not a listbox, and a screen
     * reader announces the option count wrongly for the rest of the session.
     */
    <div
      ref={listRef}
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
      {canSearch && (
        <div className="sticky top-0 z-10 p-1" style={{ backgroundColor: 'var(--surface)' }}>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type to narrow the list…"
            aria-label="Search the list"
            aria-controls={listId}
            className="w-full rounded-sm border px-2 py-1.5 text-sm focus-visible:outline-none"
            style={{
              borderColor: 'var(--line)',
              backgroundColor: 'var(--surface-sunken)',
              color: 'var(--content)',
            }}
          />
        </div>
      )}

      <div
        role="listbox"
        id={listId}
        aria-label={typeof label === 'string' ? label : undefined}
      >
      {shown.length === 0 ? (
        <div className="px-2 py-6 text-center text-sm" style={{ color: 'var(--content-muted)' }}>
          {query ? `Nothing matches “${search.trim()}”` : 'No options'}
        </div>
      ) : shown.map((option, index) => {
        const isSelected = option.value === current;
        const isActive = index === activeIndex;
        /*
          A heading when the group changes, so a long list reads as sections
          rather than as one run. Not focusable and not an option — arrow keys
          and typeahead step over it, because it is not a thing to choose.
        */
        const heading = option.group && option.group !== shown[index - 1]?.group
          ? (
            <div
              key={`group-${option.group}`}
              className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--content-subtle)' }}
            >
              {option.group}
            </div>
          )
          : null;
        return (
          <Fragment key={`${option.value}-${index}`}>
            {heading}
          <div
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
          </Fragment>
        );
      })}
      </div>
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
        style={{
          borderColor: error ? 'var(--danger)' : 'var(--line-strong)',
          // The colour the chosen label inherits. Here rather than on the span
          // so a caller can change both with one override.
          color: 'var(--content)',
          ...style,
        }}
        {...props}
      >
        {/* An empty-valued option is still a real choice here ("All tiers", "Not set"),
            so it reads as content. The muted placeholder is only for no match at all. */}
        {/*
          The chosen label INHERITS the control's colour rather than naming one.
          Hard-coding --content here meant the selection was drawn in the
          light-theme text colour wherever the control sits, so on a dark
          surface it was near-black on near-black: the list opened and read
          fine, a choice was made and stored, and the trigger then showed
          nothing. It looked exactly like a select that refuses to hold a value.
          The placeholder still names its own colour — it is deliberately
          quieter than the text around it, on any background.
        */}
        <span
          className="truncate text-left"
          style={selected ? undefined : { color: 'var(--content-subtle)' }}
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
      {label && (
        <span className="text-sm font-medium text-content">
          {label}
          <FieldMark required={Boolean(required)} />
        </span>
      )}
      {control}
      {error && <span className="text-xs" style={{ color: 'var(--danger)' }}>{error}</span>}
    </label>
  );
}

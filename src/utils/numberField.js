/**
 * Reading a number input without trapping the reader on zero.
 *
 * `Number('')` is 0, so a controlled number field whose onChange does
 * `Number(e.target.value)` cannot be cleared: select the digit, delete it, and
 * the state becomes 0, which React writes straight back into the box. The only
 * way out is to select the 0 and type over it — and typing before selecting
 * gives "01". People reported it as the field refusing to empty.
 *
 * An empty box means "not set", which is a different thing from zero, and the
 * two must not collapse into each other.
 */
export const numberOrUndefined = (raw) => {
  if (raw === '' || raw === null || raw === undefined) return undefined;
  const value = Number(raw);
  // Keep the box clearable rather than writing NaN into state.
  return Number.isNaN(value) ? undefined : value;
};

/** The same, for fields where the stored shape wants null rather than absent. */
export const numberOrNull = (raw) => numberOrUndefined(raw) ?? null;

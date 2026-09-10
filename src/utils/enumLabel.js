/**
 * How a stored enum or snake_case value is shown.
 *
 * Values are stored lower-case with underscores — `draft`, `bank_transfer`,
 * `payment_requested` — because that is what the columns hold and what the API
 * exchanges. Showing them raw leaks the storage format onto the screen, so
 * everything user-facing goes through here: DRAFT, BANK TRANSFER, PAYMENT
 * REQUESTED.
 *
 * Display only. Never use the result as a value to send back.
 */
export const enumLabel = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replace(/[_-]+/g, ' ').trim().toUpperCase();
};

/** Title Case, for places where all-caps would shout — page headings and prose. */
export const enumTitle = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export default enumLabel;

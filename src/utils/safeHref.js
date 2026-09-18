/**
 * The second half of a rule the API now enforces on the way in.
 *
 * Realx8-Core validates every uploaded-document URL before it stores one (see
 * its shared/src/safeUrl.js): https, and a host this deployment actually serves
 * files from. That is the real control — a value that cannot be stored cannot
 * be rendered.
 *
 * This is here for the records written BEFORE that landed. They are already in
 * the database, and the screens below render them the moment somebody opens an
 * old receipt:
 *
 *   <a href={receipt.document_url}>          ← a buyer typed this string
 *
 * React 18 renders a `javascript:` href with nothing but a console warning
 * (the warning arrived in 16.9; the blocking did not), and the session token
 * lives in localStorage where injected script can read it. So old rows get
 * checked at the point of use too, and a link that fails is rendered as inert
 * text rather than silently dropped — an admin looking at a receipt needs to
 * see that there IS a value and that it is not one we will open.
 *
 * Not a sanitiser and not a blocklist. It answers one question — is this an
 * https URL — and anything else is refused without being inspected further.
 */
export const safeHref = (raw) => {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

/**
 * True when there is a value but it is not one we will put behind a link.
 * Lets a screen show "the stored link is not openable" instead of nothing.
 */
export const isUnsafeHref = (raw) => Boolean(String(raw ?? '').trim()) && safeHref(raw) === null;

export default safeHref;

/**
 * extractError — pull the most specific message from an Axios error.
 *
 * Priority:
 *   1. First item in `response.data.errors[]` — but only if the path looks like
 *      a real field name, not an internal DB index name (e.g. key_2, PRIMARY, idx_*)
 *   2. `response.data.message`
 *   3. `error.message` (network / timeout)
 *   4. fallback string
 */

// Patterns that indicate an internal DB/ORM index name, not a user-facing field
const INTERNAL_PATH_RE = /^(PRIMARY|key_\d+|idx_|ux_|uq_|fk_|[a-z]+_[0-9]+$)/i;

export function extractError(err, fallback = 'An unexpected error occurred.') {
  if (!err) return fallback;

  const data = err?.response?.data;

  if (data) {
    // express-validator returns { errors: [{ msg, path }] }
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      const field = first.path || first.param || '';
      const msg = first.msg || first.message || String(first);

      // Skip internal index/constraint names — use the top-level message instead
      if (!field || INTERNAL_PATH_RE.test(field)) {
        if (data.message && typeof data.message === 'string') return data.message;
      } else {
        return `${field}: ${msg}`;
      }
    }

    if (data.message && typeof data.message === 'string') {
      return data.message;
    }

    if (typeof data === 'string' && data.length < 300) return data;
  }

  if (err.message && typeof err.message === 'string') {
    if (err.message.startsWith('Request failed with status code')) {
      return `Server error (${err.response?.status ?? 'unknown'}).`;
    }
    return err.message;
  }

  return fallback;
}

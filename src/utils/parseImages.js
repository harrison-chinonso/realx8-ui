/**
 * `properties.images` is a JSON column, so it can arrive as a real array,
 * a JSON-encoded string, or null depending on the driver and endpoint.
 * Always returns an array.
 */
export function parseImages(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** URL of the first media item, or null. Items may be strings or { url }. */
export function firstImageUrl(raw) {
  const first = parseImages(raw)[0];
  if (!first) return null;
  return typeof first === 'string' ? first : (first.url ?? null);
}

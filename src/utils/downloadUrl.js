/**
 * Turns a stored file URL into one the browser will SAVE rather than display.
 *
 * A plain `<a download>` does not work here. The attribute is ignored for
 * cross-origin URLs, and these files live on Cloudinary — so the link opened a
 * PDF in a tab instead of downloading it, and an image rendered in place.
 *
 * Cloudinary answers this with `fl_attachment`, a delivery flag inserted into
 * the transformation segment of the URL. It makes the CDN send
 * Content-Disposition: attachment, and it returns the ORIGINAL file rather than
 * a re-encoded derivative — which is what someone downloading their signed
 * agreement needs.
 *
 * Anything not on Cloudinary is returned untouched: the link still opens, it
 * just may not force a save. Better than mangling a URL we do not own.
 */
const CLOUDINARY_UPLOAD = /\/(image|video|raw|auto)\/upload\//;

export function downloadUrl(url, filename = '') {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw || !CLOUDINARY_UPLOAD.test(raw)) return raw;

  // Already carries the flag — leave it be rather than stacking a second copy.
  if (/\/fl_attachment(?::|\/)/.test(raw)) return raw;

  /**
   * The filename is passed to Cloudinary as `fl_attachment:<name>` so the saved
   * file is called "Sale Agreement" rather than the public_id, which is a
   * random string. Sanitised because the value lands in a URL path segment.
   */
  const safe = String(filename)
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);

  const flag = safe ? `fl_attachment:${safe}` : 'fl_attachment';
  return raw.replace(CLOUDINARY_UPLOAD, (match) => `${match}${flag}/`);
}

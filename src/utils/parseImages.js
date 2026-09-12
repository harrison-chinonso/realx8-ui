import { resolveMedia } from './mediaUrl';

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

/** Resolves one stored item, which may be a plain URL string or { url, type }. */
function mediaOf(item) {
  const url = typeof item === 'string' ? item : item?.url;
  if (!url) return null;
  return resolveMedia(url, typeof item === 'string' ? undefined : item?.type);
}

/**
 * URL of the first item that is actually an IMAGE, or null.
 *
 * Not simply `items[0]`. Media is stored in upload order, images and videos
 * together, so a property whose first upload was a video handed the card a
 * video URL — and `<img src>` cannot render one. The card fell back to its
 * empty-state placeholder even though the property plainly had photos.
 *
 * Classification goes through `resolveMedia`, the same helper the media panel
 * thumbnails use, so the card and the panel can never disagree about what
 * counts as an image. It also returns a normalised `src` (Dropbox share links
 * rewritten to raw), which is what should be rendered.
 */
export function firstImageUrl(raw) {
  for (const item of parseImages(raw)) {
    const media = mediaOf(item);
    if (media && media.kind === 'image' && media.src) return media.src;
  }
  return null;
}

/**
 * What a card should show: the first real image, or failing that a video's
 * poster frame.
 *
 * A property with only a video still has something to show — YouTube publishes
 * a thumbnail for every video and `resolveMedia` already resolves it — and a
 * card falling back to the house glyph beside cards with photographs reads as
 * a property missing its media rather than one whose media happens to move.
 *
 * The poster is a fallback and never a preference: a real photograph beats a
 * frame grab even when the video was uploaded first.
 */
export function coverImageUrl(raw) {
  const image = firstImageUrl(raw);
  if (image) return image;
  for (const item of parseImages(raw)) {
    const media = mediaOf(item);
    if (media && media.poster) return media.poster;
  }
  return null;
}

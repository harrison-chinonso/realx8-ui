/**
 * Media URLs fall into three rendering modes:
 *   image — <img>
 *   video — a real media stream, playable by <video>
 *   embed — a provider *page* (YouTube, Vimeo, Loom, Drive). These are HTML, not
 *           media streams, so <video src> can never play them; they need an
 *           <iframe> pointed at the provider's embed URL.
 *
 * Classification is driven by the URL rather than any stored `type`, so links
 * saved before embeds were supported still resolve correctly.
 */

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i;
const VIDEO_EXTS = /\.(mp4|mov|avi|webm|mkv|m4v|ogv)(\?.*)?$/i;

/*
 * `embed` is for an iframe; `page` is the provider's own watchable page.
 *
 * They are NOT interchangeable, and treating them as such is how a "watch this
 * video" link ends up on https://www.youtube.com/embed/<id> — which YouTube
 * refuses to serve as a top-level document, answering with "Video player
 * configuration error" (error 153). Anything opening a provider video outside
 * an iframe wants `page`.
 */
const PROVIDERS = [
  {
    name: 'youtube',
    match: /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i,
    embed: (id) => `https://www.youtube.com/embed/${id}`,
    page: (id) => `https://www.youtube.com/watch?v=${id}`,
    poster: (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  },
  {
    name: 'vimeo',
    match: /vimeo\.com\/(?:video\/)?(\d+)/i,
    embed: (id) => `https://player.vimeo.com/video/${id}`,
    page: (id) => `https://vimeo.com/${id}`,
  },
  {
    name: 'loom',
    match: /loom\.com\/(?:share|embed)\/([\w-]+)/i,
    embed: (id) => `https://www.loom.com/embed/${id}`,
    page: (id) => `https://www.loom.com/share/${id}`,
  },
  {
    name: 'drive',
    match: /drive\.google\.com\/file\/d\/([\w-]+)/i,
    embed: (id) => `https://drive.google.com/file/d/${id}/preview`,
    page: (id) => `https://drive.google.com/file/d/${id}/view`,
  },
];

/**
 * Resolves a media URL into how it should be rendered.
 * Returns { kind: 'image'|'video'|'embed', src, provider, poster }.
 * `src` is what the element should point at — the embed URL for embeds.
 */
export function resolveMedia(url, storedType) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return { kind: 'image', src: '', page: null, provider: null, poster: null };

  for (const provider of PROVIDERS) {
    const found = raw.match(provider.match);
    if (found) {
      return {
        kind: 'embed',
        src: provider.embed(found[1]),
        page: provider.page ? provider.page(found[1]) : null,
        provider: provider.name,
        poster: provider.poster ? provider.poster(found[1]) : null,
      };
    }
  }

  // Dropbox share links serve an HTML page unless asked for the raw file.
  let direct = raw;
  if (/dropbox\.com\//i.test(direct)) {
    direct = direct.replace(/([?&])dl=0/i, '$1raw=1');
    if (!/[?&]raw=1/i.test(direct)) direct += (direct.includes('?') ? '&' : '?') + 'raw=1';
  }

  if (VIDEO_EXTS.test(direct)) return { kind: 'video', src: direct, page: direct, provider: null, poster: null };
  if (IMAGE_EXTS.test(direct)) return { kind: 'image', src: direct, page: direct, provider: null, poster: null };

  // No extension to go on — fall back to whatever was recorded at save time.
  if (storedType === 'video') return { kind: 'video', src: direct, page: direct, provider: null, poster: null };
  return { kind: 'image', src: direct, page: direct, provider: null, poster: null };
}

/** Type persisted on the media item. Embeds are stored as 'video' for display purposes. */
export function guessType(url) {
  const { kind } = resolveMedia(url);
  return kind === 'image' ? 'image' : 'video';
}

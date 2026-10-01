import { useState } from 'react';
import { Home, Play } from 'lucide-react';
import MediaLightbox from '../common/MediaLightbox';
import { parseImages } from '../../utils/parseImages';
import { resolveMedia } from '../../utils/mediaUrl';

/**
 * A property's cover and first thumbnails, opening the shared lightbox.
 *
 * Reads the media the page already has; the lightbox holds the whole set, so
 * "+8 more" is a way in rather than a dead end. A video shows its poster with a
 * play mark, exactly as the media panel classifies it (resolveMedia).
 */
export default function PhotoGallery({
  images, name = 'Property', badge = null, coverHeight = 'h-64 sm:h-80', thumbs = 4,
}) {
  const items = parseImages(images);
  const [viewer, setViewer] = useState(null);
  const tiles = items.map((item) => {
    const url = typeof item === 'string' ? item : item?.url;
    const media = url ? resolveMedia(url, typeof item === 'string' ? undefined : item?.type) : null;
    return { src: media?.kind === 'image' ? media.src : media?.poster, video: media?.kind === 'video' };
  });

  if (!items.length) {
    return (
      <div className={`relative flex ${coverHeight} items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,rgba(var(--primary-rgb),0.2),rgba(var(--primary-rgb),0.05))] text-slate-400`}>
        <Home size={48} aria-hidden="true" />
        {badge && <span className="absolute right-4 top-4">{badge}</span>}
        <span className="absolute bottom-3 left-4 rounded-full bg-slate-900/60 px-3 py-1 text-xs font-bold text-white">No photos yet</span>
      </div>
    );
  }

  const rest = tiles.slice(1, 1 + thumbs);
  const hidden = Math.max(items.length - 1 - thumbs, 0);
  const Tile = ({ tile, index, className }) => (
    <button
      type="button"
      onClick={() => setViewer(index)}
      aria-label={`Open ${tile.video ? 'video' : 'photo'} ${index + 1} of ${items.length} — ${name}`}
      className={`relative overflow-hidden bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      {tile.src
        ? <img src={tile.src} alt="" loading="lazy" className="h-full w-full object-cover" />
        : <span className="flex h-full w-full items-center justify-center text-slate-400"><Home size={28} aria-hidden="true" /></span>}
      {tile.video && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/60 text-white"><Play size={18} fill="currentColor" /></span>
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Tile tile={tiles[0]} index={0} className={`block w-full rounded-[22px] ${coverHeight}`} />
        {badge && <span className="pointer-events-none absolute right-4 top-4">{badge}</span>}
        <span className="pointer-events-none absolute bottom-3 left-4 rounded-full bg-slate-900/60 px-3 py-1 text-xs font-bold text-white">
          {items.length} photo{items.length === 1 ? '' : 's'} and videos
        </span>
      </div>
      {rest.length > 0 && (
        <div className="grid grid-cols-4 gap-2.5">
          {rest.map((tile, i) => (
            <div key={i} className="relative">
              <Tile tile={tile} index={i + 1} className="block h-20 w-full rounded-2xl sm:h-24" />
              {hidden > 0 && i === rest.length - 1 && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/55 text-sm font-bold text-white">
                  +{hidden} more
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <MediaLightbox items={items} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
    </div>
  );
}

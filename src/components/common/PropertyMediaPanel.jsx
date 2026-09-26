import { useRef, useState } from 'react';
import { uploadPropertyMedia } from '../../api/propertyApi';
import { guessType, resolveMedia } from '../../utils/mediaUrl';
import MediaLightbox from './MediaLightbox';

// ── MediaThumbnail ─────────────────────────────────────────────────────────────

function MediaThumbnail({ item, index, onPreview, onRemove, readonly }) {
  const media = resolveMedia(item.url, item.type);
  const isVideo = media.kind !== 'image';

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
      {isVideo ? (
        <div
          className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer bg-slate-800 text-white gap-1"
          onClick={() => onPreview(index)}
        >
          {media.poster && (
            <img
              src={media.poster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-70"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <svg className="relative h-10 w-10 text-white/80 drop-shadow" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span className="relative text-xs text-white/70 px-2 text-center truncate max-w-full drop-shadow">
            {item.name || media.provider || 'Video'}
          </span>
        </div>
      ) : (
        <img
          src={media.src}
          alt={item.name}
          className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
          onClick={() => onPreview(index)}
          onError={(e) => { e.target.src = ''; e.target.style.display = 'none'; }}
        />
      )}

      {/* Overlay actions */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
        <button
          onClick={() => onPreview(index)}
          className="rounded-lg bg-white/20 backdrop-blur px-2 py-1 text-xs text-white font-medium hover:bg-white/30 transition"
        >
          {isVideo ? '▶ Play' : '🔍 View'}
        </button>
        {!readonly && (
          <button
            onClick={() => onRemove(index)}
            className="rounded-lg bg-rose-600/80 backdrop-blur px-2 py-1 text-xs text-white font-medium hover:bg-rose-700 transition"
          >
            ✕ Remove
          </button>
        )}
      </div>

      {/* Type badge */}
      <div className="absolute top-2 left-2">
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          isVideo ? 'bg-violet-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          {isVideo ? 'VID' : 'IMG'}
        </span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * PropertyMediaPanel
 *
 * Props:
 *   images    — current array of { url, type, name, size? }
 *   onChange  — called with the new array whenever images are added/removed
 *   onSave    — optional; if provided a "Save Media" button is shown that calls onSave(images)
 *   saving    — bool; disables save button while parent is saving
 *   readonly  — bool; hides upload/remove controls
 */
export default function PropertyMediaPanel({ images = [], onChange, onSave, saving = false, readonly = false }) {
  const fileInputRef = useRef();
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const items = Array.isArray(images) ? images : [];

  // ── File upload ──
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setUploadError('');
    setUploading(true);
    try {
      const uploaded = await uploadPropertyMedia(files);
      const newItems = uploaded.map((f) => ({
        url: f.url,
        type: f.type || guessType(f.url || ''),
        name: f.name || 'file',
        size: f.size || 0,
        public_id: f.public_id,
      }));
      onChange([...items, ...newItems]);
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Upload failed. Check Cloudinary settings.');
    } finally {
      setUploading(false);
    }
  };

  // ── URL paste ──
  const handleAddUrl = () => {
    const raw = urlInput.trim();
    if (!raw) return;
    try {
      new URL(raw); // validates URL structure
    } catch {
      setUrlError('Please enter a valid URL (must start with https://)');
      return;
    }
    setUrlError('');
    const { provider } = resolveMedia(raw);
    // Provider pages have no meaningful filename ("watch", "share"), so label them by host.
    const name = provider
      ? provider.charAt(0).toUpperCase() + provider.slice(1)
      : (raw.split('/').pop().split('?')[0] || 'link');
    onChange([...items, { url: raw, type: guessType(raw), name }]);
    setUrlInput('');
  };

  // ── Remove ──
  const handleRemove = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* The whole set goes in, not just the item that was tapped, so next
          and previous work without coming back out to the grid. */}
      <MediaLightbox
        items={items}
        index={lightboxIndex}
        onIndex={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />

      <div className="space-y-4">
        {/* Grid of existing media */}
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item, i) => (
              <MediaThumbnail
                key={`${item.url}-${i}`}
                item={item}
                index={i}
                onPreview={setLightboxIndex}
                onRemove={handleRemove}
                readonly={readonly}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-sm text-slate-400">
            <span className="text-3xl mb-2">🖼️</span>
            No media attached yet.
          </div>
        )}

        {!readonly && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Add Media</p>

            {/* File upload */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {uploading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload from device
                  </>
                )}
              </button>
              {uploadError && <p className="mt-1.5 text-xs text-rose-600">{uploadError}</p>}
            </div>

            {/* URL input */}
            <div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUrl())}
                  placeholder="Paste image or video URL…"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  disabled={!urlInput.trim()}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  Add Link
                </button>
              </div>
              {urlError && <p className="mt-1 text-xs text-rose-600">{urlError}</p>}
              <p className="mt-1 text-xs text-slate-400">Supports image URLs, YouTube, Vimeo, Loom, or direct video links.</p>
            </div>
          </div>
        )}

        {/* Save button (only shown in edit mode) */}
        {!readonly && onSave && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSave(items)}
              disabled={saving || uploading}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {saving ? 'Saving…' : `Save Media (${items.length} file${items.length !== 1 ? 's' : ''})`}
            </button>
            {items.length > 0 && (
              <span className="text-xs text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''} attached</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

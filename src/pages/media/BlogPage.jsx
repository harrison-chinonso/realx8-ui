import { useEffect, useMemo, useRef, useState } from 'react';
import { createBlogPost, deleteBlogPost, listBlog, updateBlogPost, uploadMediaFiles } from '../../api/mediaApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import ActionsMenu from '../../components/common/ActionsMenu';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const CATEGORY_OPTIONS = ['Market Updates', 'Investment Tips', 'Property Spotlight', 'Company News', 'Lifestyle'];
const STATUS_OPTIONS = ['draft', 'published'];

const emptyForm = () => ({
  title: '',
  category: CATEGORY_OPTIONS[0],
  tags: '',
  excerpt: '',
  content: '',
  status: 'draft',
  media_files: [],
});

const normalizeItems = (response) => response?.data ?? response ?? [];
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');
const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

function CoverPreview({ file, onRemove }) {
  if (!file) return null;

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <img src={file.url} alt={file.name || 'Cover'} className="h-48 w-full object-cover" />
      {onRemove && (
        <Button
          type="button"
          onClick={onRemove}
          variant="primary"
          size="sm"
          className="absolute right-2 top-2 rounded-full bg-black/60 hover:bg-black/70 active:bg-black/80"
        >
          Remove
        </Button>
      )}
    </div>
  );
}

export default function BlogPage() {
  const fileInputRef = useRef(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const loadArticles = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await listBlog();
      setArticles(normalizeItems(response));
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.userMessage);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const columns = useMemo(
    () => [
      { key: 'title', label: 'Title', render: (row) => row.title || '—' },
      { key: 'category', label: 'Category', render: (row) => row.category || '—' },
      { key: 'tags', label: 'Tags', render: (row) => row.tags || '—' },
      { key: 'status', label: 'Status', render: (row) => <Badge value={row.status || 'draft'} /> },
      { key: 'published_at', label: 'Published Date', render: (row) => formatDate(row.published_at) },
    ],
    []
  );

  const detailFields = useMemo(
    () => [
      { label: 'Title', key: 'title' },
      { label: 'Category', key: 'category' },
      { label: 'Tags', key: 'tags' },
      {
        label: 'Cover',
        render: (row) => row.media_files?.[0]?.url ? (
          <a href={row.media_files[0].url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            {row.media_files[0].url}
          </a>
        ) : '—',
      },
      { label: 'Status', render: (row) => <Badge value={row.status || 'draft'} /> },
      { label: 'Published Date', render: (row) => formatDate(row.published_at) },
      { label: 'Excerpt', key: 'excerpt' },
      { label: 'Content', render: (row) => row.content || row.caption || '—' },
    ],
    []
  );

  const openCreate = () => {
    setEditingArticle(null);
    setForm(emptyForm());
    setNotice('');
    setShowModal(true);
  };

  const openEdit = (article) => {
    setEditingArticle(article);
    setForm({
      title: article.title || '',
      category: article.category || CATEGORY_OPTIONS[0],
      tags: article.tags || '',
      excerpt: article.excerpt || '',
      content: article.content || article.caption || '',
      status: article.status || 'draft',
      media_files: Array.isArray(article.media_files) ? article.media_files.slice(0, 1) : [],
    });
    setNotice('');
    setShowModal(true);
  };

  const closeModal = (force = false) => {
    if ((saving || uploading) && !force) return;
    setShowModal(false);
    setEditingArticle(null);
    setForm(emptyForm());
  };

  const handleCoverUpload = async (files) => {
    if (!files.length) return;

    setUploading(true);
    setError('');

    try {
      const response = await uploadMediaFiles(files.slice(0, 1));
      setForm((current) => ({
        ...current,
        media_files: response.files?.slice(0, 1) || [],
      }));
    } catch (uploadError) {
      console.error(uploadError);
      setError(uploadError.userMessage);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        tags: form.tags.trim() || null,
        excerpt: form.excerpt.trim() || null,
        content: form.content.trim() || null,
        caption: form.excerpt.trim() || null,
        status: form.status,
        media_files: form.media_files,
      };

      if (editingArticle) {
        await updateBlogPost(editingArticle.id, payload);
      } else {
        await createBlogPost(payload);
      }

      closeModal(true);
      setNotice(`Article ${editingArticle ? 'updated' : 'created'} successfully.`);
      await loadArticles();
    } catch (submitError) {
      console.error(submitError);
      setError(getErrorMessage(submitError, `Failed to ${editingArticle ? 'update' : 'create'} blog article.`));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (article) => {
    if (!window.confirm(`Delete "${article.title}"?`)) return;

    try {
      await deleteBlogPost(article.id);
      setNotice('Article deleted successfully.');
      await loadArticles();
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError.userMessage);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Blog</h1>
          <p className="text-sm text-slate-500">Create and publish long-form content for the website.</p>
        </div>
        <Button onClick={openCreate}>+ New Article</Button>
      </div>

      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading blog articles...</p>
      ) : (
        <Table
          columns={columns}
          data={articles}
          renderActions={(row) => (
            <div className="flex justify-end gap-3">
              <Button onClick={() => openEdit(row)} variant="primary" size="sm">Edit</Button>
              <ActionsMenu
                items={[
                  { label: '👁 View Details', onClick: () => setDetailRow(row) },
                  { label: '🗑 Delete', variant: 'danger', onClick: () => handleDelete(row) },
                ]}
              />
            </div>
          )}
        />
      )}

      <DetailsModal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailRow?.title || 'Blog Details'}
        record={detailRow}
        fields={detailFields}
      />

      <Modal open={showModal} onClose={closeModal} title={editingArticle ? 'Edit Blog Article' : 'Create Blog Article'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title<FieldMark required /></label>
            <input
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category<FieldMark /></label>
              <Select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className={INPUT_CLASS}
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status<FieldMark /></label>
              <Select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className={INPUT_CLASS}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tags<FieldMark /></label>
            <input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              placeholder="real-estate, investments, lagos"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Excerpt<FieldMark /></label>
            <textarea
              rows={3}
              value={form.excerpt}
              onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
              className={INPUT_CLASS}
              placeholder="Short summary shown on listings and cards."
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cover Image<FieldMark /></label>
              <div
                className="cursor-pointer rounded-lg border-2 border-dashed border-slate-600 p-6 text-center transition-colors hover:border-slate-400"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={async (event) => {
                  event.preventDefault();
                  await handleCoverUpload(Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith('image/')));
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={async (event) => handleCoverUpload(Array.from(event.target.files || []))}
                />
                <p className="text-sm text-slate-400">Drag & drop a cover image here, or click to browse</p>
                <p className="mt-1 text-xs text-slate-500">Single image • Max 100MB • JPEG, PNG, GIF, WebP</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠ Media URLs must be publicly accessible for social platforms to fetch them.
            </div>

            {uploading && <p className="text-xs text-slate-500">Uploading cover image...</p>}
            <CoverPreview file={form.media_files[0]} onRemove={() => setForm((current) => ({ ...current, media_files: [] }))} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Content<FieldMark /></label>
            <textarea
              rows={8}
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              className={`${INPUT_CLASS} min-h-40`}
              placeholder="Write the article here."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving || uploading}>{saving ? 'Saving…' : editingArticle ? 'Save Changes' : 'Create Article'}</Button>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving || uploading}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

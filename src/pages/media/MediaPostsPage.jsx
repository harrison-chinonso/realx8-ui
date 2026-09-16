import { useEffect, useMemo, useRef, useState } from 'react';
import useAuthStore from '../../store/authStore';
import {
  listPosts,
  createPost,
  updatePost,
  deletePost,
  submitForReview,
  approvePost,
  rejectPost,
  publishPost,
  uploadMediaFiles,
} from '../../api/mediaApi';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Select from '../../components/ui/Select';
import FieldMark from '../../components/ui/FieldMark';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const CHANNELS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'X (Twitter)' },
];
const CHANNEL_LABELS = CHANNELS.reduce((acc, channel) => ({ ...acc, [channel.value]: channel.label }), {});
const STATUS_LABELS = {
  draft: 'Draft',
  review: 'Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
};
const TABS = [
  { id: 'all', label: 'All Posts' },
  { id: 'draft', label: 'Drafts' },
  { id: 'review', label: 'Pending Review' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
];

const emptyForm = () => ({
  title: '',
  type: 'social',
  body: '',
  channels: [],
  scheduled_at: '',
  media_files: [],
});

const normalizeItems = (response) => response?.data ?? response ?? [];
const normalizeDateTimeInput = (value) => (value ? new Date(value).toISOString().slice(0, 16) : '');
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '—');
const formatType = (value) => (value === 'blog' ? 'Blog' : 'Social');
const normalizeChannels = (channels) => (Array.isArray(channels) ? channels.map((channel) => String(channel).toLowerCase()) : []);
const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

function MediaPreviewGrid({ files = [], onRemove }) {
  if (!files.length) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {files.map((file, index) => (
        <div key={`${file.url}-${index}`} className="relative group overflow-hidden rounded-lg bg-slate-700 aspect-square">
          {file.type === 'image' ? (
            <img src={file.url} alt={file.name || 'upload'} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-2 text-center text-xs text-slate-300">
              <span className="text-2xl">🎬</span>
              <span className="w-full truncate">{file.name}</span>
            </div>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition group-hover:opacity-100"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function MediaPostsPage() {
  const user = useAuthStore((state) => state.user);
  const fileInputRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [workflowModal, setWorkflowModal] = useState({ type: '', post: null, scheduled_at: '', rejection_reason: '' });

  const canReview = Boolean(user && ['super_admin', 'admin', 'product_manager'].includes(user.type));

  const loadPosts = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await listPosts();
      setPosts(normalizeItems(response));
    } catch (loadError) {
      console.error(loadError);
      setError(err.userMessage);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const filteredPosts = useMemo(() => {
    if (activeTab === 'all') return posts;
    return posts.filter((post) => post.status === activeTab);
  }, [activeTab, posts]);

  const columns = useMemo(
    () => [
      { key: 'title', label: 'Title', render: (post) => post.title || '—' },
      { key: 'type', label: 'Type', render: (post) => formatType(post.type) },
      {
        key: 'channels',
        label: 'Channels',
        render: (post) => {
          const channels = normalizeChannels(post.channels);
          return channels.length ? channels.map((channel) => CHANNEL_LABELS[channel] || channel).join(', ') : '—';
        },
      },
      {
        key: 'media_files',
        label: 'Media',
        render: (post) => (post.media_files?.length ? `${post.media_files.length} file(s)` : '—'),
      },
      {
        key: 'status',
        label: 'Status',
        render: (post) => <Badge value={STATUS_LABELS[post.status] || post.status || 'Draft'} />,
      },
      {
        key: 'scheduled_at',
        label: 'Scheduled Date',
        render: (post) => formatDateTime(post.scheduled_at),
      },
      {
        key: 'author',
        label: 'Author',
        render: (post) => post.author?.name || post.created_by || '—',
      },
    ],
    []
  );

  const openCreate = () => {
    setEditingPost(null);
    setForm(emptyForm());
    setNotice('');
    setShowModal(true);
  };

  const openEdit = (post) => {
    setEditingPost(post);
    setForm({
      title: post.title || '',
      type: post.type || 'social',
      body: post.content || post.caption || '',
      channels: normalizeChannels(post.channels),
      scheduled_at: normalizeDateTimeInput(post.scheduled_at),
      media_files: Array.isArray(post.media_files) ? post.media_files : [],
    });
    setNotice('');
    setShowModal(true);
  };

  const closeModal = (force = false) => {
    if ((saving || uploading) && !force) return;
    setShowModal(false);
    setEditingPost(null);
    setForm(emptyForm());
  };

  const handleToggleChannel = (channel) => {
    setForm((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));
  };

  const handleMediaUpload = async (files) => {
    if (!files.length) return;

    setUploading(true);
    setError('');
    setNotice('');

    try {
      const response = await uploadMediaFiles(files);
      setForm((current) => ({
        ...current,
        media_files: [...(current.media_files || []), ...(response.files || [])],
      }));
    } catch (uploadError) {
      console.error(uploadError);
      setError(uploadError.userMessage);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    await handleMediaUpload(files);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    await handleMediaUpload(files);
  };

  const removeMediaFile = (index) => {
    setForm((current) => ({
      ...current,
      media_files: current.media_files.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    type: form.type,
    content: form.body.trim() || null,
    caption: form.body.trim() || null,
    channels: form.channels,
    scheduled_at: form.scheduled_at || null,
    media_files: form.media_files,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = buildPayload();
      if (editingPost) {
        await updatePost(editingPost.id, payload);
      } else {
        await createPost(payload);
      }
      closeModal(true);
      setNotice(`Post ${editingPost ? 'updated' : 'created'} successfully.`);
      await loadPosts();
    } catch (submitError) {
      console.error(submitError);
      setError(getErrorMessage(submitError, `Failed to ${editingPost ? 'update' : 'create'} media post.`));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    if (!window.confirm(`Delete "${post.title}"?`)) return;

    try {
      await deletePost(post.id);
      setNotice('Post deleted successfully.');
      await loadPosts();
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError.userMessage);
    }
  };

  const runAction = async (callback, fallbackMessage, successMessage) => {
    setSaving(true);
    setError('');

    try {
      const response = await callback();
      setWorkflowModal({ type: '', post: null, scheduled_at: '', rejection_reason: '' });
      if (response?.message || successMessage) setNotice(response?.message || successMessage);
      await loadPosts();
    } catch (actionError) {
      console.error(actionError);
      setError(getErrorMessage(actionError, fallbackMessage));
    } finally {
      setSaving(false);
    }
  };

  const renderActions = (post) => {
    const actions = [
      <Button key="edit" onClick={() => openEdit(post)} variant="primary" size="sm">Edit</Button>,
      <Button key="delete" onClick={() => handleDelete(post)} variant="danger" size="sm">Delete</Button>,
    ];

    if (post.status === 'draft') {
      actions.unshift(
        <Button
          key="submit"
          onClick={() => runAction(() => submitForReview(post.id), 'Failed to submit post for review.', 'Post submitted for review.')}
          variant="success"
          size="sm"
        >
          Submit for Review
        </Button>
      );
    }

    if (post.status === 'review' && canReview) {
      actions.unshift(
        <Button
          key="approve"
          onClick={() => setWorkflowModal({ type: 'approve', post, scheduled_at: normalizeDateTimeInput(post.scheduled_at), rejection_reason: '' })}
          variant="success"
          size="sm"
        >
          Approve
        </Button>,
        <Button
          key="reject"
          onClick={() => setWorkflowModal({ type: 'reject', post, scheduled_at: '', rejection_reason: post.rejection_reason || '' })}
          variant="warning"
          size="sm"
        >
          Reject
        </Button>
      );
    }

    if (post.status === 'approved') {
      actions.unshift(
        <Button
          key="schedule"
          onClick={() => setWorkflowModal({ type: 'schedule', post, scheduled_at: normalizeDateTimeInput(post.scheduled_at), rejection_reason: '' })}
          variant="primary"
          size="sm"
        >
          Schedule
        </Button>,
        <Button
          key="publish"
          onClick={() => runAction(() => publishPost(post.id), 'Failed to publish post.')}
          variant="success"
          size="sm"
        >
          Publish
        </Button>
      );
    }

    if (post.status === 'scheduled') {
      actions.unshift(
        <Button
          key="publish-now"
          onClick={() => runAction(() => publishPost(post.id), 'Failed to publish post.')}
          variant="success"
          size="sm"
        >
          Publish Now
        </Button>
      );
    }

    return <div className="flex flex-wrap justify-end gap-3">{actions}</div>;
  };

  const workflowTitle = {
    approve: 'Approve Post',
    reject: 'Reject Post',
    schedule: 'Schedule Post',
  }[workflowModal.type];

  const handleWorkflowSubmit = async (event) => {
    event.preventDefault();
    const { post, type, scheduled_at: scheduledAt, rejection_reason: rejectionReason } = workflowModal;
    if (!post) return;

    if (type === 'approve') {
      await runAction(
        () => approvePost(post.id, { scheduled_at: scheduledAt || null }),
        'Failed to approve post.',
        'Post approved successfully.'
      );
      return;
    }

    if (type === 'reject') {
      await runAction(
        () => rejectPost(post.id, { rejection_reason: rejectionReason.trim() || null }),
        'Failed to reject post.',
        'Post rejected successfully.'
      );
      return;
    }

    if (type === 'schedule') {
      if (!scheduledAt) {
        setError('Please choose a schedule date and time.');
        return;
      }

      await runAction(
        () => updatePost(post.id, { status: 'scheduled', scheduled_at: scheduledAt }),
        'Failed to schedule post.',
        'Post scheduled successfully.'
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Content Posts</h1>
          <p className="text-sm text-slate-500">Manage drafts, approvals, publishing, and channel delivery.</p>
        </div>
        <Button onClick={openCreate}>+ Create Post</Button>
      </div>

      <div className="flex flex-wrap rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((tab) => (
          <Button key={tab.id} onClick={() => setActiveTab(tab.id)} variant={activeTab === tab.id ? 'primary' : 'ghost'} size="sm">
            {tab.label}
          </Button>
        ))}
      </div>

      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading media posts...</p>
      ) : (
        <Table columns={columns} data={filteredPosts} renderActions={renderActions} />
      )}

      <Modal open={showModal} onClose={closeModal} title={editingPost ? 'Edit Post' : 'Create Post'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title<FieldMark required /></label>
            <input
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className={INPUT_CLASS}
              placeholder="Campaign title"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type<FieldMark /></label>
              <Select
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                className={INPUT_CLASS}
              >
                <option value="social">Social Post</option>
                <option value="blog">Blog Article</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Schedule Date & Time<FieldMark /></label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(event) => setForm((current) => ({ ...current, scheduled_at: event.target.value }))}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Caption / Content<FieldMark /></label>
            <textarea
              rows={6}
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              className={`${INPUT_CLASS} min-h-32`}
              placeholder="Write the social copy or article summary here..."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Target Channels<FieldMark /></label>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHANNELS.map((channel) => (
                <label key={channel.value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.channels.includes(channel.value)}
                    onChange={() => handleToggleChannel(channel.value)}
                  />
                  <span>{channel.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Images / Videos<FieldMark /></label>
              <div
                className="cursor-pointer rounded-lg border-2 border-dashed border-slate-600 p-6 text-center transition-colors hover:border-slate-400"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                />
                <p className="text-sm text-slate-400">Drag & drop images/videos here, or click to browse</p>
                <p className="mt-1 text-xs text-slate-500">Max 100MB per file • JPEG, PNG, GIF, WebP, MP4, MOV</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠ Media URLs must be publicly accessible for social platforms to fetch them.
            </div>

            {uploading && <p className="text-xs text-slate-500">Uploading files...</p>}
            <MediaPreviewGrid files={form.media_files} onRemove={removeMediaFile} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving || uploading}>{saving ? 'Saving…' : editingPost ? 'Save Changes' : 'Create Post'}</Button>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving || uploading}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(workflowModal.post)} onClose={() => !saving && setWorkflowModal({ type: '', post: null, scheduled_at: '', rejection_reason: '' })} title={workflowTitle || 'Update Post'}>
        <form onSubmit={handleWorkflowSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">{workflowModal.post?.title || 'Selected post'}</p>
            {workflowModal.post?.media_files?.length > 0 && <div className="mt-3"><MediaPreviewGrid files={workflowModal.post.media_files} /></div>}
          </div>

          {workflowModal.type === 'approve' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Optional schedule date<FieldMark /></label>
              <input
                type="datetime-local"
                value={workflowModal.scheduled_at}
                onChange={(event) => setWorkflowModal((current) => ({ ...current, scheduled_at: event.target.value }))}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-slate-500">Leave blank to keep the post approved and publish later.</p>
            </div>
          )}

          {workflowModal.type === 'schedule' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Schedule date & time<FieldMark required /></label>
              <input
                type="datetime-local"
                required
                value={workflowModal.scheduled_at}
                onChange={(event) => setWorkflowModal((current) => ({ ...current, scheduled_at: event.target.value }))}
                className={INPUT_CLASS}
              />
            </div>
          )}

          {workflowModal.type === 'reject' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reason for rejection<FieldMark /></label>
              <textarea
                rows={4}
                value={workflowModal.rejection_reason}
                onChange={(event) => setWorkflowModal((current) => ({ ...current, rejection_reason: event.target.value }))}
                className={INPUT_CLASS}
                placeholder="Explain what needs to change before approval."
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setWorkflowModal({ type: '', post: null, scheduled_at: '', rejection_reason: '' })}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { listPosts, syncImpressions } from '../../api/mediaApi';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import useAuthStore from '../../store/authStore';

const CHANNELS = ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'X'];
const normalizeItems = (response) => response?.data ?? response ?? [];
const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function MediaAnalyticsPage() {
  const { hasPermission } = useAuthStore();
  const canSync = hasPermission('media.posts.manage') || hasPermission('*');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const load = () => {
    setLoading(true);
    listPosts()
      .then((response) => setPosts(normalizeItems(response)))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      await syncImpressions();
      setSyncMsg('Impressions synced successfully.');
      load();
    } catch (err) {
      setSyncMsg(err?.response?.data?.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const metrics = useMemo(() => {
    const socialPosts = posts.filter((post) => post.type === 'social');

    const totals = socialPosts.reduce(
      (acc, post) => ({
        reach: acc.reach + Number(post.reach || 0),
        impressions: acc.impressions + Number(post.impressions || 0),
        engagement: acc.engagement + Number(post.engagement_rate || 0),
        leads: acc.leads + Number(post.leads_generated || 0),
      }),
      { reach: 0, impressions: 0, engagement: 0, leads: 0 }
    );

    const channelMetrics = CHANNELS.map((channel) => {
      const matchingPosts = socialPosts.filter((post) => Array.isArray(post.channels) && post.channels.includes(channel));
      return {
        channel,
        impressions: matchingPosts.reduce((sum, post) => sum + Number(post.impressions || 0), 0),
      };
    });

    const maxImpressions = Math.max(...channelMetrics.map((item) => item.impressions), 1);
    const recentPosts = [...socialPosts].sort((a, b) => new Date(b.published_at || b.updatedAt || 0) - new Date(a.published_at || a.updatedAt || 0));

    return { totals, channelMetrics, maxImpressions, recentPosts };
  }, [posts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Media Analytics</h1>
          <p className="text-sm text-slate-500">Monitor social performance across channels and recent campaigns.</p>
        </div>
        {canSync && (
          <div className="flex flex-col items-end gap-1">
            <Button onClick={handleSyncNow} disabled={syncing} size="sm">
              {syncing ? 'Syncing…' : '↻ Sync Impressions Now'}
            </Button>
            {syncMsg && <p className="text-xs text-slate-500">{syncMsg}</p>}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Reach" value={formatNumber(metrics.totals.reach)} />
        <StatCard label="Total Impressions" value={formatNumber(metrics.totals.impressions)} />
        <StatCard label="Total Engagement" value={formatPercent(metrics.totals.engagement)} />
        <StatCard label="Leads Generated" value={formatNumber(metrics.totals.leads)} />
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Channel Impressions</h2>
          <p className="text-sm text-slate-500">Impressions by social platform.</p>
        </div>

        <div className="space-y-4">
          {metrics.channelMetrics.map((item) => (
            <div key={item.channel} className="space-y-1">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>{item.channel === 'X' ? 'X (Twitter)' : item.channel}</span>
                <span>{formatNumber(item.impressions)}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full bg-blue-600"
                  style={{ width: `${Math.max((item.impressions / metrics.maxImpressions) * 100, item.impressions ? 8 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recent Post Metrics</h2>
          <p className="text-sm text-slate-500">Latest social posts and their topline performance.</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading analytics...</p>
        ) : (
          <Table
            columns={[
              { key: 'title', label: 'Post', render: (row) => row.title || '—' },
              { key: 'reach', label: 'Reach', render: (row) => formatNumber(row.reach) },
              { key: 'impressions', label: 'Impressions', render: (row) => formatNumber(row.impressions) },
              { key: 'engagement_rate', label: 'Engagement Rate', render: (row) => formatPercent(row.engagement_rate) },
              { key: 'impressions_synced_at', label: 'Last Synced', render: (row) => row.impressions_synced_at ? new Date(row.impressions_synced_at).toLocaleString() : '—' },
            ]}
            rows={metrics.recentPosts.slice(0, 10)}
          />
        )}
      </div>
    </div>
  );
}

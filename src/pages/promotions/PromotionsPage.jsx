import { useCallback, useEffect, useState } from 'react';
import {
  listPromotions, getPromotion, setPromotionStatus, promotionAnalytics,
} from '../../api/promotionApi';
import { useCurrency } from '../../context/useAppearance';
import { usePermission } from '../../hooks/usePermission';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import PromotionWizard from '../../components/promotions/PromotionWizard';
import { useAssistantHandoff } from '../../assistant/useAssistantHandoff';

/**
 * Every campaign, and how each is doing.
 *
 * ── The three figures that matter ───────────────────────────────────────────
 *
 * Original value, discount granted, actual sales value. A promotions dashboard
 * that shows only a redemption count answers "did anybody use it" and not "was
 * it worth running" — which is the question a company is actually asking when
 * it opens this screen.
 */

const STATUS_WORDS = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  ACTIVE: 'Running',
  PAUSED: 'Paused',
  EXPIRED: 'Ended',
  DEACTIVATED: 'Switched off',
  ARCHIVED: 'Archived',
};

/** What a person can do to a campaign from where it is now. */
const ACTIONS = {
  DRAFT: [['ACTIVE', 'Publish'], ['ARCHIVED', 'Archive']],
  SCHEDULED: [['ACTIVE', 'Start now'], ['PAUSED', 'Pause'], ['DEACTIVATED', 'Switch off']],
  ACTIVE: [['PAUSED', 'Pause'], ['DEACTIVATED', 'Switch off']],
  PAUSED: [['ACTIVE', 'Resume'], ['DEACTIVATED', 'Switch off']],
  DEACTIVATED: [['ARCHIVED', 'Archive']],
  EXPIRED: [['ARCHIVED', 'Archive']],
  ARCHIVED: [],
};

const TABS = [
  { key: 'live', label: 'Running', match: (p) => ['ACTIVE', 'SCHEDULED'].includes(p.status), empty: 'No promotion is running at the moment.' },
  { key: 'draft', label: 'Drafts', match: (p) => p.status === 'DRAFT', empty: 'No drafts. Start one with the button above.' },
  { key: 'finished', label: 'Finished', match: (p) => ['EXPIRED', 'DEACTIVATED', 'PAUSED'].includes(p.status), empty: 'Nothing has finished yet.' },
  { key: 'all', label: 'All', match: () => true, empty: 'No promotions have been set up yet.' },
];

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

export default function PromotionsPage() {
  const fmt = useCurrency();
  const canManage = usePermission('promotions.manage');
  const canPublish = usePermission('promotions.publish');

  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [tab, setTab] = useState('live');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  // From the assistant: open the wizard on a blank promotion, with the name
  // filled in if one was mentioned. `{}` rather than null is what the modal
  // reads as "new" — see the Modal's `editing !== null` test below.
  const promotionHandoff = useAssistantHandoff('create-promotion');
  useEffect(() => {
    if (promotionHandoff) setEditing(promotionHandoff.name ? { name: promotionHandoff.name } : {});
  }, [promotionHandoff]);

  const load = useCallback(() => {
    setLoading(true);
    listPromotions()
      .then((rows) => { setItems(rows || []); setFailed(''); })
      // "We could not look" is a different answer from "there is nothing", and
      // an empty table renders them identically.
      .catch((error) => setFailed(error?.response?.data?.message || 'Promotions could not be loaded just now.'))
      .finally(() => setLoading(false));
    promotionAnalytics().then(setTotals).catch(() => setTotals(null));
  }, []);

  useEffect(() => { load(); }, [load]);

  const move = async (promotion, status) => {
    setBusy(true);
    try {
      await setPromotionStatus(promotion.id, status);
      load();
    } catch (error) {
      const data = error?.response?.data;
      alert((data?.errors || []).map((e) => e.message).join('\n') || data?.message || 'That did not go through.');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = async (promotion) => {
    const full = await getPromotion(promotion.id).catch(() => null);
    if (full) setEditing({ ...full, ...full.config, id: full.id });
  };

  const active = TABS.find((entry) => entry.key === tab) || TABS[0];
  const visible = items.filter(active.match);
  const countFor = (entry) => items.filter(entry.match).length;

  const columns = [
    {
      header: 'Promotion',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800">{row.name}</div>
          {row.code && (
            <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
              {row.code}
            </span>
          )}
        </div>
      ),
    },
    { header: 'Status', render: (row) => <Badge value={STATUS_WORDS[row.status] || row.status} /> },
    {
      header: 'Runs',
      render: (row) => `${formatDate(row.starts_at)} – ${row.ends_at ? formatDate(row.ends_at) : 'no end date'}`,
    },
    { header: 'Used', render: (row) => row.redemptions ?? 0 },
    { header: 'Discount given', render: (row) => (row.discount_granted ? fmt(row.discount_granted) : '—') },
    { header: 'Sales under it', render: (row) => (row.sales_value ? fmt(row.sales_value) : '—') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Promotions</h1>
          <p className="text-sm text-slate-500">
            Campaigns change what a buyer pays. They never change what a unit is priced at.
          </p>
        </div>
        {canManage && <Button onClick={() => setEditing({})}>+ New Promotion</Button>}
      </div>

      {/*
        Original → given away → actually taken. The shape of the question,
        rather than three unrelated numbers in a row.
      */}
      {totals && totals.redemptions > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ['Sold at list price', fmt(totals.original_value)],
            ['Given away', fmt(totals.discount_granted)],
            ['Actually taken', fmt(totals.sales_value)],
            ['Units sold', String(totals.units_sold)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      )}

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}

      <div className="flex flex-wrap border-b border-slate-200">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === entry.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {entry.label}
            {countFor(entry) > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {countFor(entry)}
              </span>
            )}
          </button>
        ))}
      </div>

      <Table
        columns={columns}
        data={visible}
        loading={loading}
        emptyMessage={active.empty}
        exportName="promotions"
        renderActions={(row) => (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/*
              Editable at any stage except archived. An edit writes a NEW
              version and every past purchase keeps the one it used, so there is
              nothing to protect by forbidding it.
            */}
            {canManage && row.status !== 'ARCHIVED' && (
              <Button size="sm" variant="primary" onClick={() => openEdit(row)}>Edit</Button>
            )}
            {canPublish && (ACTIONS[row.status] || []).map(([status, label]) => (
              <Button key={status} size="sm" variant="secondary" disabled={busy} onClick={() => move(row, status)}>
                {label}
              </Button>
            ))}
          </div>
        )}
      />

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${editing.name}` : 'New Promotion'}
        size="xl"
      >
        {editing !== null && (
          <PromotionWizard
            existing={editing?.id ? editing : null}
            initialName={editing?.id ? '' : (editing?.name || '')}
            onSaved={() => { setEditing(null); load(); }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

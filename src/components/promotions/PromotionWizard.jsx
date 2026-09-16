import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPromotion, updatePromotion, previewPromotion, setPromotionStatus,
} from '../../api/promotionApi';
import { listProperties, getPropertyUnits } from '../../api/propertyApi';
import { useCurrency } from '../../context/useAppearance';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import MoneyInput from '../ui/MoneyInput';
import PromotionTypeFields from './PromotionTypeFields';
import { numberOrUndefined } from '../../utils/numberField';
import FieldMark, { requiredFromChildren } from '../ui/FieldMark';

/**
 * Setting up a campaign, one decision at a time.
 *
 * ── Why a wizard and not one long form ──────────────────────────────────────
 *
 * A promotion has six unrelated groups of settings — what it is, what it covers,
 * what qualifies, what it gives, what limits it, and whether it goes live. On
 * one page they compete for attention and the ones further down get skipped,
 * which is how a campaign ends up live with no end date and no cap.
 *
 * ── The preview is always on screen ─────────────────────────────────────────
 *
 * Not a final step you reach and click. Configuration whose effect you can only
 * see by navigating away is configuration you check once; a figure that moves
 * while you type is one you cannot help noticing. It runs the real engine on
 * the server, so what it shows is what a purchase will do.
 */

const STEPS = [
  { key: 'basics', label: 'The basics' },
  { key: 'scope', label: 'What it covers' },
  { key: 'qualify', label: 'What qualifies' },
  { key: 'benefit', label: 'What it gives' },
  { key: 'limits', label: 'Limits' },
  { key: 'publish', label: 'Publish' },
];

const BLANK = {
  name: '',
  description: '',
  benefit_type: 'PERCENTAGE',
  percentage: 10,
  scope: { property_ids: [], unit_ids: [] },
  combination: [],
  tiers: [],
  perks: [],
  eligibility: { audience: 'EVERYONE' },
  payment_condition: 'ANY',
  limits: {},
  trigger: 'AUTOMATIC',
  priority: 100,
  stackable: false,
};

const Field = ({ label, hint, children }) => (
  <label className="block space-y-1">
    <span className="text-sm font-medium text-slate-700">
      {label}
      {/* Read off the control this wraps, so the mark cannot disagree with it. */}
      <FieldMark required={requiredFromChildren(children)} />
    </span>
    {children}
    {hint && <span className="block text-xs text-slate-500">{hint}</span>}
  </label>
);

export default function PromotionWizard({ existing = null, initialName = '', onSaved, onCancel }) {
  const fmt = useCurrency();
  const [step, setStep] = useState(0);
  /*
   * `initialName` is for a NEW promotion that arrived with a name already —
   * from the assistant, which heard "create a promotion called Easter Offer".
   * It cannot ride in on `existing`, because a truthy `existing` is what marks
   * this as an EDIT: the save would go to the wrong endpoint and the wizard
   * would open on a promotion that does not exist.
   */
  const [draft, setDraft] = useState(() => ({
    ...BLANK,
    ...(existing?.config || {}),
    ...(existing || {}),
    ...(existing ? {} : { name: initialName || BLANK.name }),
  }));
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const patch = useCallback((next) => setDraft((current) => ({ ...current, ...next })), []);

  useEffect(() => {
    listProperties({ limit: 200 })
      .then((res) => setProperties(res?.data ?? res ?? []))
      .catch(() => setProperties([]));
  }, []);

  /** The units of whichever properties are in scope — nothing else can qualify. */
  const scopedPropertyIds = draft.scope?.property_ids || [];
  useEffect(() => {
    if (!scopedPropertyIds.length) { setUnits([]); return; }
    Promise.all(scopedPropertyIds.map((id) => getPropertyUnits(id).catch(() => [])))
      .then((sets) => setUnits(sets.flatMap((set) => set?.data ?? set ?? [])))
      .catch(() => setUnits([]));
  }, [scopedPropertyIds.join(',')]);

  /** A basket to test against: whatever is in scope, at the quantity being tried. */
  const [testQuantity, setTestQuantity] = useState(1);
  const testLines = useMemo(() => {
    const chosen = units.filter((unit) => (draft.scope?.unit_ids || []).includes(unit.id));
    const source = chosen.length ? chosen : units;
    return source.slice(0, 3).map((unit) => ({
      unit_id: unit.id,
      property_id: unit.property_id,
      quantity: testQuantity,
      unit_price: Number(unit.price) || 0,
    }));
  }, [units, draft.scope?.unit_ids, testQuantity]);

  /**
   * Re-priced whenever anything that could change the answer changes.
   *
   * Debounced, because it is a round trip on every keystroke otherwise — and
   * the figure lagging half a second behind the field is much less confusing
   * than a figure that flickers through the states of a half-typed number.
   */
  useEffect(() => {
    if (!testLines.length || !draft.benefit_type) { setPreview(null); return undefined; }
    const timer = setTimeout(() => {
      previewPromotion({
        config: draft,
        lines: testLines,
        payment_type: draft.payment_condition === 'INSTALLMENT_ONLY' ? 'installment' : 'outright',
        buyer: { id: 0, completed_purchases: 0 },
      })
        .then((res) => setPreview(res))
        .catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [JSON.stringify(draft), JSON.stringify(testLines)]);

  const save = async (publish = false) => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = existing?.id
        ? await updatePromotion(existing.id, draft)
        : await createPromotion(draft);
      const id = existing?.id || saved?.id;

      if (publish) {
        await setPromotionStatus(id, draft.starts_at && new Date(draft.starts_at) > new Date() ? 'SCHEDULED' : 'ACTIVE');
      }
      setMessage({ tone: 'success', text: publish ? 'Published.' : 'Saved as a draft.' });
      onSaved?.(id);
    } catch (error) {
      const data = error?.response?.data;
      setMessage({
        tone: 'error',
        // The server's validation errors are the useful part — say them, rather
        // than a generic failure the admin cannot act on.
        text: (data?.errors || []).map((e) => e.message).join(' ') || data?.message || 'That did not save.',
      });
    } finally {
      setSaving(false);
    }
  };

  const errors = preview?.validation?.errors || [];
  const warnings = preview?.validation?.warnings || [];
  const current = STEPS[step];

  const toggleIn = (list, value) => (list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {/* Wraps rather than scrolls, so no step can be pushed out of sight. */}
        <div className="flex flex-wrap gap-1 border-b border-slate-200">
          {STEPS.map((entry, index) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setStep(index)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                step === index
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {index + 1}. {entry.label}
            </button>
          ))}
        </div>

        {current.key === 'basics' && (
          <div className="space-y-3">
            <Input label="Name" value={draft.name || ''} onChange={(e) => patch({ name: e.target.value })} required />
            <Field label="Description" hint="For your own records. The customer-facing wording is further down.">
              <textarea
                rows={2} value={draft.description || ''}
                onChange={(e) => patch({ description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Starts" type="date" value={(draft.starts_at || '').slice(0, 10)} onChange={(e) => patch({ starts_at: e.target.value })} />
              <Input label="Ends" type="date" value={(draft.ends_at || '').slice(0, 10)} onChange={(e) => patch({ ends_at: e.target.value })} />
            </div>
            <Field label="How buyers get it">
              <Select value={draft.trigger || 'AUTOMATIC'} onChange={(e) => patch({ trigger: e.target.value })}>
                <option value="AUTOMATIC">Applied automatically when they qualify</option>
                <option value="CODE">Only when they enter a code</option>
              </Select>
            </Field>
            {draft.trigger === 'CODE' && (
              <Input
                label="Code" value={draft.code || ''}
                onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
                placeholder="BLACKFRIDAY20"
              />
            )}
            <Field label="What buyers are told" hint="Shown on the property page and at checkout.">
              <textarea
                rows={2} value={draft.customer_message || ''}
                onChange={(e) => patch({ customer_message: e.target.value })}
                placeholder="Independence Day Offer — 20% off all full plots."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Terms and conditions" hint="Buyers can read these before they commit.">
              <textarea
                rows={3} value={draft.terms || ''}
                onChange={(e) => patch({ terms: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
        )}

        {current.key === 'scope' && (
          <div className="space-y-3">
            <Field label="Properties" hint="Choose at least one. Naming nothing would apply this to everything you sell.">
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {properties.map((property) => (
                  <label key={property.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={scopedPropertyIds.includes(property.id)}
                      onChange={() => patch({
                        scope: { ...draft.scope, property_ids: toggleIn(scopedPropertyIds, property.id) },
                      })}
                    />
                    {property.name}
                  </label>
                ))}
                {!properties.length && <p className="px-2 py-3 text-sm text-slate-500">No properties to choose from.</p>}
              </div>
            </Field>

            <Field
              label="Units"
              hint="Leave every one unticked to cover the whole property. Tick some to narrow it to those."
            >
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {units.map((unit) => (
                  <label key={unit.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={(draft.scope?.unit_ids || []).includes(unit.id)}
                      onChange={() => patch({
                        scope: { ...draft.scope, unit_ids: toggleIn(draft.scope?.unit_ids || [], unit.id) },
                      })}
                    />
                    {unit.name}
                    <span className="text-slate-400">{fmt(Number(unit.price) || 0)}</span>
                  </label>
                ))}
                {!units.length && (
                  <p className="px-2 py-3 text-sm text-slate-500">Choose a property first.</p>
                )}
              </div>
            </Field>
          </div>
        )}

        {current.key === 'qualify' && (
          <div className="space-y-3">
            <Field label="Least number of units" hint="Leave empty for no minimum.">
              <Input
                type="number" min="0" value={draft.min_quantity ?? ''}
                onChange={(e) => patch({ min_quantity: numberOrUndefined(e.target.value) })}
              />
            </Field>
            <Field label="Least purchase value" hint="Leave empty for no minimum.">
              <MoneyInput
                value={String((draft.min_purchase_minor ?? 0) / 100)}
                onChange={(value) => patch({ min_purchase_minor: Math.round(Number(value || 0) * 100) || undefined })}
              />
            </Field>

            <Field
              label="Required combination"
              hint="For offers like “buy a full plot AND a half plot”. Every line must be satisfied."
            >
              <div className="space-y-2">
                {(draft.combination || []).map((requirement, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
                    <input
                      type="number" min="1" value={requirement.quantity ?? ''}
                      onChange={(e) => patch({
                        combination: draft.combination.map((entry, i) => (i === index
                          ? { ...entry, quantity: numberOrUndefined(e.target.value) } : entry)),
                      })}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <span className="text-sm text-slate-500">×</span>
                    <Select
                      value={requirement.unit_id ?? ''}
                      onChange={(e) => {
                        const unit = units.find((u) => String(u.id) === e.target.value);
                        patch({
                          combination: draft.combination.map((entry, i) => (i === index
                            ? { ...entry, unit_id: numberOrUndefined(e.target.value), label: unit?.name } : entry)),
                        });
                      }}
                    >
                      <option value="">Choose a unit</option>
                      {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                    </Select>
                    <button
                      type="button"
                      onClick={() => patch({ combination: draft.combination.filter((unused, i) => i !== index) })}
                      className="ml-auto text-sm text-slate-400 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <Button
                  type="button" variant="secondary" size="sm"
                  onClick={() => patch({ combination: [...(draft.combination || []), { quantity: 1, unit_id: '' }] })}
                >
                  + Require a unit
                </Button>
              </div>
            </Field>

            <Field label="Who it is for">
              <Select
                value={draft.eligibility?.audience || 'EVERYONE'}
                onChange={(e) => patch({ eligibility: { ...draft.eligibility, audience: e.target.value } })}
              >
                <option value="EVERYONE">Everyone</option>
                <option value="NEW_CUSTOMERS">New customers only</option>
                <option value="EXISTING_CUSTOMERS">Returning customers only</option>
                <option value="FIRST_PURCHASE">Their first purchase only</option>
                <option value="SELECTED_CUSTOMERS">Selected customers</option>
                <option value="SELECTED_REALTORS">Buyers introduced by selected agents</option>
              </Select>
            </Field>

            <Field label="Payment arrangement">
              <Select
                value={draft.payment_condition || 'ANY'}
                onChange={(e) => patch({ payment_condition: e.target.value })}
              >
                <option value="ANY">Any</option>
                <option value="OUTRIGHT_ONLY">Outright payment only</option>
                <option value="INSTALLMENT_ONLY">Instalment plans only</option>
              </Select>
            </Field>
          </div>
        )}

        {current.key === 'benefit' && (
          <div className="space-y-3">
            <Field label="What it gives">
              <Select value={draft.benefit_type} onChange={(e) => patch({ benefit_type: e.target.value })}>
                <option value="PERCENTAGE">A percentage off</option>
                <option value="FIXED_AMOUNT">A fixed amount off</option>
                <option value="TIERED">More off the more they buy</option>
                <option value="BUY_X_GET_Y">Buy some, get one free or discounted</option>
                <option value="NON_MONETARY">Something other than money off</option>
              </Select>
            </Field>
            <PromotionTypeFields draft={draft} patch={patch} units={units} />
          </div>
        )}

        {current.key === 'limits' && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Most redemptions in total">
                <Input
                  type="number" min="1" value={draft.limits?.total_redemptions ?? ''}
                  onChange={(e) => patch({ limits: { ...draft.limits, total_redemptions: numberOrUndefined(e.target.value) } })}
                />
              </Field>
              <Field label="Most per customer">
                <Input
                  type="number" min="1" value={draft.limits?.per_customer ?? ''}
                  onChange={(e) => patch({ limits: { ...draft.limits, per_customer: numberOrUndefined(e.target.value) } })}
                />
              </Field>
              <Field label="Most per day">
                <Input
                  type="number" min="1" value={draft.limits?.per_day ?? ''}
                  onChange={(e) => patch({ limits: { ...draft.limits, per_day: numberOrUndefined(e.target.value) } })}
                />
              </Field>
              <Field label="Most units">
                <Input
                  type="number" min="1" value={draft.limits?.total_units ?? ''}
                  onChange={(e) => patch({ limits: { ...draft.limits, total_units: numberOrUndefined(e.target.value) } })}
                />
              </Field>
            </div>
            <Field label="Order against other offers" hint="Lower numbers are considered first.">
              <Input
                type="number" min="1" value={draft.priority ?? 100}
                onChange={(e) => patch({ priority: numberOrUndefined(e.target.value) })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox" checked={Boolean(draft.stackable)}
                onChange={(e) => patch({ stackable: e.target.checked })}
              />
              May be combined with other offers
            </label>
          </div>
        )}

        {current.key === 'publish' && (
          <div className="space-y-3">
            {errors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">This cannot go live yet:</p>
                {errors.map((finding) => (
                  <p key={finding.code + finding.at} className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {finding.message}
                  </p>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                This promotion is ready. Saving as a draft keeps it out of sight until you publish.
              </p>
            )}
            {warnings.map((finding) => (
              <p key={finding.code + finding.at} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {finding.message}
              </p>
            ))}
          </div>
        )}

        {message && (
          <p className={`rounded-lg px-3 py-2 text-sm ${
            message.tone === 'success'
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
              : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
          }`}>
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>
          )}
          {step < STEPS.length - 1 && (
            <Button type="button" onClick={() => setStep(step + 1)}>Next</Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button type="button" variant="secondary" onClick={() => save(false)} disabled={saving}>
              {saving ? 'Saving…' : 'Save as draft'}
            </Button>
            <Button type="button" onClick={() => save(true)} disabled={saving || errors.length > 0}>
              Publish
            </Button>
          </div>
        </div>
      </div>

      {/* ── the preview, always on screen ─────────────────────────────────── */}
      <aside className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">What this would do</h3>
          <p className="text-xs text-slate-500">
            Run through the real engine, on the units you have chosen.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Try it with this many of each<FieldMark /></span>
          <input
            type="number" min="1" max="20" value={testQuantity}
            onChange={(e) => setTestQuantity(Math.max(Number(e.target.value) || 1, 1))}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>

        {!testLines.length ? (
          <p className="text-sm text-slate-500">Choose a property and unit to see a price.</p>
        ) : preview?.data ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Normally</span>
              <span className="text-slate-700">{fmt(preview.data.original)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Discount</span>
              <span className="font-medium text-emerald-700">−{fmt(preview.data.discount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-800">They pay</span>
              <span className="font-bold text-slate-900">{fmt(preview.data.payable)}</span>
            </div>

            {preview.data.applied?.[0]?.capped && (
              <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                The cap reduced this from {fmt(preview.data.applied[0].claimed_minor / 100)}.
              </p>
            )}

            {/*
              Why nothing applied is more useful than silence. An admin looking
              at a zero discount needs to know whether the basket is too small,
              the units are out of scope, or the rules are incomplete.
            */}
            {preview.data.discount === 0 && preview.data.considered?.[0] && (
              <p className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                {preview.data.considered[0].message}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Working…</p>
        )}
      </aside>
    </div>
  );
}

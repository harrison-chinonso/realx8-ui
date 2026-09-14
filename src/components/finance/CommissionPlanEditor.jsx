import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import MoneyInput from '../ui/MoneyInput';
import { validateCommissionPlan, simulateCommissionPlan } from '../../api/commissionApi';
import { useCurrency } from '../../context/useAppearance';

/**
 * Composing a commission structure.
 *
 * ── Structure on the left, consequences on the right ────────────────────────
 *
 * The single hardest thing about a plan is that its cost is not visible from
 * its parts. "6% direct, 1.5/1/0.5 to three generations, capped at 8%" is four
 * numbers whose only interesting property — what a deal actually pays, and to
 * whom — requires running the engine. So the right-hand column runs it, on
 * every edit, and shows the allocation and the cost ratio.
 *
 * That is also why the simulation is a server call rather than arithmetic in
 * this file. It is the SAME function a live calculation uses; a preview
 * computed here would be a second implementation, and the moment the two
 * disagreed the preview would be worse than none.
 *
 * ── Why percentages ask what they are a percentage OF ───────────────────────
 *
 * Every rate carries a `basis`, and the field is never left to a default. "1.5%
 * generational" is ambiguous — of the property price, or of what the seller
 * earned? Both produce a plausible number and only one is intended, so the form
 * makes it a choice rather than an omission.
 */

const BASIS_OPTIONS = [
  { value: 'OF_COMMISSIONABLE_BASE', label: 'the property price (commissionable base)' },
  { value: 'OF_POOL', label: "the deal's commission pool" },
  { value: 'OF_DIRECT_EARNER_COMMISSION', label: "what the selling realtor earned" },
  { value: 'OF_DOWNLINE_COMMISSION', label: 'what the person below them earned' },
];

const CB_OPTIONS = [
  { value: 'GROSS_PRICE', label: 'Gross price' },
  { value: 'NET_OF_DISCOUNT', label: 'Price after discount' },
  { value: 'NET_OF_COMPONENTS', label: 'Price less pass-through charges' },
  { value: 'DECLARED_AMOUNT', label: 'A fixed declared amount per unit' },
];

const POOL_OPTIONS = [
  { value: 'UNCAPPED', label: 'No cap — pay whatever the rules produce' },
  { value: 'PERCENTAGE', label: 'A percentage of the price' },
  { value: 'FLAT', label: 'A flat amount per deal' },
  { value: 'FLAT_PER_UNIT', label: 'A flat amount per unit' },
  { value: 'HYBRID', label: 'A percentage, with a floor and ceiling' },
];

const RESOLUTION_OPTIONS = [
  { value: 'PRORATE', label: 'Scale everyone down proportionally' },
  { value: 'PROTECT_DIRECT', label: 'Pay the seller in full, scale the uplines' },
  { value: 'PRIORITY_ORDER', label: 'Pay in order until the pool runs out' },
  { value: 'REJECT', label: 'Refuse the deal and raise it for review' },
];

const SURPLUS_OPTIONS = [
  { value: 'BREAKAGE', label: 'The company keeps it' },
  { value: 'REDISTRIBUTE_PRORATA', label: 'Share it among whoever is present' },
  { value: 'REDISTRIBUTE_TO_DIRECT', label: 'Give it to the selling realtor' },
];

const COMPRESSION_OPTIONS = [
  { value: 'NONE', label: 'Nobody — the tier is forfeited' },
  { value: 'ROLL_UP', label: 'The next qualified person above them' },
  { value: 'DYNAMIC_COMPRESSION', label: 'Remove them, and everyone above moves up' },
];

export const BLANK_CONFIG = {
  commissionable_base: { mode: 'GROSS_PRICE' },
  pool: { mode: 'PERCENTAGE', percentage: 8 },
  resolution: 'PRORATE',
  surplus: 'BREAKAGE',
  stacking: 'STACK',
  rules: [
    {
      id: 'direct', type: 'DIRECT_SALE', value_type: 'PERCENTAGE',
      // No `value`: unset means "use the realtor's level rate", which is the
      // usual arrangement and the reason levels carry one.
      basis: 'OF_COMMISSIONABLE_BASE',
    },
  ],
};

const ruleOf = (config, type) => (config.rules || []).find((rule) => rule.type === type);

/** Immutably replace (or remove) the one rule of a given type. */
const withRule = (config, type, next) => {
  const rest = (config.rules || []).filter((rule) => rule.type !== type);
  return { ...config, rules: next ? [...rest, next] : rest };
};

const Field = ({ label, hint, children }) => (
  <label className="block space-y-1">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    {children}
    {hint && <span className="block text-xs text-slate-500">{hint}</span>}
  </label>
);

const Section = ({ title, description, children }) => (
  <section className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
    </div>
    {children}
  </section>
);

export default function CommissionPlanEditor({ config, onChange, readOnly = false }) {
  const fmt = useCurrency();
  const [verdict, setVerdict] = useState(null);
  const [preview, setPreview] = useState(null);
  const [simPrice, setSimPrice] = useState('50000000');
  const [simGenerations, setSimGenerations] = useState('3');
  const [simLevelRate, setSimLevelRate] = useState('6');
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const direct = ruleOf(config, 'DIRECT_SALE');
  const referral = ruleOf(config, 'REFERRAL_BONUS');
  const generational = ruleOf(config, 'GENERATIONAL_OVERRIDE');

  const patch = useCallback((next) => onChange({ ...config, ...next }), [config, onChange]);

  /**
   * The five settings live under one `policy` key rather than scattered across
   * the config, so a reader can see everything a plan decided in one place —
   * and so the defaults have exactly one home in the engine.
   */
  const policy = config.policy || {};
  const setPolicy = useCallback(
    (next) => onChange({ ...config, policy: { ...(config.policy || {}), ...next } }),
    [config, onChange],
  );

  /**
   * Validate and simulate together, debounced.
   *
   * Debounced because this fires on every keystroke in a rate field and each
   * round trip runs the engine. 400ms is long enough that typing "12.5" is one
   * request rather than four, and short enough that the number on the right
   * feels like it belongs to the number on the left.
   */
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      /**
       * A failure here is REPORTED, not swallowed.
       *
       * It used to `.catch(() => null)` into the same empty state as "no price
       * entered yet", so an editor whose preview calls were being refused — a
       * user without finance.commissions.manage, say — looked identical to one
       * waiting for input. Somebody would type a price, see "enter a price",
       * and reasonably conclude the screen was broken. The two states need
       * different sentences because they need different actions.
       */
      try {
        const [checked, simulated] = await Promise.all([
          validateCommissionPlan(config),
          simulateCommissionPlan({
            config,
            price_minor: Math.round(Number(simPrice || 0) * 100),
            generations: Number(simGenerations) || 0,
            level_rate: Number(simLevelRate) || 0,
          }),
        ]);
        if (cancelled) return;
        setVerdict(checked);
        setPreview(simulated?.data ?? null);
        setPreviewError(null);
      } catch (error) {
        if (cancelled) return;
        setPreview(null);
        setPreviewError(error?.response?.status === 403
          ? 'You do not have permission to preview a plan. Ask an administrator for "Manage Commissions".'
          : error?.response?.data?.message || 'The preview could not be calculated just now.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [config, simPrice, simGenerations, simLevelRate]);

  const poolMode = config.pool?.mode || 'UNCAPPED';
  const isFlatPool = poolMode === 'FLAT' || poolMode === 'FLAT_PER_UNIT';

  const tiers = generational?.tiers || [];

  const setTier = (index, next) => {
    const updated = tiers.map((tier, i) => (i === index ? { ...tier, ...next } : tier));
    patch(withRule(config, 'GENERATIONAL_OVERRIDE', { ...generational, tiers: updated }));
  };

  const addTier = () => {
    const generation = tiers.length + 1;
    patch(withRule(config, 'GENERATIONAL_OVERRIDE', {
      id: 'gen',
      type: 'GENERATIONAL_OVERRIDE',
      compression: generational?.compression || 'NONE',
      ...generational,
      tiers: [...tiers, {
        generation,
        value_type: 'PERCENTAGE',
        value: 1,
        // Defaulted to the pool in flat-pool mode, because a percentage of the
        // PRICE there does not scale with the pool and can exhaust it on one
        // expensive unit.
        basis: isFlatPool ? 'OF_POOL' : 'OF_COMMISSIONABLE_BASE',
      }],
    }));
  };

  const removeTier = (index) => {
    const remaining = tiers
      .filter((unused, i) => i !== index)
      // Generations must stay contiguous: a gap means every tier below it is
      // unreachable, because generations are numbered by distance.
      .map((tier, i) => ({ ...tier, generation: i + 1 }));
    patch(withRule(config, 'GENERATIONAL_OVERRIDE',
      remaining.length ? { ...generational, tiers: remaining } : null));
  };

  const errors = verdict?.errors || [];
  const warnings = verdict?.warnings || [];

  const allocation = preview?.entitlements || [];
  const roleLabel = (line) => (line.role === 'UPLINE'
    ? `Generation ${line.generation}`
    : line.role === 'DIRECT' ? 'Selling realtor'
      : line.role === 'REFERRER' ? 'Referrer' : line.role);

  const disabled = readOnly;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* ── The structure ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <Section
          title="What commission is calculated on"
          description="Always derived from the property's price — never from cost or margin, which a realtor cannot verify."
        >
          <Field label="Commissionable base">
            <Select
              value={config.commissionable_base?.mode || 'GROSS_PRICE'}
              onChange={(e) => patch({ commissionable_base: { ...config.commissionable_base, mode: e.target.value } })}
              disabled={disabled}
            >
              {CB_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </Field>
        </Section>

        <Section
          title="The pool"
          description="The most this deal will pay across everybody. Rates say what people claim; this says what the deal can afford."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pool">
              <Select
                value={poolMode}
                onChange={(e) => patch({ pool: { ...config.pool, mode: e.target.value } })}
                disabled={disabled}
              >
                {POOL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>

            {(poolMode === 'PERCENTAGE' || poolMode === 'HYBRID') && (
              <Input
                label="Cap (%)"
                type="number" step="0.01" min="0"
                value={config.pool?.percentage ?? ''}
                onChange={(e) => patch({ pool: { ...config.pool, percentage: Number(e.target.value) } })}
                disabled={disabled}
              />
            )}

            {isFlatPool && (
              <Field label={poolMode === 'FLAT' ? 'Amount per deal' : 'Amount per unit'}>
                <MoneyInput
                  value={String((config.pool?.flat_amount_minor ?? 0) / 100)}
                  onChange={(value) => patch({ pool: { ...config.pool, flat_amount_minor: Math.round(Number(value || 0) * 100) } })}
                  disabled={disabled}
                />
              </Field>
            )}

            {poolMode === 'HYBRID' && (
              <>
                <Field label="Never less than">
                  <MoneyInput
                    value={String((config.pool?.floor_minor ?? 0) / 100)}
                    onChange={(value) => patch({ pool: { ...config.pool, floor_minor: Math.round(Number(value || 0) * 100) } })}
                    disabled={disabled}
                  />
                </Field>
                <Field label="Never more than">
                  <MoneyInput
                    value={String((config.pool?.ceiling_minor ?? 0) / 100)}
                    onChange={(value) => patch({ pool: { ...config.pool, ceiling_minor: Math.round(Number(value || 0) * 100) } })}
                    disabled={disabled}
                  />
                </Field>
              </>
            )}
          </div>

          {poolMode !== 'UNCAPPED' && (
            <Field
              label="When claims exceed the pool"
              hint="Every fully-populated deal hits this if the rates add up to more than the cap."
            >
              <Select
                value={config.resolution || 'PRORATE'}
                onChange={(e) => patch({ resolution: e.target.value })}
                disabled={disabled}
              >
                {RESOLUTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
          )}

          {isFlatPool && (
            <Field
              label="When nobody claims all of it"
              hint="Happens whenever the genealogy is shallower than the tiers — a missing Gen 3, say."
            >
              <Select
                value={config.surplus || 'BREAKAGE'}
                onChange={(e) => patch({ surplus: e.target.value })}
                disabled={disabled}
              >
                {SURPLUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
          )}
        </Section>

        <Section title="The selling realtor" description="What the person who made the sale earns.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Rate (%)" hint="Leave blank to use the realtor's own level rate.">
              <Input
                type="number" step="0.01" min="0"
                value={direct?.value ?? ''}
                placeholder="level rate"
                onChange={(e) => patch(withRule(config, 'DIRECT_SALE', {
                  ...direct,
                  id: 'direct', type: 'DIRECT_SALE', value_type: 'PERCENTAGE',
                  value: e.target.value === '' ? undefined : Number(e.target.value),
                }))}
                disabled={disabled}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="…of">
                <Select
                  value={direct?.basis || 'OF_COMMISSIONABLE_BASE'}
                  onChange={(e) => patch(withRule(config, 'DIRECT_SALE', { ...direct, basis: e.target.value }))}
                  disabled={disabled}
                >
                  {BASIS_OPTIONS.filter((o) => o.value !== 'OF_DIRECT_EARNER_COMMISSION'
                    && o.value !== 'OF_DOWNLINE_COMMISSION').map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </Section>

        <Section
          title="Referral bonus"
          description="Paid to the realtor credited with introducing the buyer, when that is not the seller."
        >
          {referral ? (
            <div className="grid gap-3 sm:grid-cols-[7rem_1fr_auto]">
              <Input
                label="Rate (%)"
                type="number" step="0.01" min="0"
                value={referral.value ?? ''}
                onChange={(e) => patch(withRule(config, 'REFERRAL_BONUS', { ...referral, value: Number(e.target.value) }))}
                disabled={disabled}
              />
              <Field label="…of">
                <Select
                  value={referral.basis || 'OF_COMMISSIONABLE_BASE'}
                  onChange={(e) => patch(withRule(config, 'REFERRAL_BONUS', { ...referral, basis: e.target.value }))}
                  disabled={disabled}
                >
                  {BASIS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </Field>
              {!disabled && (
                <div className="flex items-end">
                  <Button type="button" variant="secondary" size="sm"
                    onClick={() => patch(withRule(config, 'REFERRAL_BONUS', null))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Button type="button" variant="secondary" size="sm" disabled={disabled}
              onClick={() => patch(withRule(config, 'REFERRAL_BONUS', {
                id: 'referral', type: 'REFERRAL_BONUS', value_type: 'PERCENTAGE',
                value: 1, basis: isFlatPool ? 'OF_POOL' : 'OF_COMMISSIONABLE_BASE',
              }))}>
              <Plus className="mr-1 h-4 w-4" /> Add a referral bonus
            </Button>
          )}
        </Section>

        <Section
          title="Generational overrides"
          description="What the realtors above the seller earn. Generation 1 is their direct sponsor."
        >
          {tiers.length > 0 && (
            <div className="space-y-2">
              {tiers.map((tier, index) => (
                <div key={tier.generation} className="grid gap-2 sm:grid-cols-[5rem_6rem_1fr_auto]">
                  <Field label={index === 0 ? 'Generation' : ''}>
                    <div className="flex h-10 items-center rounded-lg bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                      {tier.generation}
                    </div>
                  </Field>
                  <Input
                    label={index === 0 ? 'Rate (%)' : ''}
                    type="number" step="0.01" min="0"
                    value={tier.value ?? ''}
                    onChange={(e) => setTier(index, { value: Number(e.target.value) })}
                    disabled={disabled}
                  />
                  <Field label={index === 0 ? '…of' : ''}>
                    <Select value={tier.basis || 'OF_COMMISSIONABLE_BASE'}
                      onChange={(e) => setTier(index, { basis: e.target.value })} disabled={disabled}>
                      {BASIS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </Field>
                  {!disabled && (
                    <div className="flex items-end">
                      <Button type="button" variant="secondary" size="sm" onClick={() => removeTier(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!disabled && (
            <Button type="button" variant="secondary" size="sm" onClick={addTier}>
              <Plus className="mr-1 h-4 w-4" /> Add generation {tiers.length + 1}
            </Button>
          )}

          {tiers.length > 0 && (
            <Field
              label="If someone in the chain does not qualify, who earns their tier?"
              hint="A genealogy is not a payment ladder — it is full of people who have stopped selling."
            >
              <Select
                value={generational?.compression || 'NONE'}
                onChange={(e) => patch(withRule(config, 'GENERATIONAL_OVERRIDE', { ...generational, compression: e.target.value }))}
                disabled={disabled}
              >
                {COMPRESSION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
          )}
        </Section>
      </div>

      {/* ── The consequences ───────────────────────────────────────────── */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Section
          title="Policy"
          description="Five places the specification says two things. Every default here is what the engine did before these were settable, so leaving them alone changes nothing."
        >
          <Field
            label="A realtor who is inactive when commission falls due"
            hint="The status check runs and is recorded on the entitlement either way. This decides whether it withholds anything."
          >
            <Select
              value={policy.gate || 'ENFORCE'}
              onChange={(e) => setPolicy({ gate: e.target.value })}
              disabled={disabled}
            >
              <option value="ENFORCE">Does not receive it</option>
              <option value="ADVISORY">Receives it anyway — the check is recorded only</option>
            </Select>
          </Field>

          {(policy.gate || 'ENFORCE') === 'ENFORCE' && (
            <Field
              label="…and what they lose"
              hint="Forfeiting only the instalment leaves something for a reinstatement to resume. Forfeiting the balance means one missed checkpoint ends the entitlement."
            >
              <Select
                value={policy.lapse_scope || 'INCREMENT'}
                onChange={(e) => setPolicy({ lapse_scope: e.target.value })}
                disabled={disabled}
              >
                <option value="INCREMENT">Only what fell due while they were inactive</option>
                <option value="REMAINING">The whole unreleased balance</option>
              </Select>
            </Field>
          )}

          <Field
            label="When commission becomes payable"
            hint="A plan scoped to a property or project that leaves this unset follows the company's default plan."
          >
            <Select
              value={config.vesting?.release_trigger || ''}
              onChange={(e) => patch({
                vesting: { ...(config.vesting || {}), release_trigger: e.target.value || undefined },
              })}
              disabled={disabled}
            >
              <option value="">Follow the company default</option>
              <option value="ON_DEAL_CONFIRMATION">As soon as the deal is confirmed</option>
              <option value="ON_INITIAL_DEPOSIT">Once any money has arrived</option>
              <option value="ON_THRESHOLD">Once the buyer passes a percentage of the price</option>
              <option value="PRO_RATA">In step with the buyer — 40% paid, 40% payable</option>
              <option value="ON_FULL_PAYMENT">Only when the buyer has paid in full</option>
              <option value="MILESTONE">Against named milestones</option>
              <option value="SCHEDULED">On a fixed schedule after confirmation</option>
            </Select>
          </Field>

          <Field
            label="Part-payable commission"
            hint="Forbidding it suits accounting that cannot represent a part-paid commission. It cannot be combined with a trigger that only ever releases part of one — the plan will not activate."
          >
            <Select
              value={policy.partial_release || 'ALLOW'}
              onChange={(e) => setPolicy({ partial_release: e.target.value })}
              disabled={disabled}
            >
              <option value="ALLOW">An entitlement may become payable in parts</option>
              <option value="FORBID">Payable whole, or not at all</option>
            </Select>
          </Field>

          <Field
            label="Cancellation penalties"
            hint="A penalty is a charge for a sale that did not happen. Include it where realtors are expected to chase and recover it."
          >
            <Select
              value={policy.penalties_commissionable ? 'true' : 'false'}
              onChange={(e) => setPolicy({ penalties_commissionable: e.target.value === 'true' })}
              disabled={disabled}
            >
              <option value="false">Not commissionable</option>
              <option value="true">Commissionable</option>
            </Select>
          </Field>
        </Section>

        <Section title="What this would pay" description="On a deal you describe, run through the real engine.">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Property price">
              <MoneyInput value={simPrice} onChange={setSimPrice} />
            </Field>
            <Input label="Generations present" type="number" min="0" max="12"
              value={simGenerations} onChange={(e) => setSimGenerations(e.target.value)} />
            <Input label="Seller's level rate (%)" type="number" step="0.01" min="0"
              value={simLevelRate} onChange={(e) => setSimLevelRate(e.target.value)} />
          </div>

          {preview ? (
            <div className="space-y-2">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {allocation.map((line) => (
                    <tr key={`${line.role}-${line.generation}-${line.rule_id}`}>
                      <td className="py-1.5 pr-2 text-slate-600">{roleLabel(line)}</td>
                      <td className="py-1.5 text-right font-medium text-slate-900">
                        {fmt(line.constrained_minor / 100)}
                      </td>
                    </tr>
                  ))}
                  {preview.breakage_minor > 0 && (
                    <tr>
                      <td className="py-1.5 pr-2 text-slate-500">Company keeps</td>
                      <td className="py-1.5 text-right text-slate-500">{fmt(preview.breakage_minor / 100)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200">
                    <td className="pt-2 pr-2 font-semibold text-slate-900">Total commission</td>
                    <td className="pt-2 text-right font-bold text-slate-900">
                      {fmt(preview.allocated_minor / 100)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                That is <span className="font-semibold">{(preview.cost_ratio * 100).toFixed(2)}%</span> of the sale.
                {preview.claims_total_minor > preview.pool_minor && (
                  <> The rules claimed {fmt(preview.claims_total_minor / 100)}, so the cap reduced everyone.</>
                )}
              </p>
            </div>
          ) : previewError ? (
            <p className="rounded-lg bg-warning-surface px-3 py-2 text-xs text-warning">{previewError}</p>
          ) : (
            <p className="text-sm text-slate-500">
              {busy ? 'Working…' : 'Enter a price to see what this pays.'}
            </p>
          )}
        </Section>

        {(errors.length > 0 || warnings.length > 0) && (
          <Section title="Before this can go live">
            {errors.map((finding) => (
              <div key={finding.code + finding.at} className="rounded-lg bg-danger-surface px-3 py-2 text-xs text-danger">
                {finding.message}
              </div>
            ))}
            {warnings.map((finding) => (
              <div key={finding.code + finding.at} className="rounded-lg bg-warning-surface px-3 py-2 text-xs text-warning">
                {finding.message}
              </div>
            ))}
          </Section>
        )}

        {verdict?.ok && errors.length === 0 && (
          <p className="rounded-lg bg-success-surface px-3 py-2 text-xs text-success">
            This plan is valid and can be activated.
          </p>
        )}
      </div>
    </div>
  );
}

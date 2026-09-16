import Input from '../ui/Input';
import Select from '../ui/Select';
import MoneyInput from '../ui/MoneyInput';
import Button from '../ui/Button';
import { numberOrUndefined } from '../../utils/numberField';
import FieldMark, { requiredFromChildren } from '../ui/FieldMark';

/**
 * The fields for whichever kind of promotion is being configured.
 *
 * ── Why the form changes shape ──────────────────────────────────────────────
 *
 * A percentage campaign needs a percentage and a cap. A buy-X-get-Y needs four
 * quantities and two units. Showing all of it at once gives an administrator a
 * page of fields of which most are irrelevant, and the commonest way to
 * misconfigure a campaign is to fill in one the chosen type ignores — a "10%
 * off" that also carries a tier table nobody can see is a campaign whose
 * behaviour cannot be predicted by looking at it.
 */

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

export default function PromotionTypeFields({ draft, patch, units = [], disabled = false }) {
  const type = draft.benefit_type;

  if (type === 'PERCENTAGE') {
    return (
      <div className="space-y-3">
        <Field
          label="Discount percentage"
          hint="Taken off what the qualifying units are worth. The unit's own price never changes."
        >
          <Input
            type="number" step="0.01" min="0" max="100" disabled={disabled}
            value={draft.percentage ?? ''}
            onChange={(e) => patch({ percentage: numberOrUndefined(e.target.value) })}
          />
        </Field>
        <Field
          label="Maximum discount"
          hint="Optional. A percentage on a large purchase is an unbounded promise; this is the ceiling."
        >
          <MoneyInput
            value={String((draft.max_discount_minor ?? 0) / 100)}
            onChange={(value) => patch({ max_discount_minor: Math.round(Number(value || 0) * 100) || undefined })}
          />
        </Field>
      </div>
    );
  }

  if (type === 'FIXED_AMOUNT') {
    return (
      <Field label="Amount off" hint="A flat amount, however much is being bought.">
        <MoneyInput
          value={String((draft.amount_minor ?? 0) / 100)}
          onChange={(value) => patch({ amount_minor: Math.round(Number(value || 0) * 100) })}
        />
      </Field>
    );
  }

  if (type === 'TIERED') {
    const tiers = draft.tiers || [];
    const setTier = (index, next) => patch({
      tiers: tiers.map((tier, i) => (i === index ? { ...tier, ...next } : tier)),
    });
    return (
      <div className="space-y-3">
        <Field
          label="Measured by"
          hint="Whether the tier is chosen by how many units are bought, or by how much is spent."
        >
          <Select
            value={draft.tier_on || 'QUANTITY'} disabled={disabled}
            onChange={(e) => patch({ tier_on: e.target.value })}
          >
            <option value="QUANTITY">Number of units</option>
            <option value="VALUE">Purchase value</option>
          </Select>
        </Field>

        <div className="space-y-2">
          {tiers.map((tier, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
              <span className="text-sm text-slate-500">From</span>
              {draft.tier_on === 'VALUE' ? (
                <div className="w-40">
                  <MoneyInput
                    value={String((tier.from ?? 0) / 100)}
                    onChange={(value) => setTier(index, { from: Math.round(Number(value || 0) * 100) })}
                  />
                </div>
              ) : (
                <input
                  type="number" min="0" disabled={disabled}
                  value={tier.from ?? ''}
                  onChange={(e) => setTier(index, { from: numberOrUndefined(e.target.value) })}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
              )}
              <span className="text-sm text-slate-500">get</span>
              <input
                type="number" step="0.01" min="0" max="100" disabled={disabled}
                value={tier.percentage ?? ''}
                onChange={(e) => setTier(index, { percentage: numberOrUndefined(e.target.value) })}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
              <span className="text-sm text-slate-500">% off</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => patch({ tiers: tiers.filter((unused, i) => i !== index) })}
                  className="ml-auto text-sm text-slate-400 hover:text-rose-600"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <Button
              type="button" variant="secondary" size="sm"
              onClick={() => patch({ tiers: [...tiers, { from: '', percentage: '' }] })}
            >
              + Add a tier
            </Button>
          )}
          {!tiers.length && (
            <p className="text-sm text-slate-500">
              No tiers yet. Add one for each quantity or value band you want to reward.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (type === 'BUY_X_GET_Y') {
    const config = draft.buy_x_get_y || {};
    const setConfig = (next) => patch({ buy_x_get_y: { ...config, ...next } });
    const sameUnit = !config.reward_unit_id
      || Number(config.reward_unit_id) === Number(config.buy_unit_id);

    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="They must buy">
            <Select
              value={config.buy_unit_id ?? ''} disabled={disabled}
              onChange={(e) => setConfig({ buy_unit_id: numberOrUndefined(e.target.value) })}
            >
              <option value="">Any unit in the scope</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </Select>
          </Field>
          <Field label="How many">
            <Input
              type="number" min="1" disabled={disabled}
              value={config.buy_quantity ?? ''}
              onChange={(e) => setConfig({ buy_quantity: numberOrUndefined(e.target.value) })}
            />
          </Field>
          <Field label="They then get">
            <Select
              value={config.reward_unit_id ?? ''} disabled={disabled}
              onChange={(e) => setConfig({ reward_unit_id: numberOrUndefined(e.target.value) })}
            >
              <option value="">The same unit</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </Select>
          </Field>
          <Field label="How many">
            <Input
              type="number" min="1" disabled={disabled}
              value={config.reward_quantity ?? ''}
              onChange={(e) => setConfig({ reward_quantity: numberOrUndefined(e.target.value) })}
            />
          </Field>
        </div>

        <Field label="Discount on the reward" hint="100% is free. Anything less is a discounted extra unit.">
          <Input
            type="number" step="1" min="0" max="100" disabled={disabled}
            value={config.reward_discount_percentage ?? 100}
            onChange={(e) => setConfig({ reward_discount_percentage: numberOrUndefined(e.target.value) })}
          />
        </Field>

        {/*
          The arithmetic changes when the reward is the same unit that
          qualifies, and it surprises people: "buy 2 get 1" on a basket of
          exactly 2 gives nothing, because those two ARE the qualifier. Said
          here rather than left to be discovered by a confused customer.
        */}
        {sameUnit && Number(config.buy_quantity) > 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            The reward is the same unit that qualifies, so a buyer needs{' '}
            {Number(config.buy_quantity) + (Number(config.reward_quantity) || 1)} to get{' '}
            {config.reward_quantity || 1} discounted — buying exactly {config.buy_quantity} earns nothing.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox" disabled={disabled}
            checked={Boolean(config.repeatable)}
            onChange={(e) => setConfig({ repeatable: e.target.checked })}
          />
          Repeat for every qualifying set
        </label>
        {config.repeatable && (
          <Field
            label="Most rewards per purchase"
            hint="Optional, but a repeating offer with no limit can be expensive on a large purchase."
          >
            <Input
              type="number" min="1" disabled={disabled}
              value={config.max_rewards ?? ''}
              onChange={(e) => setConfig({ max_rewards: numberOrUndefined(e.target.value) })}
            />
          </Field>
        )}
      </div>
    );
  }

  if (type === 'NON_MONETARY') {
    const perks = draft.perks || [];
    return (
      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">What the buyer receives</span>
        {perks.map((perk, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={perk.label || ''} disabled={disabled}
              placeholder="Free documentation"
              onChange={(e) => patch({
                perks: perks.map((p, i) => (i === index
                  ? { ...p, label: e.target.value, code: (e.target.value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_') }
                  : p)),
              })}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => patch({ perks: perks.filter((unused, i) => i !== index) })}
                className="text-sm text-slate-400 hover:text-rose-600"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <Button type="button" variant="secondary" size="sm" onClick={() => patch({ perks: [...perks, { label: '' }] })}>
            + Add something
          </Button>
        )}
        <p className="text-xs text-slate-500">
          These carry no money off. They are recorded against the purchase so whoever fulfils them knows.
        </p>
      </div>
    );
  }

  return <p className="text-sm text-slate-500">Choose what the promotion gives to see its settings.</p>;
}

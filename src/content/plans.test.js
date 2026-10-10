import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANS, TRIAL_DAYS, annualSaving, annualSavingPercent, formatNaira, formatPercent, normalisePlans, userLimitLabel,
} from './plans.js';

test('the built-in plans are the agreed ones', () => {
  assert.deepEqual(PLANS.map((p) => [p.code, p.monthly_price, p.annual_price, p.user_limit]), [
    ['starter', 50000, 500000, 100], ['professional', 75000, 750000, 250], ['enterprise', 100000, 1000000, null],
  ]);
  assert.equal(TRIAL_DAYS, 7);
});

test('works out and formats the annual saving', () => {
  assert.deepEqual(PLANS.map(annualSaving), [100000, 150000, 200000]);
  assert.deepEqual(PLANS.map((p) => formatPercent(annualSavingPercent(p))), ['16.67%', '16.67%', '16.67%']);
  assert.equal(formatNaira(1000000), '₦1,000,000');
  assert.equal(formatNaira(50000), '₦50,000');
  assert.equal(userLimitLabel(PLANS[0]), 'Up to 100 users');
  assert.equal(userLimitLabel(PLANS[2]), 'Unlimited users');
  // A plan with no annual discount saves nothing rather than a negative amount.
  assert.equal(annualSaving({ monthly_price: 10, annual_price: 200 }), 0);
});

test('takes the served plans only when they are usable', () => {
  const served = normalisePlans({
    data: [
      { code: 'pro', name: 'Pro', description: 'x', monthly_price: '80000.00', annual_price: 800000, currency: 'NGN', user_limit: 300, sort_order: 2, active: true },
      { code: 'basic', name: 'Basic', monthly_price: 40000, annual_price: 400000, currency: 'NGN', user_limit: 50, sort_order: 1, active: true },
      { code: 'old', name: 'Old', monthly_price: 1, annual_price: 1, currency: 'NGN', user_limit: 1, sort_order: 0, active: false },
      { code: 'usd', name: 'USD', monthly_price: 10, annual_price: 100, currency: 'USD', user_limit: null, sort_order: 0, active: true },
      { code: 'bad', name: 'Bad', monthly_price: 'free', annual_price: 0, currency: 'NGN', sort_order: 0, active: true },
    ],
    trial_days: 14,
  });
  assert.deepEqual(served.plans.map((p) => [p.code, p.monthly_price]), [['basic', 40000], ['pro', 80000]]);
  assert.equal(served.trialDays, 14);
  assert.equal(normalisePlans({ data: [] }), null);
  assert.equal(normalisePlans({ data: [{ code: 'x' }] }), null);
  assert.equal(normalisePlans(null), null);
  assert.equal(normalisePlans({ message: 'error' }), null);
  assert.equal(normalisePlans({ data: PLANS }).trialDays, TRIAL_DAYS);
});

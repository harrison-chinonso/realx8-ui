import test from 'node:test';
import assert from 'node:assert/strict';
import { respond, initialState, findTopic, afterSubmit } from './engine.js';
import { TOPICS, GREETING_CHIPS } from './knowledge.js';

const talk = (lines) => {
  let state = initialState();
  let last;
  for (const line of lines) {
    last = respond(state, line);
    state = last.state;
  }
  return last;
};

test('answers questions about Realx8 from the knowledge base', () => {
  assert.equal(findTopic('How do realtor commissions work?').id, 'commission');
  assert.equal(findTopic('Can I put my clients on an instalment plan?').id, 'payments');
  assert.equal(findTopic('Is there an iPhone app?').id, 'mobile');
  assert.equal(findTopic('Can it carry my brand?').id, 'brand');
  assert.equal(findTopic('how much does it cost').id, 'pricing');
});

test('quotes the real plans, prices and the free trial', () => {
  const r = respond(initialState(), 'How much does it cost?');
  for (const text of ['Starter', '₦50,000/month', '₦500,000/year', 'up to 100 users', 'Professional', '₦75,000/month',
    '₦750,000/year', 'up to 250 users', 'Enterprise', '₦100,000/month', '₦1,000,000/year', 'unlimited users', '16.67%', '7-day free trial', 'no card needed']) {
    assert.ok(r.replies[0].includes(text), `pricing answer is missing "${text}"`);
  }
  assert.ok(r.chips.includes('Start free trial'));
  assert.ok(r.chips.includes('Request onboarding'));
});

test('answers the questions people ask before paying', () => {
  assert.equal(findTopic('Is there a free trial?').id, 'trial');
  assert.equal(findTopic('How long is the free trial?').id, 'trial');
  assert.equal(findTopic('Do I need a credit card?').id, 'trial');
  assert.equal(findTopic('What counts as a user?').id, 'users');
  assert.equal(findTopic('Do clients count as users?').id, 'users');
  assert.equal(findTopic('What happens after the trial?').id, 'lapse');
  assert.equal(findTopic('What happens if a payment is missed?').id, 'lapse');
  assert.equal(findTopic('Can I switch plans?').id, 'switch-plan');
  assert.equal(findTopic('Can I upgrade to get more users?').id, 'switch-plan');
  assert.equal(findTopic('How do I pay for Realx8?').id, 'pay-subscription');
  // Client payments stay with the payments answer, not the subscription one.
  assert.equal(findTopic('Can I put my clients on an instalment plan?').id, 'payments');
  assert.match(respond(initialState(), 'What counts as a user?').replies[0], /staff, realtors and clients/);
  assert.match(respond(initialState(), 'What happens after the trial?').replies[0], /3 days of grace.*read-only/s);
  assert.match(respond(initialState(), 'How do I pay for Realx8?').replies[0], /Paystack.*bank transfer/s);
});

test('a question about the trial is answered, not taken as a request', () => {
  for (const q of ['Is there a free trial?', 'How long is the free trial?', 'What happens after the trial?']) {
    const r = respond(initialState(), q);
    assert.equal(r.state.flow, null, q);
  }
});

test('starts a free trial as an onboarding request sent as kind trial', () => {
  for (const opener of ['Start free trial', 'free trial', 'I want to try it', 'try it', 'Can I start a 7-day free trial?', 'Sign me up for the free trial']) {
    const r = respond(initialState(), opener);
    assert.equal(r.state.flow, 'onboarding', opener);
    assert.equal(r.state.kind, 'trial', opener);
    assert.match(r.replies[0], /7-day free trial.*company called/s, opener);
  }
  const r = talk(['Start free trial', 'Explorer Homes', 'Ada Obi', 'ada@explorer.test', '+234 801 234 5678', 'skip']);
  assert.deepEqual(r.submit, {
    kind: 'trial', source: 'assistant', company_name: 'Explorer Homes', contact_name: 'Ada Obi', email: 'ada@explorer.test', phone: '+234 801 234 5678',
  });
  assert.equal(r.state.kind, null);
});

test('a plan named when starting travels with the request', () => {
  const r = talk(['Start a free trial on the Professional plan', 'Explorer Homes', 'Ada Obi', 'ada@explorer.test', '+234 801 234 5678', 'skip']);
  assert.equal(r.submit.kind, 'trial');
  assert.deepEqual(r.submit.interests, ['Interested in the Professional plan']);
});

test('"yes" to an offer does what was offered, and nothing else', () => {
  let r = talk(['Is there a free trial?', 'yes']);
  assert.equal(r.state.flow, 'onboarding');
  assert.equal(r.state.kind, 'trial');
  r = talk(['How do I get started?', 'yes']);
  assert.equal(r.state.flow, 'onboarding');
  assert.equal(r.state.kind, null);
  r = talk(['yes']);
  assert.equal(r.state.flow, null);
  r = talk(['Is there a free trial?', 'What is the weather in Lagos?', 'yes']);
  assert.equal(r.state.flow, null);
});

test('refuses anything that is not about Realx8, and offers an enquiry', () => {
  const r = respond(initialState(), 'What is the weather in Lagos today?');
  assert.match(r.replies[0], /only help with questions about Realx8/);
  assert.deepEqual(r.chips, ['Raise an enquiry', 'What can Realx8 do?']);
  assert.equal(r.state.lastQuestion, 'What is the weather in Lagos today?');
});

test('every suggestion chip leads somewhere', () => {
  const chips = new Set([
    ...GREETING_CHIPS, ...TOPICS.flatMap((t) => t.chips || []),
    ...afterSubmit({ kind: 'trial', company_name: 'X', email: 'a@b.co' }, 'R').chips,
    ...afterSubmit({ kind: 'onboarding', company_name: 'X', email: 'a@b.co' }, 'R').chips,
    ...afterSubmit({}, null, 'error').chips,
  ]);
  for (const chip of chips) {
    const r = respond(initialState(), chip);
    assert.ok(r.state.flow || findTopic(chip), `chip "${chip}" neither answers nor starts a request`);
  }
});

test('raises an onboarding request, checking email and phone', () => {
  let r = talk(['I want to onboard my company']);
  assert.equal(r.state.flow, 'onboarding');
  r = talk(['request onboarding', 'Explorer Homes', 'Ada Obi', 'not-an-email']);
  assert.match(r.replies[0], /does not look like an email/);
  r = talk(['request onboarding', 'Explorer Homes', 'Ada Obi', 'ada@explorer.test', '123']);
  assert.match(r.replies[0], /phone number/);
  r = talk(['request onboarding', 'Explorer Homes', 'Ada Obi', 'ada@explorer.test', '+234 801 234 5678', 'skip']);
  assert.deepEqual(r.submit, {
    kind: 'onboarding', source: 'assistant', company_name: 'Explorer Homes', contact_name: 'Ada Obi', email: 'ada@explorer.test', phone: '+234 801 234 5678',
  });
  assert.equal(r.state.flow, null);
});

test('an enquiry carries the question the assistant could not answer', () => {
  const r = talk(['Do you integrate with QuickBooks Online?', 'Raise an enquiry', 'Bo Lee', 'bo@example.test']);
  assert.equal(r.submit.kind, 'enquiry');
  assert.equal(r.submit.message, 'Do you integrate with QuickBooks Online?');
});

test('cancel sends nothing', () => {
  const r = talk(['request onboarding', 'Explorer Homes', 'cancel']);
  assert.equal(r.state.flow, null);
  assert.equal(r.submit, undefined);
});

test('confirms with the reference, or explains a failure', () => {
  assert.match(afterSubmit({ kind: 'onboarding', company_name: 'X', email: 'a@b.co' }, 'RX-2026-0007').replies[0], /RX-2026-0007/);
  assert.match(afterSubmit({}, null, 'network error').replies[0], /could not send/);
  assert.match(afterSubmit({ kind: 'trial', company_name: 'X', email: 'a@b.co' }, 'RX-2026-0008').replies[0], /RX-2026-0008.*trial starts when your company is created/s);
});

test('a plan added in the app shows up in the answers once the site has fetched it', async () => {
  const { setPlans } = await import('./knowledge.js');
  const { PLANS } = await import('../content/plans.js');
  setPlans([...PLANS, { code: 'growth-plus', name: 'Growth Plus', description: '', monthly_price: 60000, annual_price: 600000, currency: 'NGN', user_limit: 150, sort_order: 4, active: true }]);
  try {
    const pricing = respond(initialState(), 'How much does it cost?');
    assert.match(pricing.replies[0], /Growth Plus — ₦60,000\/month or ₦600,000\/year · up to 150 users/);
    const named = respond(initialState(), 'Tell me about Growth Plus');
    assert.match(named.replies[0], /Growth Plus/);
    const trial = talk(['start free trial on Growth Plus', 'Explorer Homes', 'Ada Obi', 'ada@explorer.test', '+234 801 234 5678', 'skip']);
    assert.deepEqual(trial.submit.interests, ['Interested in the Growth Plus plan']);
  } finally {
    setPlans(PLANS);
  }
});

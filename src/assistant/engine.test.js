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

test('refuses anything that is not about Realx8, and offers an enquiry', () => {
  const r = respond(initialState(), 'What is the weather in Lagos today?');
  assert.match(r.replies[0], /only help with questions about Realx8/);
  assert.deepEqual(r.chips, ['Raise an enquiry', 'What can Realx8 do?']);
  assert.equal(r.state.lastQuestion, 'What is the weather in Lagos today?');
});

test('every suggestion chip leads somewhere', () => {
  const chips = new Set([...GREETING_CHIPS, ...TOPICS.flatMap((t) => t.chips || [])]);
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
});

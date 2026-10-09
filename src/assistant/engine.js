import { TOPICS, GREETING, GREETING_CHIPS, OFF_TOPIC } from './knowledge.js';

/**
 * The website assistant's conversation, as a pure function:
 *
 *   respond(state, text) → { state, replies, chips, submit? }
 *
 * It answers from knowledge.js and nothing else, and it can raise a request:
 * an onboarding request (company, name, email, phone, optional note) or an
 * enquiry (the question, name, email). When a request is complete it returns
 * `submit` — the caller sends it and reports the reference. No network here,
 * so all of it is testable.
 */

export const initialState = () => ({ flow: null, step: 0, data: {}, lastQuestion: null });

const normalise = (text) => ` ${String(text || '').toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9@.+\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()} `;

/** A topic's score: each whole phrase found counts by its length, so "payment plan" beats "plan". */
const scoreTopic = (topic, text) => topic.match.reduce((total, phrase) => (
  text.includes(` ${phrase} `) ? total + phrase.split(' ').length ** 1.5 : total
), 0);

export const findTopic = (text) => {
  const norm = normalise(text);
  let best = null;
  let bestScore = 0;
  for (const topic of TOPICS) {
    const score = scoreTopic(topic, norm);
    if (score > bestScore) { best = topic; bestScore = score; }
  }
  return best;
};

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const isPhone = (value) => String(value).replace(/\D/g, '').length >= 7;

const FLOWS = {
  onboarding: [
    { key: 'company_name', ask: 'Great — what is your company called?' },
    { key: 'contact_name', ask: 'And your name?' },
    { key: 'email', ask: 'What email should we reply to?', check: (v) => EMAIL_RE.test(v), retry: 'That does not look like an email address. Could you type it again?' },
    { key: 'phone', ask: 'And a phone or WhatsApp number?', check: isPhone, retry: 'Please give a phone number we can reach you on, with at least 7 digits.' },
    { key: 'message', ask: 'Anything you would like us to know — where you are today, or when you want to start? (Type "skip" to leave it.)', optional: true },
  ],
  enquiry: [
    { key: 'message', ask: 'What would you like to ask our team?' },
    { key: 'contact_name', ask: 'Who should we reply to? Your name, please.' },
    { key: 'email', ask: 'And your email address?', check: (v) => EMAIL_RE.test(v), retry: 'That does not look like an email address. Could you type it again?' },
  ],
};

const WANTS_ONBOARDING = /\b(onboard\w*|sign (me )?up|get started with you|start with realx8|request a demo|book a demo|demo|talk to sales|become a customer)\b/;
const WANTS_ENQUIRY = /\b(raise an enquiry|enquiry|inquiry|contact (your|the) team|speak to (someone|a person|a human)|talk to (someone|a person|a human)|human|call me)\b/;
const GREETING_RE = /^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening))\b/;
const THANKS_RE = /\b(thanks|thank you|thx)\b/;
const CANCEL_RE = /^\s*(cancel|stop|never ?mind|forget it|quit)\s*$/;

const askStep = (flow, step) => FLOWS[flow][step].ask;

const startFlow = (state, flow) => {
  const data = {};
  let step = 0;
  // An enquiry that follows an unanswered question already has its question.
  if (flow === 'enquiry' && state.lastQuestion) {
    data.message = state.lastQuestion;
    step = 1;
  }
  return {
    state: { ...state, flow, step, data },
    replies: [flow === 'enquiry' && step === 1
      ? `I will pass this to our team: "${state.lastQuestion}". ${askStep(flow, step)}`
      : askStep(flow, step)],
    chips: ['Cancel'],
  };
};

const continueFlow = (state, text) => {
  const steps = FLOWS[state.flow];
  const current = steps[state.step];
  const value = String(text || '').trim();

  if (current.optional && /^skip$/i.test(value)) {
    // fall through with no value
  } else if (!value || (current.check && !current.check(value))) {
    return { state, replies: [current.retry || current.ask], chips: ['Cancel'] };
  }

  const data = { ...state.data };
  if (!(current.optional && /^skip$/i.test(value))) data[current.key] = value.slice(0, 2000);
  const step = state.step + 1;

  if (step < steps.length) {
    return { state: { ...state, data, step }, replies: [steps[step].ask], chips: ['Cancel'] };
  }

  return {
    state: { ...initialState() },
    replies: [],
    chips: [],
    submit: { kind: state.flow, source: 'assistant', ...data },
  };
};

export const greet = () => ({ replies: [GREETING], chips: GREETING_CHIPS });

export const respond = (state, text) => {
  const said = String(text || '').trim();
  if (!said) return { state, replies: [], chips: [] };
  const lower = said.toLowerCase();

  if (state.flow) {
    if (CANCEL_RE.test(lower)) {
      return { state: initialState(), replies: ['No problem — I have not sent anything. What else would you like to know about Realx8?'], chips: GREETING_CHIPS };
    }
    return continueFlow(state, said);
  }

  if (WANTS_ONBOARDING.test(lower)) return startFlow(state, 'onboarding');
  if (WANTS_ENQUIRY.test(lower)) return startFlow(state, 'enquiry');

  const topic = findTopic(said);
  if (topic) {
    return { state: { ...state, lastQuestion: null }, replies: [topic.answer], chips: topic.chips || [] };
  }

  if (GREETING_RE.test(lower)) return { state, ...greet() };
  if (THANKS_RE.test(lower)) {
    return { state, replies: ['You are welcome. Anything else about Realx8?'], chips: GREETING_CHIPS };
  }

  return {
    state: { ...state, lastQuestion: said.slice(0, 500) },
    replies: [OFF_TOPIC],
    chips: ['Raise an enquiry', 'What can Realx8 do?'],
  };
};

/** What to say once a request was sent (or could not be). */
export const afterSubmit = (submitted, reference, error) => {
  if (error) {
    return { replies: [`Sorry, I could not send that just now (${error}). Please try again, or use the request form on this page.`], chips: ['Request onboarding'] };
  }
  const who = submitted.kind === 'enquiry' ? 'Your enquiry is with our team' : `Your onboarding request for ${submitted.company_name} is in`;
  return {
    replies: [`Done. ${who}. Your reference is ${reference}. We have emailed a copy to ${submitted.email} and will be in touch soon. Anything else about Realx8?`],
    chips: ['What can Realx8 do?'],
  };
};

import { TOPICS, GREETING, GREETING_CHIPS, OFF_TOPIC, currentPlans } from './knowledge.js';
import { TRIAL_DAYS, planInterest } from '../content/plans.js';

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
 *
 * A free trial is an onboarding request by another name: the same questions,
 * sent as kind 'trial' so the team sets the company up on a trial. `kind`
 * carries that through the flow. `offer` remembers what the last answer
 * offered to do, so a plain "yes" does it.
 */

export const initialState = () => ({ flow: null, kind: null, step: 0, data: {}, lastQuestion: null, offer: null });

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

// Asking to start one always starts it, even as a question ("Can I start a free trial?").
const STARTS_TRIAL = /\b(start|begin|open|activate|sign (me |us )?up for|i want|id like|we want|wed like)( a| my| the| your| our)?( 7-day| 7 day| seven day| seven-day)?( free)? trial\b/;
// Just naming one ("free trial", "try it") starts it too — unless it is a question about the trial.
const MENTIONS_TRIAL = /\b(free trial|trial|try it|try it out|try realx8|try it free|test drive)\b/;
const QUESTION_RE = /\?|^\s*(how|what|whats|when|why|which|who|is|are|does|do|can|could|will|would|should)\b/;
const YES_RE = /^\s*(yes( please)?|yeah|yep|yup|sure|ok|okay|please( do)?|go ahead|do it|lets do it|lets go)\s*$/;
const WANTS_ONBOARDING = /\b(onboard\w*|sign (me )?up|get started with you|start with realx8|request a demo|book a demo|demo|talk to sales|become a customer)\b/;
const WANTS_ENQUIRY = /\b(raise an enquiry|enquiry|inquiry|contact (your|the) team|speak to (someone|a person|a human)|talk to (someone|a person|a human)|human|call me)\b/;
const GREETING_RE = /^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening))\b/;
const THANKS_RE = /\b(thanks|thank you|thx)\b/;
const CANCEL_RE = /^\s*(cancel|stop|never ?mind|forget it|quit)\s*$/;

const askStep = (flow, step) => FLOWS[flow][step].ask;

/** "Start a trial on Professional" — the plan travels with the request, as on the form. */
const mentionedPlan = (norm) => currentPlans().find((p) => norm.includes(` ${p.name.toLowerCase()} `) || norm.includes(` ${p.code} `));

const startFlow = (state, flow, { kind = null, said = '' } = {}) => {
  const data = {};
  let step = 0;
  const plan = flow === 'onboarding' ? mentionedPlan(normalise(said)) : null;
  if (plan) data.interests = [planInterest(plan)];
  // An enquiry that follows an unanswered question already has its question.
  if (flow === 'enquiry' && state.lastQuestion) {
    data.message = state.lastQuestion;
    step = 1;
  }
  let reply = askStep(flow, step);
  if (flow === 'enquiry' && step === 1) reply = `I will pass this to our team: "${state.lastQuestion}". ${reply}`;
  if (kind === 'trial') reply = `Let's start your ${TRIAL_DAYS}-day free trial${plan ? ` on ${plan.name}` : ''}: our team sets up your company and the trial starts the day it is created. ${reply.replace(/^Great — w/, 'W')}`;
  return {
    state: { ...state, flow, kind, step, data, offer: null },
    replies: [reply],
    chips: ['Cancel'],
  };
};

const startTrial = (state, said) => startFlow(state, 'onboarding', { kind: 'trial', said });

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
    submit: { kind: state.kind || state.flow, source: 'assistant', ...data },
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

  const norm = normalise(said);
  if (state.offer && YES_RE.test(norm)) {
    return state.offer === 'trial' ? startTrial(state, said) : startFlow({ ...state, lastQuestion: null }, state.offer);
  }

  const topic = findTopic(said);
  if (STARTS_TRIAL.test(norm)) return startTrial(state, said);
  // "free trial" or "try it" on its own starts one; a question about the trial,
  // or something that is really about another topic ("after the trial"), gets its answer.
  if (MENTIONS_TRIAL.test(norm) && !QUESTION_RE.test(said.toLowerCase()) && (!topic || ['trial', 'pricing'].includes(topic.id))) {
    return startTrial(state, said);
  }
  if (WANTS_ONBOARDING.test(lower)) return startFlow(state, 'onboarding', { said });
  if (WANTS_ENQUIRY.test(lower)) return startFlow(state, 'enquiry');

  // A plan named on its own ("tell me about Growth") — including one added in the app — is a pricing question.
  const answered = topic || (mentionedPlan(norm) ? TOPICS.find((t) => t.id === 'pricing') : null);
  if (answered) {
    const reply = typeof answered.answer === 'function' ? answered.answer() : answered.answer;
    return { state: { ...state, lastQuestion: null, offer: answered.offer || null }, replies: [reply], chips: answered.chips || [] };
  }

  if (GREETING_RE.test(lower)) return { state, ...greet() };
  if (THANKS_RE.test(lower)) {
    return { state, replies: ['You are welcome. Anything else about Realx8?'], chips: GREETING_CHIPS };
  }

  return {
    state: { ...state, lastQuestion: said.slice(0, 500), offer: null },
    replies: [OFF_TOPIC],
    chips: ['Raise an enquiry', 'What can Realx8 do?'],
  };
};

/** What to say once a request was sent (or could not be). */
export const afterSubmit = (submitted, reference, error) => {
  if (error) {
    return { replies: [`Sorry, I could not send that just now (${error}). Please try again, or use the request form on this page.`], chips: ['Request onboarding'] };
  }
  if (submitted.kind === 'trial') {
    return {
      replies: [`Done. Your free-trial request for ${submitted.company_name} is in. Your reference is ${reference}, and we have emailed a copy to ${submitted.email}. Our team will set up your company and be in touch — your ${TRIAL_DAYS}-day trial starts when your company is created. Anything else about Realx8?`],
      chips: ['What happens after the trial?', 'What can Realx8 do?'],
    };
  }
  const who = submitted.kind === 'enquiry' ? 'Your enquiry is with our team' : `Your onboarding request for ${submitted.company_name} is in`;
  return {
    replies: [`Done. ${who}. Your reference is ${reference}. We have emailed a copy to ${submitted.email} and will be in touch soon. Anything else about Realx8?`],
    chips: ['What can Realx8 do?'],
  };
};

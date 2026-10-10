import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GRACE_DAYS, annualSaving, annualSavingPercent, formatNaira, formatPercent, userLimitLabel,
} from '../content/plans.js';
import usePlans from '../usePlans.js';

/**
 * Plans, the free trial and the questions people ask before paying. Prices come
 * from usePlans — the built-in copy first, the app's own plans once fetched —
 * so nothing on this page hard-codes an amount.
 */
export default function Pricing({ onAsk }) {
  const { plans, trialDays } = usePlans();
  const [billing, setBilling] = useState('monthly');
  const annual = billing === 'annual';
  // The headline saving is the best one on offer, so it stays true if plans ever differ.
  const bestSaving = Math.max(0, ...plans.map(annualSavingPercent));

  return (
    <>
      <section className="section pricing-head">
        <div className="wrap stack" style={{ alignItems: 'center', textAlign: 'center', gap: 18 }}>
          <span className="eyebrow">Pricing</span>
          <h1>Every feature on every plan</h1>
          <p className="lead" style={{ maxWidth: 640 }}>
            Plans differ only by how many users your company has. Pay monthly, or annually and save
            {bestSaving > 0 ? ` up to ${formatPercent(bestSaving)}` : ''}.
          </p>
          <div className="billing-toggle" role="group" aria-label="Billing period">
            <button type="button" aria-pressed={!annual} onClick={() => setBilling('monthly')}>Monthly</button>
            <button type="button" aria-pressed={annual} onClick={() => setBilling('annual')}>
              Annual{bestSaving > 0 && <span className="save"> · save {formatPercent(bestSaving)}</span>}
            </button>
          </div>
        </div>
      </section>

      <section className="pricing-plans">
        <div className="wrap stack" style={{ gap: 28 }}>
          <div className="plans" aria-live="polite">
            {plans.map((plan) => {
              const saving = annualSaving(plan);
              return (
                <article key={plan.code} className="plan">
                  <h2>{plan.name}</h2>
                  {plan.description && <p className="plan-desc">{plan.description}</p>}
                  <p className="plan-price">
                    <strong>{formatNaira(annual ? plan.annual_price : plan.monthly_price)}</strong>
                    <span>{annual ? '/year' : '/month'}</span>
                  </p>
                  {annual && saving > 0 ? (
                    <span className="plan-saving">Save {formatNaira(saving)} a year ({formatPercent(annualSavingPercent(plan))})</span>
                  ) : (
                    <span className="plan-alt">or {formatNaira(plan.annual_price)}/year</span>
                  )}
                  <p className="plan-limit">{userLimitLabel(plan)}</p>
                  <ul className="ticks">
                    <li>Full access to all Realx8 features</li>
                    <li>Monthly or annual subscription</li>
                  </ul>
                  <Link to={`/request?trial=1&plan=${encodeURIComponent(plan.code)}`} className="btn btn-ink">
                    Start {trialDays}-day free trial
                  </Link>
                </article>
              );
            })}
          </div>

          <div className="trial-band">
            <div className="stack" style={{ gap: 6 }}>
              <strong>{trialDays}-day free trial on every plan — all features, no card needed</strong>
              <span>Every new company starts with a free trial with no user limit. Our team sets up your company, and the {trialDays} days start the day it is created.</span>
            </div>
            <Link to="/request?trial=1" className="btn btn-gold">Start your free trial</Link>
          </div>
        </div>
      </section>

      <section id="faq" className="section">
        <div className="wrap faq-wrap">
          <h2 className="h2">Questions</h2>
          <div className="faq">
            <details>
              <summary>What counts as a user?</summary>
              <p>Every user account in your company: staff, realtors and clients. They are counted together, per company — on Starter, for example, up to 100 accounts in total.</p>
            </details>
            <details>
              <summary>Do I need a card for the free trial?</summary>
              <p>No. The trial has every feature and no user limit, and you do not give any payment details to start it.</p>
            </details>
            <details>
              <summary>What happens after the trial?</summary>
              <p>
                Choose a plan and pay to carry on. If you have not by the end of the trial, you have {GRACE_DAYS} more days of grace.
                After that your company becomes read-only until you subscribe: your clients can still pay, and your realtors can
                still share property links. Anyone who signs up meanwhile waits in a queue, and their sign-up is completed
                automatically when you renew.
              </p>
            </details>
            <details>
              <summary>What happens if a payment is missed?</summary>
              <p>The same as at the end of a trial: {GRACE_DAYS} days of grace after your paid period ends, then read-only until you renew. Clients can still pay, realtors can still share links, and new sign-ups are completed automatically once you renew.</p>
            </details>
            <details>
              <summary>Can I switch plans?</summary>
              <p>Yes. Every plan has the same features, so switching only changes your user limit and price. Talk to our team to move to another plan, or between monthly and annual billing.</p>
            </details>
            <details>
              <summary>How do I pay?</summary>
              <p>By card or bank through Paystack, or by bank transfer arranged with our team. You can pay monthly or annually, and renewals can be automatic.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta">
            <h2>Not sure which plan fits?</h2>
            <p>Start the free trial with no user limit and decide later, or ask us anything about Realx8.</p>
            <div className="actions" style={{ justifyContent: 'center' }}>
              <Link to="/request?trial=1" className="btn btn-gold">Start your {trialDays}-day free trial</Link>
              <button type="button" className="btn btn-ghost" onClick={onAsk}>Ask a question</button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

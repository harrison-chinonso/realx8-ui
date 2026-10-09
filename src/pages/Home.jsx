import { Link } from 'react-router-dom';
import {
  BookOpen, Building2, CreditCard, LifeBuoy, Megaphone, PiggyBank, ShieldCheck, TrendingUp, UserRound, Users,
} from 'lucide-react';
import { FEATURES } from '../content/features.js';

const ICONS = { BookOpen, Building2, CreditCard, LifeBuoy, Megaphone, PiggyBank, ShieldCheck, TrendingUp, UserRound, Users };

/** A screenshot from the app (public/screens), framed. */
const Shot = ({ src, alt, light = false }) => (
  <figure className={`shot${light ? ' shot-light' : ''}`} style={{ margin: 0 }}>
    <img src={src} alt={alt} loading="lazy" width="1440" height="900" />
  </figure>
);

export default function Home({ onAsk }) {
  return (
    <>
      <section className="section-ink hero">
        <div className="wrap hero-grid">
          <div className="stack">
            <span className="eyebrow">Real-estate operations platform</span>
            <h1>Run your property business on your own platform.</h1>
            <p className="lead">Listings, sales, realtor commissions, payments and your clients' portal — in one place, under your company's name, colours and app.</p>
            <div className="actions">
              <Link to="/request" className="btn btn-gold">Request onboarding</Link>
              <button type="button" className="btn btn-ghost" onClick={onAsk}>Ask a question</button>
            </div>
          </div>
          <Shot src="/screens/dashboard.png" alt="The Realx8 dashboard: sales, invoices due and payments to approve" />
        </div>
      </section>

      <section id="features" className="section">
        <div className="wrap stack" style={{ gap: 40 }}>
          <div className="stack" style={{ gap: 12, maxWidth: 680 }}>
            <h2 className="h2">Everything from listing to payout</h2>
            <p className="lead">Each part works on its own and shares the same records, so a sale flows into invoices, payments, commission and reports without re-typing.</p>
          </div>
          <div className="grid-cards">
            {FEATURES.map((f) => {
              const Icon = ICONS[f.icon];
              return (
                <article key={f.title} className="card">
                  <span className="icon-tile"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section section-sand">
        <div className="wrap">
          <div className="showcase">
            <div className="stack" style={{ gap: 14 }}>
              <span className="eyebrow">Realtor network</span>
              <h2 className="h2">Commission your realtors can see</h2>
              <p className="lead">Levels with their own rates, referrals across several levels, and a clear record of what each realtor has earned, what is pending and what is ready to pay.</p>
              <ul className="ticks">
                <li>Commission plans and realtor levels you control</li>
                <li>Payouts requested from commission records, approved by you</li>
                <li>A leaderboard and performance reports</li>
              </ul>
            </div>
            <Shot light src="/screens/commissions.png" alt="Realtor commission records with pending and payable amounts" />
          </div>
          <div className="showcase">
            <Shot light src="/screens/payments.png" alt="An invoice with its instalment schedule and payments" />
            <div className="stack" style={{ gap: 14 }}>
              <span className="eyebrow">Payments</span>
              <h2 className="h2">Instalments without the spreadsheets</h2>
              <p className="lead">An invoice at purchase, an instalment plan if the buyer wants one, proof of payment or online payment, your approval, then a receipt — all recorded in your books.</p>
              <ul className="ticks">
                <li>Outright or instalment payment plans</li>
                <li>Automatic receipts and payment reminders</li>
                <li>Bank reconciliation and a full ledger behind it</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-ink">
        <div className="wrap showcase">
          <div className="stack" style={{ gap: 14 }}>
            <h2 className="h2">Your clients see your company, not ours</h2>
            <p className="lead">Your name, logo, colours and browser icon on every screen, email and receipt. Your own iPhone and Android app. Your help pages and support contacts.</p>
            <ul className="chip-grid">
              <li>Branded sign-in and sign-up</li>
              <li>Branded mobile app</li>
              <li>Your own email designs</li>
              <li>Property share links in your colours</li>
              <li>In-app, email, push and SMS alerts</li>
              <li>Your help centre and contacts</li>
            </ul>
          </div>
          <Shot src="/screens/client-portal.png" alt="A company's branded client portal on a phone" />
        </div>
      </section>

      <section id="how" className="section">
        <div className="wrap stack" style={{ gap: 36 }}>
          <h2 className="h2">How onboarding works</h2>
          <ol className="steps">
            <li><span className="n">01</span><strong>Tell us about your business</strong><span>Fill in the request form, or ask our assistant to raise it for you.</span></li>
            <li><span className="n">02</span><strong>We set up your company</strong><span>Your company code, brand, admin account and the modules you need.</span></li>
            <li><span className="n">03</span><strong>Bring your team and records</strong><span>Invite staff and realtors, add properties, and import your existing books.</span></li>
            <li><span className="n">04</span><strong>Go live</strong><span>Share your sign-up link; clients and realtors join under your company.</span></li>
          </ol>
        </div>
      </section>

      <section id="who" className="section section-sand">
        <div className="wrap stack" style={{ gap: 28 }}>
          <h2 className="h2">Built for</h2>
          <div className="who">
            <div><strong>Property developers</strong><span>Estates, units, payment plans and handovers.</span></div>
            <div><strong>Real-estate companies</strong><span>Sales teams, branches, CRM and finance in one place.</span></div>
            <div><strong>Realtor networks</strong><span>Levels, commissions, multi-level referrals and payouts.</span></div>
            <div><strong>Their clients</strong><span>Purchases, instalments, receipts and documents in a portal.</span></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta">
            <h2>Ready to put your business on Realx8?</h2>
            <p>Send a request and our team will contact you to set up your company.</p>
            <div className="actions" style={{ justifyContent: 'center' }}>
              <Link to="/request" className="btn btn-gold">Request onboarding</Link>
              <button type="button" className="btn btn-ghost" onClick={onAsk}>Ask a question</button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

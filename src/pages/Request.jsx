import { useState } from 'react';
import { Check } from 'lucide-react';
import { INTERESTS } from '../content/features.js';
import { APP_URL, sendRequest } from '../api.js';

const EMPTY = {
  company_name: '', contact_name: '', email: '', phone: '',
  business_type: 'Property developer', realtor_count: 'None yet', message: '', website: '',
};

/** The onboarding request form. Stored by Realx8-Core and followed up by the team. */
export default function Request({ onAsk }) {
  const [form, setForm] = useState(EMPTY);
  const [interests, setInterests] = useState([]);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggle = (label) => setInterests((list) => (list.includes(label) ? list.filter((l) => l !== label) : [...list, label]));

  const submit = async (e) => {
    e.preventDefault();
    if (!consent) { setError('Please agree to be contacted about this request.'); return; }
    setSending(true);
    setError('');
    try {
      const data = await sendRequest({ ...form, interests, kind: 'onboarding', source: 'form' });
      setReference(data.reference || '—');
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="request">
      <div className="wrap">
        <aside>
          <span className="eyebrow">Request onboarding</span>
          <h1>Let's set up your company</h1>
          <p className="lead">Tell us a little about your business. Our team will contact you to agree the setup and get you live.</p>
          <ul className="ticks">
            <li>Your own company code, brand and admin account</li>
            <li>Help moving your properties, clients and books</li>
            <li>Training for your staff and realtors</li>
          </ul>
          <div className="note-box">
            <strong>Just have a question?</strong>
            <span>Ask our assistant about any feature — it can also raise this request for you.</span>
            <button type="button" className="link-button" onClick={onAsk}>Ask Realx8 →</button>
          </div>
        </aside>

        <section className="panel" aria-live="polite">
          {reference ? (
            <div className="done">
              <span className="tick"><Check size={26} aria-hidden="true" /></span>
              <h2 style={{ fontSize: 30 }}>Request received</h2>
              <p style={{ color: 'var(--muted)' }}>
                Thank you. Your reference is <strong>{reference}</strong>. We have emailed a copy to {form.email} and our team will be in touch soon.
              </p>
              <a className="btn btn-ink" href={`${APP_URL}/login`}>Already a customer? Sign in</a>
            </div>
          ) : (
            <form className="form" onSubmit={submit} noValidate={false}>
              {error && <div className="error" role="alert">{error}</div>}
              <div className="fields">
                <label className="field">Company name *
                  <input required value={form.company_name} onChange={set('company_name')} placeholder="e.g. Explorer Homes Ltd" autoComplete="organization" maxLength={160} />
                </label>
                <label className="field">Your name *
                  <input required value={form.contact_name} onChange={set('contact_name')} placeholder="Full name" autoComplete="name" maxLength={120} />
                </label>
                <label className="field">Work email *
                  <input required type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" autoComplete="email" maxLength={160} />
                </label>
                <label className="field">Phone or WhatsApp *
                  <input required type="tel" value={form.phone} onChange={set('phone')} placeholder="+234 …" autoComplete="tel" maxLength={40} />
                </label>
                <label className="field">Type of business
                  <select value={form.business_type} onChange={set('business_type')}>
                    <option>Property developer</option><option>Real-estate company</option><option>Realtor network</option><option>Agency</option><option>Other</option>
                  </select>
                </label>
                <label className="field">Number of realtors
                  <select value={form.realtor_count} onChange={set('realtor_count')}>
                    <option>None yet</option><option>1–20</option><option>21–100</option><option>101–500</option><option>More than 500</option>
                  </select>
                </label>
              </div>

              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="field" style={{ marginBottom: 10 }}>What do you want to use? (choose any)</legend>
                <div className="chips">
                  {INTERESTS.map((label) => (
                    <button key={label} type="button" className="chip" aria-pressed={interests.includes(label)} onClick={() => toggle(label)}>{label}</button>
                  ))}
                </div>
              </fieldset>

              <label className="field">Anything else we should know?
                <textarea rows={4} value={form.message} onChange={set('message')} placeholder="Where you are today, what you want to change, when you want to start" maxLength={4000} />
              </label>

              {/* Left empty by people, filled by bots. */}
              <label className="trap" aria-hidden="true">Website
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
              </label>

              <label className="consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I agree to be contacted about this request. See our <a href={`${APP_URL}/legal/terms#part-b`}>Privacy Policy</a>.</span>
              </label>

              <div className="actions" style={{ alignItems: 'center' }}>
                <button type="submit" className="btn btn-ink" disabled={sending}>{sending ? 'Sending…' : 'Send request'}</button>
                <span style={{ fontSize: 13, color: '#5B6275' }}>We reply by email or phone. No spam.</span>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

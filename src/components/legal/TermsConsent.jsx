/**
 * The three statements from clause 72, as separate boxes. The first two are
 * required to create an account; the third is optional and never ticked for
 * the person. `onRead('part-a' | 'part-b')` opens the text each one refers to.
 *
 * `tone="dark"` for the sign-in and sign-up pages, `"light"` inside the app.
 */
export const EMPTY_CONSENT = { terms: false, privacy: false, marketing: false };
export const consentComplete = (consent) => Boolean(consent?.terms && consent?.privacy);

export default function TermsConsent({ value, onChange, onRead, tone = 'light', disabled = false }) {
  const dark = tone === 'dark';
  const text = dark ? 'text-[#D5D9E2]' : 'text-slate-700';
  const link = dark ? 'font-semibold text-[#E9D8C4] underline underline-offset-2' : 'font-semibold text-primary underline underline-offset-2';
  const tag = dark ? 'text-[#A6ADBD]' : 'text-slate-500';
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.checked });
  const box = 'mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--primary)]';
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="sr-only">Terms of Use and Privacy Policy</legend>
      <label className={`flex items-start gap-2.5 text-sm leading-relaxed ${text}`}>
        <input type="checkbox" className={box} checked={value.terms} onChange={set('terms')} required />
        <span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${tag}`}>Required · </span>
          I have read and agree to the Realx8{' '}
          <button type="button" className={link} onClick={() => onRead('part-a')}>Terms of Use</button>.
        </span>
      </label>
      <label className={`flex items-start gap-2.5 text-sm leading-relaxed ${text}`}>
        <input type="checkbox" className={box} checked={value.privacy} onChange={set('privacy')} required />
        <span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${tag}`}>Required · </span>
          I have read and understood the Realx8{' '}
          <button type="button" className={link} onClick={() => onRead('part-b')}>Privacy Policy</button>, and I consent to the
          processing of my Personal Data as described in it, including transfers outside Nigeria under clause 49.
        </span>
      </label>
      <label className={`flex items-start gap-2.5 text-sm leading-relaxed ${text}`}>
        <input type="checkbox" className={box} checked={value.marketing} onChange={set('marketing')} />
        <span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${tag}`}>Optional · </span>
          I would like to receive marketing messages, newsletters and property offers from Realx8 and the companies I am
          associated with. I can unsubscribe at any time.
        </span>
      </label>
    </fieldset>
  );
}

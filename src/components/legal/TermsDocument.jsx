import LegalMarkdown from './LegalMarkdown';

export const formatLegalDate = (value) => {
  if (!value) return '—';
  const date = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * One version of the Terms of Use and Privacy Policy: its title, the dates
 * that frame it, and the text. "Last Updated" is the moment that version was
 * published, so it moves with every published edit (clause 67.2).
 */
export default function TermsDocument({ terms, highlightPlaceholders = false }) {
  if (!terms) return null;
  return (
    <article className="space-y-4">
      <header className="space-y-1 border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">{terms.title}</h1>
        <p className="text-xs text-slate-500">
          Effective Date: {formatLegalDate(terms.effective_date)} · Last Updated: {formatLegalDate(terms.last_updated)}
          {terms.version ? ` · Version ${terms.version}` : ''}
        </p>
      </header>
      <LegalMarkdown content={terms.content} highlightPlaceholders={highlightPlaceholders} />
    </article>
  );
}

/**
 * Renders the Terms of Use and Privacy Policy from its Markdown.
 *
 * A deliberately small subset — `##`/`###` headings, paragraphs, `- ` lists,
 * `| … |` tables and `**bold**` — which is all the document uses and all the
 * editor needs to offer. Built as React elements from text, never as HTML, so
 * nothing typed into the editor can run in a reader's browser.
 *
 * `highlightPlaceholders` marks every remaining `[…]` blank, for the editor's
 * preview; readers never see one, because a document with any cannot be
 * published.
 */
const PLACEHOLDER = /(\[[^\]\n]+\])(?!\()/g;
const IS_PLACEHOLDER = /^\[[^\]\n]+\]$/;

/** Section ids the sign-up links jump to: Part A is the Terms of Use, Part B the Privacy Policy. */
export const sectionId = (heading) => {
  const part = /^Part ([A-D])\b/i.exec(heading);
  return part ? `part-${part[1].toLowerCase()}` : undefined;
};

const inline = (text, highlight, keyBase) => {
  const out = [];
  String(text).split(/(\*\*[^*]+\*\*)/g).forEach((chunk, i) => {
    if (!chunk) return;
    const bold = /^\*\*([^*]+)\*\*$/.exec(chunk);
    const content = bold ? bold[1] : chunk;
    const pieces = highlight
      ? content.split(PLACEHOLDER).map((piece, j) => (IS_PLACEHOLDER.test(piece)
        ? <mark key={`${keyBase}-${i}-${j}`} className="rounded bg-amber-200 px-1 text-amber-950">{piece}</mark>
        : piece))
      : [content];
    out.push(bold ? <strong key={`${keyBase}-${i}`} className="font-semibold text-slate-900">{pieces}</strong> : <span key={`${keyBase}-${i}`}>{pieces}</span>);
  });
  return out;
};

const parseRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));

export default function LegalMarkdown({ content = '', highlightPlaceholders = false }) {
  const lines = String(content).split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;
    if (!line.trim()) { i += 1; continue; }
    if (line.startsWith('## ')) {
      const text = line.slice(3).trim();
      blocks.push(<h2 key={key} id={sectionId(text)} className="scroll-mt-4 pt-4 text-lg font-semibold text-slate-900">{inline(text, highlightPlaceholders, key)}</h2>);
      i += 1; continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(<h3 key={key} className="pt-2 text-sm font-semibold text-slate-900">{inline(line.slice(4).trim(), highlightPlaceholders, key)}</h3>);
      i += 1; continue;
    }
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(lines[i].slice(2)); i += 1; }
      blocks.push(<ul key={key} className="list-disc space-y-1 pl-5">{items.map((item, j) => <li key={j}>{inline(item, highlightPlaceholders, `${key}-${j}`)}</li>)}</ul>);
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i]); i += 1; }
      const [head, , ...body] = rows.map(parseRow);
      const hasHead = head && head.some(Boolean);
      blocks.push(
        <div key={key} className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
            {hasHead && <thead><tr>{head.map((cell, j) => <th key={j} className="border-b border-slate-300 bg-slate-50 px-3 py-2 font-semibold text-slate-900">{inline(cell, highlightPlaceholders, `${key}-h${j}`)}</th>)}</tr></thead>}
            <tbody>{body.map((row, r) => <tr key={r}>{row.map((cell, j) => <td key={j} className={`border-b border-slate-200 px-3 py-2 align-top ${!hasHead && j === 0 ? 'font-semibold text-slate-900' : ''}`}>{inline(cell, highlightPlaceholders, `${key}-${r}-${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3} |- |\s*\|)/.test(lines[i])) { para.push(lines[i].trim()); i += 1; }
    blocks.push(<p key={key}>{inline(para.join(' '), highlightPlaceholders, key)}</p>);
  }
  return <div className="space-y-3 text-sm leading-relaxed text-slate-700">{blocks}</div>;
}

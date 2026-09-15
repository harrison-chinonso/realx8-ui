/**
 * BM25 ranking over the assistant's knowledge base.
 *
 * ── Why BM25 and not "does the text contain the words" ──────────────────────
 *
 * Substring matching ranks by accident. Ask "how do I approve a payment" and
 * every document mentioning "payment" scores alike, so whichever happens to be
 * first wins — which is how the bot this replaces walked people through the
 * wrong flow with complete confidence.
 *
 * BM25 fixes the two things that matter here. A term appearing in nearly every
 * document counts for almost nothing (so "payment" stops deciding anything),
 * and a term appearing repeatedly in one document has diminishing returns (so a
 * long recipe cannot win by saying "invoice" fifteen times).
 *
 * ── Why it is written out rather than installed ─────────────────────────────
 *
 * It is forty lines of arithmetic over a corpus of a few hundred short
 * documents. A search dependency would be larger than the thing it searches,
 * and would have to be kept current for the life of the application.
 */

/** Term-frequency saturation. 1.2 is the usual default and behaves well here. */
const K1 = 1.2;
/** How much document length is penalised. 0.75 is the usual default. */
const B = 0.75;

export class Bm25Index {
  /**
   * @param {Array<{ id, fields: Record<string, string[]> }>} documents
   *   Each field is already tokenised. Fields are kept apart so a match in a
   *   title can be weighted differently from one in a step.
   * @param {Record<string, number>} weights  per-field multipliers
   */
  constructor(documents, weights) {
    this.documents = documents;
    this.weights = weights;

    /** How many documents contain each term, per field. */
    this.documentFrequency = new Map();
    /** Average field length, for the length penalty. */
    this.averageLength = new Map();

    const totals = new Map();

    for (const document of documents) {
      for (const [field, terms] of Object.entries(document.fields)) {
        totals.set(field, (totals.get(field) || 0) + terms.length);

        // Counted once per document, however often the term appears in it.
        for (const term of new Set(terms)) {
          const key = `${field}:${term}`;
          this.documentFrequency.set(key, (this.documentFrequency.get(key) || 0) + 1);
        }
      }
    }

    for (const [field, total] of totals) {
      this.averageLength.set(field, total / Math.max(documents.length, 1));
    }
  }

  /**
   * Inverse document frequency.
   *
   * The +0.5 terms are BM25's standard smoothing. `Math.max(…, 0)` matters with
   * a corpus this small: a term in more than half the documents would otherwise
   * score NEGATIVE and actively push its own matches down the list.
   */
  idf(field, term) {
    const containing = this.documentFrequency.get(`${field}:${term}`) || 0;
    const total = this.documents.length;
    return Math.max(
      Math.log(1 + (total - containing + 0.5) / (containing + 0.5)),
      0,
    );
  }

  /** Score one document against the query terms. */
  scoreDocument(document, queryTerms) {
    let score = 0;

    for (const [field, terms] of Object.entries(document.fields)) {
      const weight = this.weights[field] ?? 1;
      if (!weight || !terms.length) continue;

      const average = this.averageLength.get(field) || 1;
      const lengthPenalty = 1 - B + (B * (terms.length / average));

      const counts = new Map();
      for (const term of terms) counts.set(term, (counts.get(term) || 0) + 1);

      for (const term of queryTerms) {
        const frequency = counts.get(term);
        if (!frequency) continue;
        const saturated = (frequency * (K1 + 1)) / (frequency + (K1 * lengthPenalty));
        score += weight * this.idf(field, term) * saturated;
      }
    }

    return score;
  }

  /** Every document that matched at all, best first. */
  search(queryTerms) {
    if (!queryTerms.length) return [];
    return this.documents
      .map((document) => ({ document, score: this.scoreDocument(document, queryTerms) }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score);
  }
}

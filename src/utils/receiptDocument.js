import { getReceiptDocument } from '../api/financeApi';

/**
 * The receipt a buyer keeps.
 *
 * ── One generator, wherever a receipt is opened ─────────────────────────────
 *
 * Payment Approvals, the dashboard's recent payments, an invoice's payment
 * history and the client's own property page all offer a receipt. They used to
 * differ: one drew a document, the others linked to the company's file and
 * offered nothing at all when there was none. A buyer who saw a receipt in one
 * place and a dash in another reasonably concluded the payment had not been
 * recorded properly.
 *
 * ── Why the document is no longer drawn here ────────────────────────────────
 *
 * It used to be built in this file. Then the same receipt started being EMAILED
 * when a payment is approved, and a document that exists in two places — drawn
 * in JavaScript here and rendered again on the server for the mail — is a
 * document that disagrees with itself the first time either side is edited. A
 * buyer holding an emailed receipt and a printed one that differ has no way to
 * tell which is the real one.
 *
 * So the server draws it, once, and this asks for it. What arrives is the same
 * string the email carries, down to the byte.
 *
 * ── The company's own file always wins ──────────────────────────────────────
 *
 * Where an admin attached a real receipt at approval, THAT is the receipt. It
 * is what the buyer's accounts department already has. Drawing a second one
 * would put two documents with two numbers in circulation for one payment,
 * which is the confusion that attaching a real one was meant to end.
 *
 * The SERVER decides that, not this file. The check below is a shortcut for
 * the rows that already carry the file's URL, and skipping a round trip is the
 * whole of what it buys. It is not the rule: the four screens that offer a
 * receipt hand over four differently-shaped rows, and one that simply does not
 * select company_receipt_url looks identical here to a payment that never had
 * a receipt uploaded. So the document endpoint checks again against the receipt
 * itself, and returns the file's URL instead of a document when there is one.
 */

const FAILED = `
  <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #334155; padding: 32px; max-width: 480px">
    <h1 style="font-size: 18px; margin: 0 0 8px">The receipt could not be loaded</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0">
      The payment is recorded — this is the document that failed to arrive, not the
      payment. Close this window and try again, and if it keeps happening the
      receipt was also emailed to the address on the account when the payment was
      approved.
    </p>
  </div>`;

/**
 * Open a receipt — the company's own file if there is one, otherwise the
 * generated document.
 *
 * @param {object} receipt  the row as the list has it; only `id` and
 *                          `company_receipt_url` are relied on
 * @param {object} options  { onError }
 */
export const openReceipt = async (receipt, { onError } = {}) => {
  if (!receipt) return;

  /**
   * It opens in a tab rather than going straight to the print dialog: the file
   * is a PDF or an image served from storage, and the browser's own viewer is
   * better at printing those than a popup this page controls.
   */
  if (receipt.company_receipt_url) {
    window.open(receipt.company_receipt_url, '_blank', 'noopener,noreferrer');
    return;
  }

  /**
   * The window is opened BEFORE the fetch, not after.
   *
   * Popup blockers allow a window opened during the click and refuse one
   * opened from a promise that resolved later — so fetching first meant the
   * receipt silently never appeared, which looked like a broken button.
   */
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    onError?.('Your browser blocked the receipt window. Allow pop-ups for this site and try again.');
    return;
  }
  win.document.write('<p style="font-family: sans-serif; color: #64748b">Preparing the receipt…</p>');

  let html = null;
  try {
    const { data } = await getReceiptDocument(receipt.id);

    /*
     * The row this was called with did not say there was a company receipt, but
     * the server — looking at the receipt itself — says there is. It wins, and
     * the window already open becomes the viewer for it.
     */
    if (data?.company_receipt_url) {
      win.location.replace(data.company_receipt_url);
      return;
    }
    html = data?.html || null;
  } catch (error) {
    onError?.(error?.userMessage || 'The receipt could not be loaded. Please try again.');
  }

  win.document.open();
  win.document.write(html || FAILED);
  win.document.close();
  win.focus();
  // Nothing to print but an apology if it failed, and a print dialog over one
  // reads as the document having printed.
  if (html) win.print();
};

export default openReceipt;

import { getReceiptPrintData } from '../api/financeApi';

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
 * ── The company's own file always wins ──────────────────────────────────────
 *
 * Where an admin attached a real receipt at approval, THAT is the receipt. It
 * is what the buyer's accounts department already has. Drawing a second one
 * would put two documents with two numbers in circulation for one payment,
 * which is the confusion that attaching a real one was meant to end.
 *
 * ── What the generated one has to say ───────────────────────────────────────
 *
 * A receipt naming only an amount is true and useless. A buyer checks it
 * against the thing they bought — which property, which unit, how many — and
 * against what they still owe. Those come from the print-data endpoint,
 * because none of them are facts about the payment row.
 */

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '');

const buildHtml = (receipt, { appearance, fmt }) => {
  const receiptNumber = receipt.receipt_number || receipt.number || `RCPT-${receipt.id}`;
  const company = escapeHtml(appearance?.app_name || 'Receipt');
  const logo = appearance?.app_logo ? escapeHtml(appearance.app_logo) : null;
  const brand = escapeHtml(appearance?.primary_color || '#0f172a');
  const money = (value) => escapeHtml(fmt ? fmt(Number(value) || 0) : String(value));

  /**
   * Rows are built from what this receipt actually has.
   *
   * A printed receipt full of dashes reads as a broken document rather than a
   * complete one that happens to carry no note, and a buyer handed it cannot
   * tell which. Empty fields are left out instead.
   */
  const line = (label, value) => (value || value === 0
    ? `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
    : '');

  /**
   * The unit line reads as one sentence — "2 × 3-Bedroom Terrace" — rather than
   * as two fields a reader has to join up themselves. Quantity is stated only
   * when it is more than one, because "1 ×" is noise.
   */
  const quantity = Number(receipt.quantity) || 0;
  const unit = [
    quantity > 1 ? `${quantity} ×` : null,
    receipt.unit_label,
  ].filter(Boolean).join(' ');

  const balance = receipt.outstanding_balance;
  const hasBalance = balance !== null && balance !== undefined;

  return `
    <html>
      <head>
        <title>Receipt ${escapeHtml(receiptNumber)}</title>
        <style>
          @page { margin: 18mm; }
          body { font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #0f172a; margin: 0; }
          .head { display: flex; align-items: center; gap: 16px;
                  border-bottom: 3px solid ${brand}; padding-bottom: 16px; margin-bottom: 28px; }
          .head img { max-height: 56px; max-width: 200px; object-fit: contain; }
          .company { font-size: 20px; font-weight: 700; color: ${brand}; }
          .title { margin-left: auto; text-align: right; }
          .title .word { font-size: 24px; font-weight: 700; letter-spacing: 0.08em;
                         text-transform: uppercase; color: ${brand}; }
          .title .num { font-size: 12px; color: #64748b; margin-top: 2px; }
          h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
               color: #94a3b8; margin: 26px 0 6px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 9px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; vertical-align: top; }
          td.label { color: #64748b; width: 190px; }
          .total { margin-top: 28px; padding: 18px 20px; border-radius: 10px;
                   background: ${brand}; color: #fff; display: flex; justify-content: space-between;
                   align-items: center; }
          .total .amt { font-size: 24px; font-weight: 700; }
          .balance { margin-top: 10px; padding: 14px 20px; border-radius: 10px;
                     border: 1px solid #e2e8f0; display: flex; justify-content: space-between;
                     align-items: center; font-size: 14px; }
          .balance .amt { font-weight: 700; }
          .settled { color: #15803d; font-weight: 600; }
          .foot { margin-top: 32px; font-size: 11px; color: #94a3b8; line-height: 1.6; }
          @media print { .foot { position: fixed; bottom: 0; } }
        </style>
      </head>
      <body>
        <div class="head">
          ${logo ? `<img src="${logo}" alt="${company}" />` : ''}
          <div class="company">${company}</div>
          <div class="title">
            <div class="word">Receipt</div>
            <div class="num">${escapeHtml(receiptNumber)}</div>
          </div>
        </div>

        <table>
          ${line('Date', formatDate(receipt.date || receipt.verified_at || receipt.created_at || receipt.createdAt))}
          ${line('Received from', receipt.client_name || receipt.client?.name)}
          ${line('Invoice', receipt.invoice_reference || receipt.invoice_id)}
          ${line('Payment method', receipt.payment_method)}
          ${line('Reference', receipt.reference)}
          ${line('Note', receipt.notes)}
        </table>

        ${receipt.property_name || unit ? `
          <h2>What this is for</h2>
          <table>
            ${line('Property', receipt.property_name)}
            ${line('Address', receipt.property_address)}
            ${line('Unit', unit)}
            ${receipt.unit_price ? line('Unit price', fmt ? fmt(Number(receipt.unit_price)) : receipt.unit_price) : ''}
          </table>` : ''}

        <div class="total">
          <span>Amount paid</span>
          <span class="amt">${money(receipt.amount)}</span>
        </div>

        ${hasBalance ? `
          <div class="balance">
            <span>Balance outstanding on this invoice</span>
            <span class="amt ${Number(balance) <= 0 ? 'settled' : ''}">
              ${Number(balance) <= 0 ? 'Paid in full' : money(balance)}
            </span>
          </div>` : ''}

        <div class="foot">
          ${company} &middot; Receipt ${escapeHtml(receiptNumber)}<br />
          ${hasBalance && Number(balance) > 0
            ? 'The balance shown is as at the date of this receipt.<br />'
            : ''}
          Generated by ${company}. Keep this for your records.
        </div>
      </body>
    </html>
  `;
};

/**
 * Open a receipt — the company's own file if there is one, otherwise a
 * generated document.
 *
 * @param {object} receipt  the row as the list has it; only `id` and
 *                          `company_receipt_url` are relied on
 * @param {object} options  { appearance, fmt, onError }
 */
export const openReceipt = async (receipt, { appearance, fmt, onError } = {}) => {
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

  let full = receipt;
  try {
    const result = await getReceiptPrintData(receipt.id);
    full = { ...receipt, ...(result?.data || {}) };
  } catch {
    /**
     * Fall back to what the list already had rather than failing.
     *
     * The buyer wanted a receipt for a payment that certainly happened; a
     * receipt missing its property line is worth more to them than an error
     * message, and the amount, date and reference on it are all correct.
     */
  }

  win.document.open();
  win.document.write(buildHtml(full, { appearance, fmt }));
  win.document.close();
  win.focus();
  win.print();
};

export default openReceipt;

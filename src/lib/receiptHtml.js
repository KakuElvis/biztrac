import { formatCurrency } from "./formatters.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatReceiptDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const sampleTestReceipt = {
  reference: "TEST-RECEIPT-001",
  createdAt: new Date().toISOString(),
  customerName: "Walk-in Customer",
  paymentType: "Cash",
  lines: [
    {
      productId: "test-1",
      name: "Sample Retail Item A",
      quantity: 2,
      unitPrice: 40.0,
      total: 80.0,
    },
    {
      productId: "test-2",
      name: "Sample Retail Item B",
      quantity: 1,
      unitPrice: 45.0,
      total: 45.0,
    },
  ],
  total: 125.0,
  amountTendered: 150.0,
  changeDue: 25.0,
};

export function buildReceiptHtml(receipt, business) {
  if (!receipt || typeof receipt !== "object") return "";
  const businessName = escapeHtml(business?.name || "BizTrac");
  const businessDetails = escapeHtml([business?.phone, business?.location].filter(Boolean).join(" • "));
  const is80mm = business?.receipt_width === "80mm";
  const paperWidthCss = is80mm ? "72mm" : "48mm";
  const fontSizeCss = is80mm ? "12px" : "11px";

  const rows = (receipt.lines || [])
    .map(
      (line) => `
        <tr>
          <td style="padding: 3px 0;">
            <div style="font-weight: bold;">${escapeHtml(line.name)}</div>
            <div style="font-size: 10px; color: #333;">${line.quantity} x ${escapeHtml(formatCurrency(line.unitPrice))}</div>
          </td>
          <td style="padding: 3px 0; text-align: right; font-weight: bold; vertical-align: top;">
            ${escapeHtml(formatCurrency(line.total))}
          </td>
        </tr>
      `
    )
    .join("");

  const isCreditOrPartial =
    receipt.paymentType === "Credit" ||
    (receipt.paymentType !== "MoMo" &&
      receipt.paymentType !== "Bank" &&
      receipt.amountPaid !== undefined &&
      receipt.amountPaid < receipt.total);
  const amountPaid = receipt.amountPaid || 0;
  const balanceDue = Math.max(0, receipt.total - amountPaid);
  const hasCashChange =
    receipt.paymentType === "Cash" &&
    receipt.amountTendered !== undefined &&
    receipt.amountTendered >= receipt.total;

  return `
    <!doctype html>
    <html>
      <head>
        <title>${businessName} Receipt ${escapeHtml(receipt.reference || "")}</title>
        <style>
          * { box-sizing: border-box; }
          @page {
            margin: 0;
            size: auto;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-family: monospace, 'Courier New', Courier, sans-serif;
            font-size: ${fontSizeCss};
            line-height: 1.3;
          }
          .receipt {
            width: ${paperWidthCss};
            max-width: ${paperWidthCss};
            margin: 0 auto;
            padding: 2mm;
          }
          .text-center { text-align: center; }
          h1 { margin: 0; font-size: ${is80mm ? "16px" : "14px"}; text-transform: uppercase; font-weight: bold; }
          .slogan { font-size: 10px; font-style: italic; margin: 2px 0; }
          .details { font-size: 10px; margin: 2px 0 6px; }
          .momo { border: 1px dashed #000; padding: 3px; margin: 4px 0; font-weight: bold; font-size: 10px; }
          .meta {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            margin: 6px 0;
            padding: 4px 0;
          }
          .meta div {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin-top: 2px;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 4px 0;
          }
          .total {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            font-size: ${is80mm ? "14px" : "12px"};
            font-weight: 800;
            margin-top: 6px;
            padding: 6px 0;
            display: flex;
            justify-content: space-between;
          }
          .sub-row {
            display: flex;
            justify-content: space-between;
            margin-top: 3px;
            font-size: 10px;
          }
          .footer {
            border-top: 1px dashed #000;
            margin-top: 8px;
            padding-top: 6px;
            text-align: center;
            font-size: 9px;
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <div class="text-center">
            <h1>${businessName}</h1>
            ${business?.slogan ? `<p class="slogan">${escapeHtml(business.slogan)}</p>` : ""}
            <p class="details">${businessDetails || "Sales Receipt"}</p>
            ${business?.momo_details ? `<div class="momo">MoMo: ${escapeHtml(business.momo_details)}</div>` : ""}
          </div>
          <section class="meta">
            <div><span>Receipt:</span><strong>${escapeHtml(receipt.reference || "Draft")}</strong></div>
            <div><span>Date:</span><strong>${escapeHtml(formatReceiptDate(receipt.createdAt || new Date().toISOString()))}</strong></div>
            <div><span>Customer:</span><strong>${escapeHtml(receipt.customerName || "Walk-in")}</strong></div>
            <div><span>Payment:</span><strong>${escapeHtml(receipt.paymentType || "Cash")}</strong></div>
            ${receipt.paymentAccount ? `<div><span>Account / Ref:</span><strong>${escapeHtml(receipt.paymentAccount)}</strong></div>` : ""}
            ${receipt.dueDate ? `<div><span>Due Date:</span><strong>${escapeHtml(formatReceiptDate(receipt.dueDate))}</strong></div>` : ""}
          </section>
          <table><tbody>${rows}</tbody></table>
          <div class="total"><span>TOTAL:</span><span>${escapeHtml(formatCurrency(receipt.total || 0))}</span></div>
          ${hasCashChange ? `
            <div class="sub-row">
              <span>Cash Tendered:</span><span>${escapeHtml(formatCurrency(receipt.amountTendered))}</span>
            </div>
            ${receipt.changeDue !== undefined ? `
              <div class="sub-row" style="font-weight: bold;">
                <span>Change Given:</span><span>${escapeHtml(formatCurrency(receipt.changeDue))}</span>
              </div>
            ` : ""}
          ` : ""}
          ${(receipt.paymentType === "MoMo" || receipt.paymentType === "Bank") && receipt.amountPaid !== undefined ? `
            <div class="sub-row">
              <span>Amount Paid (${escapeHtml(receipt.paymentType)}):</span><span>${escapeHtml(formatCurrency(receipt.amountPaid))}</span>
            </div>
            ${receipt.amountPaid < receipt.total ? `
              <div class="sub-row" style="font-weight: bold; color: #b91c1c;">
                <span>BALANCE DUE:</span><span>${escapeHtml(formatCurrency(receipt.total - receipt.amountPaid))}</span>
              </div>
            ` : ""}
          ` : ""}
          ${isCreditOrPartial ? `
            <div class="sub-row">
              <span>Amount Paid:</span><span>${escapeHtml(formatCurrency(amountPaid))}</span>
            </div>
            <div class="sub-row" style="font-weight: bold;">
              <span>BALANCE DUE:</span><span>${escapeHtml(formatCurrency(balanceDue))}</span>
            </div>
          ` : ""}
          <div class="footer">
            ${business?.return_policy ? `<p style="margin: 2px 0;">${escapeHtml(business.return_policy)}</p>` : ""}
            <p style="margin: 4px 0; font-weight: bold;">${escapeHtml(business?.receipt_footer || "Thank you for buying from us! Visit again.")}</p>
            <p style="margin: 2px 0; font-size: 8px; color: #555;">Powered by BizTrac</p>
          </div>
        </main>
      </body>
    </html>
  `;
}

export function printThermalReceipt(receipt, business, onPopupBlocked) {
  if (!receipt || typeof window === "undefined") return false;
  const is80mm = business?.receipt_width === "80mm";
  const windowOpts = is80mm ? "width=440,height=680" : "width=340,height=600";
  const printWindow = window.open("", "_blank", windowOpts);
  if (!printWindow) {
    if (onPopupBlocked) onPopupBlocked();
    return false;
  }

  printWindow.document.write(buildReceiptHtml(receipt, business));
  printWindow.document.close();
  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (e) {
      console.warn("Print error", e);
    }
  }, 250);
  return true;
}

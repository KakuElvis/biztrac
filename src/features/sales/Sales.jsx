import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  Send,
  ShoppingBag,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { formatCurrency } from "../../lib/formatters.js";

const paymentTypes = ["Cash", "MoMo", "Bank", "Credit"];

function toReceiptLine(line) {
  return {
    productId: line.productId,
    name: line.product.name,
    quantity: line.quantity,
    unitPrice: line.product.sellingPrice,
    total: line.total,
  };
}

function formatReceiptDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildReceiptText(receipt, business) {
  const businessName = business?.name || "BizTrac";
  const businessDetails = [business?.phone, business?.location].filter(Boolean).join(" | ");
  const lines = receipt.lines
    .map(
      (line) =>
        `${line.quantity} x ${line.name} @ ${formatCurrency(line.unitPrice)} = ${formatCurrency(
          line.total
        )}`
    )
    .join("\n");

  return [
    businessName,
    businessDetails,
    "",
    `Receipt: ${receipt.reference}`,
    `Date: ${formatReceiptDate(receipt.createdAt)}`,
    `Customer: ${receipt.customerName || "Walk-in"}`,
    `Payment: ${receipt.paymentType}`,
    "",
    lines,
    "",
    `Total: ${formatCurrency(receipt.total)}`,
    "",
    "Thank you.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function normalizePdfText(value) {
  return String(value)
    .replaceAll("GH₵", "GHS ")
    .replaceAll("₵", "GHS ")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(value) {
  return normalizePdfText(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrapPdfLine(value, maxLength = 42) {
  const words = normalizePdfText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }

    if (`${current} ${word}`.length <= maxLength) {
      current = `${current} ${word}`;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function makePdfObject(objectNumber, body) {
  return `${objectNumber} 0 obj\n${body}\nendobj\n`;
}

function buildPdfDocument(content, width, height) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += makePdfObject(index + 1, body);
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function buildReceiptPdfFile(receipt, business) {
  const receiptLines = buildReceiptText(receipt, business).split("\n").slice(1);
  const lines = receiptLines.flatMap((line) => wrapPdfLine(line));
  const width = 226;
  const height = Math.max(360, 64 + lines.length * 15);
  const content = [
    "BT",
    "/F2 13 Tf",
    `16 ${height - 28} Td`,
    `(${escapePdfText(business?.name || "BizTrac")}) Tj`,
    "/F1 9 Tf",
    ...lines.flatMap((line, index) => {
      const yOffset = index === 0 ? -22 : -14;
      return [`0 ${yOffset} Td`, `(${escapePdfText(line)}) Tj`];
    }),
    "ET",
  ].join("\n");
  const pdf = buildPdfDocument(content, width, height);
  const fileName = `${receipt.reference || "receipt"}.pdf`.replace(/[^a-z0-9.-]+/gi, "-");

  return new File([pdf], fileName, { type: "application/pdf" });
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildReceiptHtml(receipt, business) {
  const businessName = escapeHtml(business?.name || "BizTrac");
  const businessDetails = escapeHtml([business?.phone, business?.location].filter(Boolean).join(" | "));
  const rows = receipt.lines
    .map(
      (line) => `
        <tr>
          <td>
            <strong>${escapeHtml(line.name)}</strong>
            <span>${line.quantity} x ${escapeHtml(formatCurrency(line.unitPrice))}</span>
          </td>
          <td>${escapeHtml(formatCurrency(line.total))}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <title>${businessName} receipt ${escapeHtml(receipt.reference)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #fff;
            color: #111827;
            font-family: Arial, sans-serif;
            font-size: 13px;
          }
          .receipt {
            width: 320px;
            max-width: 100%;
            margin: 0 auto;
            padding: 18px;
          }
          h1 {
            margin: 0;
            font-size: 18px;
            text-align: center;
          }
          .muted {
            color: #64748b;
            font-size: 11px;
            text-align: center;
          }
          .meta {
            border-bottom: 1px dashed #cbd5e1;
            border-top: 1px dashed #cbd5e1;
            margin: 14px 0;
            padding: 10px 0;
          }
          .meta div,
          .total,
          tr {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          td {
            padding: 7px 0;
            vertical-align: top;
          }
          td:first-child {
            flex: 1;
          }
          td:last-child {
            font-weight: 700;
            text-align: right;
            white-space: nowrap;
          }
          td span {
            color: #64748b;
            display: block;
            font-size: 11px;
            margin-top: 2px;
          }
          .total {
            border-top: 1px dashed #cbd5e1;
            font-size: 16px;
            font-weight: 800;
            margin-top: 12px;
            padding-top: 12px;
          }
          .thanks {
            margin-top: 18px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <h1>${businessName}</h1>
          <p class="muted">${businessDetails || "Receipt"}</p>
          <section class="meta">
            <div><span>Receipt</span><strong>${escapeHtml(receipt.reference)}</strong></div>
            <div><span>Date</span><strong>${escapeHtml(formatReceiptDate(receipt.createdAt))}</strong></div>
            <div><span>Customer</span><strong>${escapeHtml(receipt.customerName || "Walk-in")}</strong></div>
            <div><span>Payment</span><strong>${escapeHtml(receipt.paymentType)}</strong></div>
          </section>
          <table><tbody>${rows}</tbody></table>
          <div class="total"><span>Total</span><span>${escapeHtml(formatCurrency(receipt.total))}</span></div>
          <p class="thanks">Thank you.</p>
        </main>
      </body>
    </html>
  `;
}

export function Sales({
  business,
  customers = [],
  customersError,
  customersLoading,
  onCompleteSale,
  products = [],
}) {
  const [cart, setCart] = useState([]);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [paymentType, setPaymentType] = useState("MoMo");
  const [customerMode, setCustomerMode] = useState("walk-in");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const cartLines = cart
    .map((line) => {
      const product = products.find((item) => item.id === line.productId);
      return product ? { ...line, product, total: line.quantity * product.sellingPrice } : null;
    })
    .filter(Boolean);
  const total = cartLines.reduce((sum, line) => sum + line.total, 0);
  const profit = cartLines.reduce(
    (sum, line) => sum + (line.product.sellingPrice - line.product.costPrice) * line.quantity,
    0
  );
  const previewReceipt = cartLines.length
    ? {
        reference: "Draft receipt",
        customerName: getCustomerName(),
        lines: cartLines.map(toReceiptLine),
        paymentType,
        total,
        profit,
      }
    : lastReceipt;

  function getCustomerName() {
    if (customerMode === "existing") {
      return customers.find((customer) => customer.id === selectedCustomerId)?.name || "";
    }

    if (customerMode === "new") return newCustomerName.trim();
    return "Walk-in";
  }

  function getCustomerPayload() {
    if (customerMode === "existing") {
      return selectedCustomerId ? { mode: "existing", id: selectedCustomerId } : null;
    }

    if (customerMode === "new") {
      return {
        mode: "new",
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
      };
    }

    return { mode: "walk-in" };
  }

  const addToCart = (productId) => {
    setActionError("");
    setSuccessMessage("");

    setCart((current) => {
      const product = products.find((item) => item.id === productId);
      if (!product || product.quantity <= 0) return current;

      const existing = current.find((line) => line.productId === productId);
      if (existing) {
        if (existing.quantity >= product.quantity) return current;

        return current.map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { productId, quantity: 1 }];
    });
  };

  const changeQuantity = (productId, change) => {
    setActionError("");
    setSuccessMessage("");

    setCart((current) =>
      current
        .map((line) => {
          if (line.productId !== productId) return line;

          const product = products.find((item) => item.id === productId);
          const maxQuantity = product?.quantity || 0;
          return { ...line, quantity: Math.min(maxQuantity, Math.max(0, line.quantity + change)) };
        })
        .filter((line) => line.quantity > 0)
    );
  };

  const completeSale = async () => {
    setActionError("");
    setSuccessMessage("");

    if (!cartLines.length) {
      setActionError("Add at least one product to the cart.");
      return;
    }

    if (paymentType === "Credit" && customerMode === "walk-in") {
      setActionError("Select or add a customer for credit sales.");
      return;
    }

    if (customerMode === "existing" && !selectedCustomerId) {
      setActionError("Choose a customer or switch to walk-in.");
      return;
    }

    if (customerMode === "new" && !newCustomerName.trim()) {
      setActionError("Enter the customer name.");
      return;
    }

    const overStockLine = cartLines.find((line) => line.quantity > line.product.quantity);
    if (overStockLine) {
      setActionError(`${overStockLine.product.name} only has ${overStockLine.product.quantity} in stock.`);
      return;
    }

    setIsSaving(true);
    try {
      const sale = await onCompleteSale({
        customer: getCustomerPayload(),
        lines: cartLines,
        paymentType,
      });
      const receipt = {
        reference: sale.reference,
        customerName: getCustomerName(),
        lines: cartLines.map(toReceiptLine),
        paymentType,
        total,
        profit,
        createdAt: new Date().toISOString(),
      };

      setLastReceipt(receipt);
      setCart([]);
      setCustomerMode("walk-in");
      setSelectedCustomerId("");
      setNewCustomerName("");
      setNewCustomerPhone("");
      setSuccessMessage(`Sale ${sale.reference} recorded.`);
    } catch (error) {
      console.error("Unable to complete sale", error);
      setActionError(error.message || "Unable to complete sale.");
    } finally {
      setIsSaving(false);
    }
  };

  const printReceipt = () => {
    setActionError("");

    if (!lastReceipt) {
      setActionError("Complete a sale before printing a receipt.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=380,height=640");
    if (!printWindow) {
      setActionError("Allow pop-ups to print the receipt.");
      return;
    }

    printWindow.document.write(buildReceiptHtml(lastReceipt, business));
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  const shareReceipt = async () => {
    setActionError("");

    if (!lastReceipt) {
      setActionError("Complete a sale before sharing a receipt.");
      return;
    }

    const pdfFile = buildReceiptPdfFile(lastReceipt, business);
    const shareData = {
      files: [pdfFile],
      title: `Receipt ${lastReceipt.reference}`,
      text: "Receipt PDF",
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Unable to share receipt PDF", error);
        setActionError(error.message || "Unable to share the PDF receipt.");
        return;
      }
    }

    downloadFile(pdfFile);
    setActionError("PDF receipt downloaded. Attach it in WhatsApp because this browser cannot share PDF files directly.");
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-palm">Sales</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-ink">New sale</h1>
        </div>
        <Button
          icon={UserPlus}
          variant="secondary"
          type="button"
          onClick={() => {
            setCustomerMode("new");
            setActionError("");
            setSuccessMessage("");
          }}
        >
          Add customer
        </Button>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          <div className="panel p-4">
            <label className="label">Select product</label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {!products.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500 sm:col-span-2">
                  Add products in Inventory before recording a sale.
                </div>
              ) : null}
              {products.map((product) => (
                <button
                  key={product.id}
                  className="flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-palm/40 hover:bg-skyglass disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={product.quantity <= 0}
                  onClick={() => addToCart(product.id)}
                >
                  <span>
                    <span className="block text-sm font-black text-ink">{product.name}</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {product.size} | {product.colour}
                    </span>
                    <span className="mt-2 block text-sm font-black text-palm">
                      {formatCurrency(product.sellingPrice)}
                    </span>
                  </span>
                  <Badge variant={product.quantity <= product.lowStockLimit ? "amber" : "slate"}>
                    {product.quantity}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="label">Cart</p>
                <h2 className="mt-1 text-lg font-black text-ink">{cartLines.length} items selected</h2>
              </div>
              <ShoppingBag className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {cartLines.map((line) => (
                <div key={line.productId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-ink">{line.product.name}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {formatCurrency(line.product.sellingPrice)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="icon-button h-9 w-9" onClick={() => changeQuantity(line.productId, -1)} aria-label="Reduce quantity">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="grid h-9 min-w-10 place-items-center rounded-xl bg-slate-100 px-2 text-sm font-black text-ink">
                      {line.quantity}
                    </span>
                    <button
                      className="icon-button h-9 w-9 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={line.quantity >= line.product.quantity}
                      onClick={() => changeQuantity(line.productId, 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel p-4">
            <p className="label">Payment type</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {paymentTypes.map((type) => (
                <button
                  key={type}
                  className={`min-h-11 rounded-xl border text-sm font-black transition ${
                    paymentType === type
                      ? "border-palm bg-palm text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                  onClick={() => setPaymentType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="label">Customer</p>
              {customersLoading ? (
                <span className="text-xs font-bold text-slate-500">Loading</span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { id: "walk-in", label: "Walk-in" },
                { id: "existing", label: "Existing" },
                { id: "new", label: "New" },
              ].map((mode) => (
                <button
                  key={mode.id}
                  className={`min-h-10 rounded-xl border text-xs font-black transition ${
                    customerMode === mode.id
                      ? "border-palm bg-palm text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                  type="button"
                  onClick={() => {
                    setCustomerMode(mode.id);
                    setActionError("");
                    setSuccessMessage("");
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {customerMode === "existing" ? (
              <select
                className="field mt-3"
                disabled={customersLoading}
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            ) : null}

            {customerMode === "new" ? (
              <div className="mt-3 grid gap-2">
                <input
                  className="field"
                  placeholder="Customer name"
                  value={newCustomerName}
                  onChange={(event) => setNewCustomerName(event.target.value)}
                />
                <input
                  className="field"
                  placeholder="Phone"
                  value={newCustomerPhone}
                  onChange={(event) => setNewCustomerPhone(event.target.value)}
                />
              </div>
            ) : null}

            {customersError ? (
              <p className="mt-3 text-xs font-semibold text-red-600">{customersError}</p>
            ) : null}
          </div>

          <ReceiptPreview
            business={business}
            receipt={previewReceipt}
          />

          <div className="grid gap-2">
            {actionError ? (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {actionError}
              </div>
            ) : null}
            {successMessage ? (
              <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {successMessage}
              </div>
            ) : null}
            <Button
              icon={ReceiptText}
              disabled={!cartLines.length}
              isLoading={isSaving}
              onClick={completeSale}
            >
              Complete sale
            </Button>
            <Button icon={Printer} variant="secondary" disabled={!lastReceipt} onClick={printReceipt}>
              Print receipt
            </Button>
            <Button icon={Send} variant="secondary" disabled={!lastReceipt} onClick={shareReceipt}>
              Share PDF receipt
            </Button>
            <Button icon={Trash2} variant="ghost" onClick={() => setCart([])}>
              Clear cart
            </Button>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ReceiptPreview({ business, receipt }) {
  const businessName = business?.name || "BizTrac";
  const lines = receipt?.lines || [];

  return (
    <div className="panel overflow-hidden">
      <div className="bg-ink p-4 text-white">
        <p className="text-sm font-black">{businessName}</p>
        <p className="mt-1 text-xs text-white/60">
          {[business?.phone, business?.location].filter(Boolean).join(" | ") || "Receipt preview"}
        </p>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span>{receipt?.reference || "Draft receipt"}</span>
          <span>{receipt?.paymentType || "MoMo"}</span>
        </div>
        <p className="mt-2 text-xs font-bold text-slate-500">
          Customer: {receipt?.customerName || "Walk-in"}
        </p>
        <div className="mt-4 space-y-3">
          {lines.map((line) => (
            <div key={line.productId} className="flex justify-between gap-3 text-sm">
              <span className="text-slate-600">{line.quantity} x {line.name}</span>
              <span className="font-black text-ink">{formatCurrency(line.total)}</span>
            </div>
          ))}
          {!lines.length ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm font-semibold text-slate-500">
              Add products to preview the receipt.
            </p>
          ) : null}
        </div>
        <div className="mt-4 border-t border-dashed border-slate-200 pt-4">
          <div className="flex justify-between text-sm font-bold text-slate-500">
            <span>Estimated profit</span>
            <span>{formatCurrency(receipt?.profit || 0)}</span>
          </div>
          <div className="mt-2 flex justify-between text-xl font-black text-ink">
            <span>Total</span>
            <span>{formatCurrency(receipt?.total || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

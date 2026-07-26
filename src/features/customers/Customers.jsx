import { useMemo, useState } from "react";
import {
  UserPlus,
  Search,
  Wallet,
  Printer,
  MessageSquare,
  Copy,
  CheckCircle2,
  X,
  ReceiptText,
} from "lucide-react";
import { showToast } from "../../lib/toast.js";
import { formatCurrency } from "../../lib/formatters.js";

function isValidEmail(value) {
  return /\S+@\S+\.\S+/.test(value || "");
}

function isValidPhone(value) {
  if (!value) return true;
  const normalized = value.replace(/[^0-9+]/g, "");
  return normalized.length >= 7 && normalized.length <= 15;
}

function buildDebtWhatsAppText(receipt, businessName = "BizTrac") {
  const dateStr = new Date(receipt.createdAt).toLocaleDateString("en-GB", {
    dateStyle: "medium",
  });
  return [
    `🧾 *DEBT REPAYMENT RECEIPT - ${businessName.toUpperCase()}*`,
    `--------------------------------`,
    `🔢 *Ref:* ${receipt.reference}`,
    `📅 *Date:* ${dateStr}`,
    `👤 *Customer:* ${receipt.customerName}`,
    `💳 *Method:* ${String(receipt.paymentMethod).toUpperCase()}`,
    `--------------------------------`,
    `💵 *Amount Received:* ${formatCurrency(receipt.amountPaid)}`,
    `⚠️ *Remaining Debt Balance:* ${formatCurrency(receipt.remainingDebt)}`,
    `--------------------------------`,
    `🙏 *Thank you for your payment!*`,
  ].join("\n");
}

function buildDebtReceiptHtml(receipt, businessName = "BizTrac") {
  const dateStr = new Date(receipt.createdAt).toLocaleDateString("en-GB", {
    dateStyle: "medium",
  });
  return `
    <!doctype html>
    <html>
      <head>
        <title>Repayment Receipt ${receipt.reference}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #fff; color: #111827; font-family: Arial, sans-serif; font-size: 13px; }
          .receipt { width: 320px; max-width: 100%; margin: 0 auto; padding: 18px; }
          h1 { margin: 0; font-size: 18px; text-align: center; }
          .muted { color: #64748b; font-size: 11px; text-align: center; }
          .meta { border-bottom: 1px dashed #cbd5e1; border-top: 1px dashed #cbd5e1; margin: 14px 0; padding: 10px 0; }
          .meta div, .row { display: flex; justify-content: space-between; gap: 12px; margin-top: 4px; }
          .total { border-top: 1px dashed #cbd5e1; font-size: 15px; font-weight: 800; margin-top: 12px; padding-top: 12px; }
          .thanks { margin-top: 18px; text-align: center; }
        </style>
      </head>
      <body>
        <main class="receipt">
          <h1>${businessName}</h1>
          <p class="muted">Debt Repayment Receipt</p>
          <section class="meta">
            <div><span>Receipt</span><strong>${receipt.reference}</strong></div>
            <div><span>Date</span><strong>${dateStr}</strong></div>
            <div><span>Customer</span><strong>${receipt.customerName}</strong></div>
            <div><span>Method</span><strong>${String(receipt.paymentMethod).toUpperCase()}</strong></div>
          </section>
          <div class="row"><span>Previous Debt</span><span>${formatCurrency(receipt.previousDebt)}</span></div>
          <div class="total" style="color: #027aec;"><span>Amount Paid</span><span>${formatCurrency(receipt.amountPaid)}</span></div>
          <div class="row" style="color: #dc2626; font-weight: 800; margin-top: 8px;"><span>Remaining Debt Balance</span><span>${formatCurrency(receipt.remainingDebt)}</span></div>
          <p class="thanks">Thank you for your payment.</p>
        </main>
      </body>
    </html>
  `;
}

export function Customers({
  customers = [],
  customersLoading = false,
  customersError = "",
  onCreateCustomer,
  onPayDebt,
  onNavigate,
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  // Pay Debt Modal State
  const [activePaymentCustomer, setActivePaymentCustomer] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState("");

  // Repayment Receipt Modal State
  const [repaymentReceipt, setRepaymentReceipt] = useState(null);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }, [customers, query]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmedName = (name || "").trim();
    const trimmedPhone = (phone || "").trim();
    const trimmedEmail = (email || "").trim();

    if (!trimmedName) return setError("Name is required.");
    if (trimmedEmail && !isValidEmail(trimmedEmail)) return setError("Enter a valid email address.");
    if (!isValidPhone(trimmedPhone)) return setError("Enter a valid phone number.");

    try {
      setSubmitting(true);
      if (onCreateCustomer) {
        await onCreateCustomer({ name: trimmedName, phone: trimmedPhone, email: trimmedEmail });
      }
      showToast("Customer created", { type: "success" });
      setName("");
      setPhone("");
      setEmail("");
      setShowForm(false);
    } catch (err) {
      setError(err?.message || "Unable to create customer.");
      showToast(err?.message || "Unable to create customer", { type: "warn" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecordDebtPayment(e) {
    e.preventDefault();
    setPayError("");

    const amountNum = Number(payAmount);
    if (!amountNum || amountNum <= 0) {
      setPayError("Enter a valid payment amount greater than zero.");
      return;
    }

    try {
      setPaySubmitting(true);
      if (onPayDebt && activePaymentCustomer) {
        await onPayDebt(activePaymentCustomer.id, amountNum, payMethod);
      }

      const ref = `DP-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}`;
      const prevDebt = activePaymentCustomer.debt || 0;
      const remDebt = Math.max(0, prevDebt - amountNum);

      const receiptData = {
        reference: ref,
        customerName: activePaymentCustomer.name,
        customerPhone: activePaymentCustomer.phone,
        amountPaid: amountNum,
        previousDebt: prevDebt,
        remainingDebt: remDebt,
        paymentMethod: payMethod,
        createdAt: new Date().toISOString(),
      };

      showToast(`Payment of ${formatCurrency(amountNum)} recorded for ${activePaymentCustomer.name}.`, {
        type: "success",
      });

      setRepaymentReceipt(receiptData);
      setActivePaymentCustomer(null);
      setPayAmount("");
      setPayMethod("cash");
    } catch (err) {
      console.error("Unable to record debt payment", err);
      setPayError(err?.message || "Unable to record debt payment.");
      showToast(err?.message || "Unable to record payment", { type: "warn" });
    } finally {
      setPaySubmitting(false);
    }
  }

  function handlePrintReceipt(receipt) {
    const html = buildDebtReceiptHtml(receipt);
    const win = window.open("", "_blank");
    if (!win) {
      showToast("Allow popups to print receipt", { type: "warn" });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 250);
  }

  function handleSendWhatsApp(receipt) {
    const text = buildDebtWhatsAppText(receipt);
    const phoneDigits = receipt.customerPhone
      ? String(receipt.customerPhone).replace(/[^0-9]/g, "")
      : "";
    const url = phoneDigits
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  function handleCopyReceipt(receipt) {
    const text = buildDebtWhatsAppText(receipt);
    navigator.clipboard.writeText(text);
    showToast("Receipt copied to clipboard", { type: "success" });
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm font-bold text-palm">Customers</p>
            <h1 className="mt-1 text-2xl font-black text-ink">Directory & Debtors</h1>
          </div>
          <div className="relative">
            <input
              placeholder="Search customers"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-8 py-2 text-sm text-slate-900 outline-none focus:border-palm"
            />
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-2xl bg-palm px-4 py-2 text-sm font-bold text-white shadow-soft transition hover:bg-palm/90"
            onClick={() => setShowForm((s) => !s)}
            aria-expanded={showForm}
          >
            <UserPlus className="h-4 w-4" />
            <span>{showForm ? "Cancel" : "Add customer"}</span>
          </button>
        </div>
      </header>

      {customersLoading && <p className="text-sm font-bold text-slate-500">Loading customers…</p>}
      {customersError && <p className="text-sm font-bold text-red-600">{customersError}</p>}

      {showForm && (
        <form className="panel space-y-3 p-4" onSubmit={handleSubmit}>
          <h3 className="text-base font-black text-ink">New customer</h3>
          <div>
            <label className="text-xs font-bold text-slate-500">Full name</label>
            <input
              className="field mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-500">Phone</label>
              <input
                className="field mt-1"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="024XXXXXXX"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Email</label>
              <input
                className="field mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
          </div>
          {error && <p className="text-xs font-bold text-red-600">{error}</p>}
          <div className="pt-2">
            <button
              className="rounded-xl bg-palm px-4 py-2.5 text-sm font-black text-white shadow-soft"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save customer"}
            </button>
          </div>
        </form>
      )}

      {/* Record Debt Payment Modal */}
      {activePaymentCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <form
            className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onSubmit={handleRecordDebtPayment}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-palm">Record Debt Repayment</p>
                <h3 className="text-xl font-black text-ink">{activePaymentCustomer.name}</h3>
              </div>
              <Wallet className="h-6 w-6 text-palm" />
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-3 flex justify-between items-center text-xs font-bold">
              <span className="text-slate-600">Current Total Debt:</span>
              <span className="text-sm font-black text-red-600">
                {formatCurrency(activePaymentCustomer.debt || 0)}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">Payment Amount (GHS)</label>
              <input
                type="number"
                min="0.01"
                max={activePaymentCustomer.debt || undefined}
                step="0.01"
                className="field mt-1 text-lg font-black text-ink"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                autoFocus
                required
              />
              {activePaymentCustomer.debt > 0 ? (
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 hover:border-palm hover:text-palm"
                    onClick={() => setPayAmount(String(activePaymentCustomer.debt))}
                  >
                    Pay Full ({formatCurrency(activePaymentCustomer.debt)})
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 hover:border-palm hover:text-palm"
                    onClick={() => setPayAmount(String((activePaymentCustomer.debt / 2).toFixed(2)))}
                  >
                    Pay Half ({formatCurrency(activePaymentCustomer.debt / 2)})
                  </button>
                </div>
              ) : null}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">Payment Method</label>
              <select
                className="field mt-1"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="momo">MoMo (Mobile Money)</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>

            {payError && <p className="text-xs font-bold text-red-600">{payError}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-palm py-3 text-sm font-black text-white shadow-soft transition hover:bg-palm/90"
                disabled={paySubmitting}
              >
                {paySubmitting ? "Recording…" : "Confirm Payment"}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
                onClick={() => setActivePaymentCustomer(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Debt Repayment Receipt Modal */}
      {repaymentReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-black text-ink">Payment Recorded</h3>
              </div>
              <button
                type="button"
                className="icon-button h-8 w-8"
                onClick={() => setRepaymentReceipt(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Receipt Ref:</span>
                <span>{repaymentReceipt.reference}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Customer:</span>
                <span className="font-black text-ink">{repaymentReceipt.customerName}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Payment Method:</span>
                <span className="uppercase">{repaymentReceipt.paymentMethod}</span>
              </div>

              <div className="border-t border-slate-200 pt-2 space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Previous Debt:</span>
                  <span>{formatCurrency(repaymentReceipt.previousDebt)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-palm">
                  <span>Amount Paid:</span>
                  <span>{formatCurrency(repaymentReceipt.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-red-600 border-t border-slate-200 pt-1">
                  <span>Remaining Debt Balance:</span>
                  <span>{formatCurrency(repaymentReceipt.remainingDebt)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white shadow-soft transition hover:bg-emerald-700"
                onClick={() => handleSendWhatsApp(repaymentReceipt)}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Send Receipt via WhatsApp</span>
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                  onClick={() => handlePrintReceipt(repaymentReceipt)}
                >
                  <Printer className="h-3.5 w-3.5 text-palm" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                  onClick={() => handleCopyReceipt(repaymentReceipt)}
                >
                  <Copy className="h-3.5 w-3.5 text-palm" />
                  <span>Copy Text</span>
                </button>
              </div>
              <button
                type="button"
                className="rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 mt-1"
                onClick={() => setRepaymentReceipt(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel divide-y divide-slate-100">
        {filtered.map((c) => (
          <div key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-black text-ink">{c.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs font-semibold text-slate-500">{c.phone || c.email || "No contact info"}</p>
                {c.debt > 0 ? (
                  <span className="rounded-full bg-red-50 border border-red-200/60 px-2.5 py-0.5 text-[11px] font-black text-red-600">
                    Owes: {formatCurrency(c.debt)}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    No Debt
                  </span>
                )}
                {c.due ? (
                  <span className="rounded-full bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    {c.due}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
                onClick={() => setActivePaymentCustomer(c)}
              >
                <span className="text-xs font-black text-palm">GH₵</span>
                <span>Record payment</span>
              </button>

              <button
                className="rounded-xl bg-palm/10 px-3 py-1.5 text-xs font-black text-palm hover:bg-palm/20"
                onClick={() => onNavigate && onNavigate("sales")}
              >
                Sell
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && !customersLoading && (
          <div className="p-6 text-center text-sm font-semibold text-slate-500">No customers found.</div>
        )}
      </div>
    </section>
  );
}

export default Customers;

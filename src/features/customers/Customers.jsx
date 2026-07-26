import { useMemo, useState, useEffect } from "react";
import {
  UserPlus,
  Search,
  Wallet,
  Printer,
  MessageSquare,
  Copy,
  CheckCircle2,
  X,
  Phone,
  Mail,
  Calendar,
  ShoppingBag,
  Eye,
  Edit3,
  Clock,
  Loader2,
  ArrowUpRight,
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

function buildCustomerWhatsAppStatement(customer, metrics, purchases = [], businessName = "BizTrac") {
  const dateStr = new Date().toLocaleDateString("en-GB", { dateStyle: "medium" });
  const lines = [
    `📊 *ACCOUNT STATEMENT - ${businessName.toUpperCase()}*`,
    `--------------------------------`,
    `📅 *Date:* ${dateStr}`,
    `👤 *Customer:* ${customer.name}`,
    `📱 *Phone:* ${customer.phone || "N/A"}`,
    `--------------------------------`,
    `🛍️ *Total Purchases:* ${metrics?.totalOrders || 0} order(s)`,
    `💳 *Lifetime Spend:* ${formatCurrency(metrics?.lifetimeSpend || 0)}`,
    `⚠️ *Current Balance Owed:* ${formatCurrency(metrics?.activeDebt || customer.debt || 0)}`,
  ];

  if (purchases && purchases.length > 0) {
    lines.push(`--------------------------------`);
    lines.push(`📜 *Recent Transaction History:*`);
    purchases.slice(0, 3).forEach((p) => {
      const pDate = new Date(p.date).toLocaleDateString("en-GB", { dateStyle: "short" });
      lines.push(`• ${pDate}: ${formatCurrency(p.total)} (${String(p.paymentMethod).toUpperCase()})`);
    });
  }

  lines.push(`--------------------------------`);
  lines.push(`🙏 *Thank you for doing business with us!*`);
  return lines.join("\n");
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
  onUpdateCustomer,
  onFetchCustomerDetails,
  onPayDebt,
  onNavigate,
  initialFilterTab = "all",
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  // Directory Filter Tab State ("all" | "debtors")
  const [directoryTab, setDirectoryTab] = useState(initialFilterTab);

  // Pay Debt Modal State
  const [activePaymentCustomer, setActivePaymentCustomer] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState("");

  // Repayment Receipt Modal State
  const [repaymentReceipt, setRepaymentReceipt] = useState(null);

  // View Customer Profile Drawer State
  const [selectedCustomerForView, setSelectedCustomerForView] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Edit Customer Form State inside Drawer
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const totalDebtorsCount = useMemo(() => {
    return customers.filter((c) => (c.debt || 0) > 0).length;
  }, [customers]);

  const totalOutstandingDebt = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.debt || 0), 0);
  }, [customers]);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    let list = customers;

    if (directoryTab === "debtors") {
      list = list.filter((c) => (c.debt || 0) > 0);
    }

    if (!q) return list;
    return list.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }, [customers, query, directoryTab]);

  useEffect(() => {
    if (!selectedCustomerForView) {
      setDetailsData(null);
      return;
    }

    setEditName(selectedCustomerForView.name || "");
    setEditPhone(selectedCustomerForView.phone || "");
    setEditEmail(selectedCustomerForView.email || "");
    setEditNotes(selectedCustomerForView.notes || "");
    setEditError("");
    setActiveTab("overview");

    let isMounted = true;
    setDetailsLoading(true);

    if (onFetchCustomerDetails) {
      onFetchCustomerDetails(selectedCustomerForView.id)
        .then((res) => {
          if (isMounted) setDetailsData(res);
        })
        .catch((err) => {
          console.warn("Unable to load customer details", err);
          if (isMounted) {
            setDetailsData({
              customer: selectedCustomerForView,
              metrics: {
                totalOrders: 0,
                lifetimeSpend: 0,
                activeDebt: selectedCustomerForView.debt || 0,
              },
              purchases: [],
            });
          }
        })
        .finally(() => {
          if (isMounted) setDetailsLoading(false);
        });
    } else {
      setDetailsData({
        customer: selectedCustomerForView,
        metrics: {
          totalOrders: 0,
          lifetimeSpend: 0,
          activeDebt: selectedCustomerForView.debt || 0,
        },
        purchases: [],
      });
      setDetailsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [selectedCustomerForView, onFetchCustomerDetails]);

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

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError("");

    const trimmedName = (editName || "").trim();
    const trimmedPhone = (editPhone || "").trim();
    const trimmedEmail = (editEmail || "").trim();
    const trimmedNotes = (editNotes || "").trim();

    if (!trimmedName) return setEditError("Customer name is required.");
    if (trimmedEmail && !isValidEmail(trimmedEmail)) return setEditError("Enter a valid email address.");
    if (!isValidPhone(trimmedPhone)) return setEditError("Enter a valid phone number.");

    try {
      setEditSubmitting(true);
      if (onUpdateCustomer && selectedCustomerForView) {
        const updated = await onUpdateCustomer(selectedCustomerForView.id, {
          name: trimmedName,
          phone: trimmedPhone,
          email: trimmedEmail,
          notes: trimmedNotes,
        });
        setSelectedCustomerForView((prev) => ({ ...prev, ...updated }));
        setDetailsData((prev) => (prev ? { ...prev, customer: { ...prev.customer, ...updated } } : prev));
      }
      showToast("Customer updated successfully", { type: "success" });
      setActiveTab("overview");
    } catch (err) {
      setEditError(err?.message || "Unable to update customer.");
      showToast(err?.message || "Unable to update customer", { type: "warn" });
    } finally {
      setEditSubmitting(false);
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

  function handleSendCustomerStatement(customer, metrics, purchases) {
    const text = buildCustomerWhatsAppStatement(customer, metrics, purchases);
    const phoneDigits = customer.phone ? String(customer.phone).replace(/[^0-9]/g, "") : "";
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
            <h1 className="mt-1 text-2xl font-black text-ink">Directory & Profiles</h1>
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

      {/* Segmented Directory Filter Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1 self-start">
          <button
            type="button"
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
              directoryTab === "all"
                ? "bg-white text-ink shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setDirectoryTab("all")}
          >
            <span>All Customers</span>
            <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {customers.length}
            </span>
          </button>

          <button
            type="button"
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
              directoryTab === "debtors"
                ? "bg-white text-red-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setDirectoryTab("debtors")}
          >
            <span>Debtors Only</span>
            {totalDebtorsCount > 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-600">
                {totalDebtorsCount}
              </span>
            ) : (
              <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                0
              </span>
            )}
          </button>
        </div>

        {totalOutstandingDebt > 0 ? (
          <div className="rounded-2xl border border-red-200/80 bg-red-50/70 px-3.5 py-2 flex items-center justify-between gap-3 text-xs font-bold self-start sm:self-auto">
            <span className="text-slate-600">Total Outstanding Debt Owed:</span>
            <span className="text-sm font-black text-red-600">{formatCurrency(totalOutstandingDebt)}</span>
          </div>
        ) : null}
      </div>

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

      {/* Customer Profile Details Modal / Drawer */}
      {selectedCustomerForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-palm/10 border border-palm/20 flex items-center justify-center text-xl font-black text-palm shrink-0">
                  {selectedCustomerForView.name
                    ? selectedCustomerForView.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                    : "CU"}
                </div>
                <div>
                  <h2 className="text-xl font-black text-ink">{selectedCustomerForView.name}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs font-bold text-slate-500 flex-wrap">
                    {selectedCustomerForView.phone && (
                      <a href={`tel:${selectedCustomerForView.phone}`} className="flex items-center gap-1 hover:text-palm">
                        <Phone className="h-3.5 w-3.5 text-palm" />
                        <span>{selectedCustomerForView.phone}</span>
                      </a>
                    )}
                    {selectedCustomerForView.email && (
                      <a href={`mailto:${selectedCustomerForView.email}`} className="flex items-center gap-1 hover:text-palm">
                        <Mail className="h-3.5 w-3.5 text-palm" />
                        <span>{selectedCustomerForView.email}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="icon-button h-9 w-9 rounded-2xl bg-slate-100 hover:bg-slate-200"
                onClick={() => setSelectedCustomerForView(null)}
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex border-b border-slate-100 px-6 bg-white">
              <button
                type="button"
                className={`py-3 px-4 text-xs font-black border-b-2 transition ${
                  activeTab === "overview"
                    ? "border-palm text-palm"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => setActiveTab("overview")}
              >
                Overview & History
              </button>
              <button
                type="button"
                className={`py-3 px-4 text-xs font-black border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === "edit"
                    ? "border-palm text-palm"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => setActiveTab("edit")}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Profile</span>
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {detailsLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-palm" />
                  <p className="text-xs font-bold">Loading customer profile…</p>
                </div>
              ) : activeTab === "overview" ? (
                <>
                  {/* Financial Metrics Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Orders</p>
                      <p className="mt-1 text-lg font-black text-ink">{detailsData?.metrics?.totalOrders || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lifetime Spend</p>
                      <p className="mt-1 text-sm font-black text-palm">
                        {formatCurrency(detailsData?.metrics?.lifetimeSpend || 0)}
                      </p>
                    </div>
                    <div
                      className={`rounded-2xl border p-3 text-center ${
                        (detailsData?.metrics?.activeDebt || 0) > 0
                          ? "border-red-200 bg-red-50/60"
                          : "border-emerald-200 bg-emerald-50/60"
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Debt</p>
                      <p
                        className={`mt-1 text-sm font-black ${
                          (detailsData?.metrics?.activeDebt || 0) > 0 ? "text-red-600" : "text-emerald-700"
                        }`}
                      >
                        {formatCurrency(detailsData?.metrics?.activeDebt || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Customer Notes */}
                  {selectedCustomerForView.notes && (
                    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3 text-xs">
                      <p className="font-bold text-amber-800">Customer Notes:</p>
                      <p className="mt-0.5 text-amber-900">{selectedCustomerForView.notes}</p>
                    </div>
                  )}

                  {/* Purchase History Ledger */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-ink flex items-center gap-1.5">
                        <ShoppingBag className="h-4 w-4 text-palm" />
                        <span>Purchase Transaction Ledger</span>
                      </h4>
                      <span className="text-xs font-bold text-slate-400">
                        {detailsData?.purchases?.length || 0} transaction(s)
                      </span>
                    </div>

                    {detailsData?.purchases && detailsData.purchases.length > 0 ? (
                      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        {detailsData.purchases.map((purchase) => (
                          <div key={purchase.id} className="p-3.5 space-y-1.5 hover:bg-slate-50/50">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <div className="flex items-center gap-2">
                                <span className="text-ink font-black">
                                  {new Date(purchase.date).toLocaleDateString("en-GB", {
                                    dateStyle: "medium",
                                  })}
                                </span>
                                <span className="uppercase text-[10px] font-black rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                                  {purchase.paymentMethod}
                                </span>
                              </div>
                              <span className="text-sm font-black text-ink">
                                {formatCurrency(purchase.total)}
                              </span>
                            </div>

                            {purchase.items && purchase.items.length > 0 ? (
                              <p className="text-xs text-slate-500 truncate">
                                {purchase.items.map((i) => `${i.name} (${i.quantity}x)`).join(", ")}
                              </p>
                            ) : null}

                            <div className="flex justify-between items-center text-[11px] text-slate-400">
                              <span>Paid: {formatCurrency(purchase.amountPaid)}</span>
                              {purchase.total > purchase.amountPaid ? (
                                <span className="font-bold text-red-600">
                                  Balance Due: {formatCurrency(purchase.total - purchase.amountPaid)}
                                </span>
                              ) : (
                                <span className="font-bold text-emerald-600">Paid in Full</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs font-semibold text-slate-500">
                        No purchase transactions recorded yet for this customer.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Edit Customer Form */
                <form className="space-y-4" onSubmit={handleEditSubmit}>
                  <div>
                    <label className="text-xs font-bold text-slate-500">Full Name</label>
                    <input
                      className="field mt-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Customer name"
                      required
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold text-slate-500">Phone Number</label>
                      <input
                        className="field mt-1"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="024XXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500">Email Address</label>
                      <input
                        className="field mt-1"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="customer@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">Notes / Preferences</label>
                    <textarea
                      className="field mt-1 h-24 resize-none"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Optional notes or customer details"
                    />
                  </div>

                  {editError && <p className="text-xs font-bold text-red-600">{editError}</p>}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 rounded-2xl bg-palm py-3 text-xs font-black text-white shadow-soft transition hover:bg-palm/90"
                      disabled={editSubmitting}
                    >
                      {editSubmitting ? "Saving Updates…" : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100"
                      onClick={() => setActiveTab("overview")}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Bottom Action Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-palm py-2.5 px-3 text-xs font-black text-white shadow-soft hover:bg-palm/90"
                onClick={() => {
                  if (onNavigate) onNavigate("sales");
                  setSelectedCustomerForView(null);
                }}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>New Sale</span>
              </button>

              <button
                type="button"
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-sm"
                onClick={() => {
                  const cust = selectedCustomerForView;
                  setSelectedCustomerForView(null);
                  setActivePaymentCustomer(cust);
                }}
              >
                <span className="text-xs font-black text-palm">GH₵</span>
                <span>Record Debt Payment</span>
              </button>

              <button
                type="button"
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 py-2.5 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                onClick={() => handleSendCustomerStatement(selectedCustomerForView, detailsData?.metrics, detailsData?.purchases)}
              >
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                <span>WhatsApp Statement</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel divide-y divide-slate-100">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between transition hover:bg-slate-50/60 cursor-pointer"
            onClick={() => setSelectedCustomerForView(c)}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-palm/10 border border-palm/20 flex items-center justify-center text-sm font-black text-palm shrink-0">
                {c.name
                  ? c.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                  : "CU"}
              </div>
              <div>
                <p className="text-base font-black text-ink flex items-center gap-1.5">
                  <span>{c.name}</span>
                  <Eye className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100" />
                </p>
                <div className="flex items-center gap-2 mt-0.5">
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
            </div>

            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
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

import { useMemo, useState } from "react";
import { UserPlus, Search, DollarSign, Wallet } from "lucide-react";
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
      showToast(`Payment of ${formatCurrency(amountNum)} recorded for ${activePaymentCustomer.name}.`, {
        type: "success",
      });
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

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm font-bold text-palm">Customers</p>
            <h1 className="mt-1 text-2xl font-black text-ink">Directory</h1>
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

      {/* Debt Repayment Modal */}
      {activePaymentCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <form
            className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onSubmit={handleRecordDebtPayment}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-palm">Debt Repayment</p>
                <h3 className="text-xl font-black text-ink">{activePaymentCustomer.name}</h3>
              </div>
              <Wallet className="h-6 w-6 text-palm" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">Payment Amount (GHS)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="field mt-1 text-lg font-black text-ink"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                autoFocus
                required
              />
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

      <div className="panel divide-y divide-slate-100">
        {filtered.map((c) => (
          <div key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-black text-ink">{c.name}</p>
              <p className="text-xs font-semibold text-slate-500">{c.phone || c.email || "No contact info"}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => setActivePaymentCustomer(c)}
              >
                <DollarSign className="h-3.5 w-3.5 text-palm" />
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

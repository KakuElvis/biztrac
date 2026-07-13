import { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, CreditCard, Loader2, Plus, WalletCards } from "lucide-react";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { expenseCategories } from "../../lib/expenseCategories.js";
import { formatCurrency } from "../../lib/formatters.js";

function getTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

function initialForm() {
  return {
    title: "",
    amount: "",
    category: expenseCategories[0],
    incurredOn: getTodayKey(),
    paymentMethod: "cash",
    notes: "",
  };
}

function displayPaymentMethod(value) {
  const labels = {
    bank: "Bank",
    cash: "Cash",
    momo: "MoMo",
  };

  return labels[value] || value;
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
      {children}
    </div>
  );
}

export function Expenses({
  expenses = [],
  expensesError,
  expensesLoading,
  onCreateExpense,
}) {
  const [form, setForm] = useState(initialForm);
  const [actionError, setActionError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const total = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses]
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setActionError("");

    const amount = Number(form.amount);
    if (!form.title.trim()) {
      setActionError("Add an expense title.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError("Enter an amount greater than zero.");
      return;
    }

    setIsSaving(true);
    try {
      await onCreateExpense({
        ...form,
        amount,
        title: form.title.trim(),
        notes: form.notes.trim(),
      });
      setForm(initialForm());
    } catch (error) {
      console.error("Unable to save expense", error);
      setActionError(error.message || "Unable to save expense.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-palm">Expenses</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-ink">Money out</h1>
        </div>
        <Button icon={Plus} type="button">
          Record expense
        </Button>
      </section>

      {expensesError ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {expensesError}
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <form className="panel p-4 sm:p-5" onSubmit={handleSubmit}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-warning/15 text-warning">
              <WalletCards className="h-5 w-5" />
            </span>
            <div>
              <p className="label">New expense</p>
              <h2 className="text-lg font-black text-ink">Record cost</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <label>
              <span className="label">Expense title</span>
              <input
                className="field mt-2"
                placeholder="Packaging bags"
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="label">Amount</span>
                <input
                  className="field mt-2"
                  inputMode="decimal"
                  min="0"
                  placeholder="GHS 0.00"
                  type="number"
                  value={form.amount}
                  onChange={(event) => updateField("amount", event.target.value)}
                />
              </label>
              <label>
                <span className="label">Category</span>
                <select
                  className="field mt-2"
                  value={form.category}
                  onChange={(event) => updateField("category", event.target.value)}
                >
                  {expenseCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="label">Date</span>
                <input
                  className="field mt-2"
                  type="date"
                  value={form.incurredOn}
                  onChange={(event) => updateField("incurredOn", event.target.value)}
                />
              </label>
              <label>
                <span className="label">Payment method</span>
                <select
                  className="field mt-2"
                  value={form.paymentMethod}
                  onChange={(event) => updateField("paymentMethod", event.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="momo">MoMo</option>
                  <option value="bank">Bank</option>
                </select>
              </label>
            </div>
            <label>
              <span className="label">Notes</span>
              <textarea
                className="field mt-2 min-h-24 py-3"
                placeholder="Optional note"
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
              />
            </label>
            {actionError ? (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {actionError}
              </div>
            ) : null}
            <Button icon={Plus} isLoading={isSaving}>
              Save expense
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="panel p-4">
            <p className="label">Recorded total</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <h2 className="text-3xl font-black text-ink">{formatCurrency(total)}</h2>
              <Badge variant="amber">{expenses.length} records</Badge>
            </div>
          </div>

          <div className="panel p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="label">Expense history</p>
                <h2 className="mt-1 text-lg font-black text-ink">Recent costs</h2>
              </div>
              <CalendarDays className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {expensesLoading ? (
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading expenses
                </div>
              ) : null}
              {!expensesLoading && !expenses.length ? (
                <EmptyState>No expenses recorded yet.</EmptyState>
              ) : null}
              {!expensesLoading &&
                expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-palm">
                        <CreditCard className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-ink">{expense.title}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          {expense.category} |{" "}
                          {expense.method || displayPaymentMethod(expense.paymentMethod)} |{" "}
                          {expense.date || expense.incurredOn}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-red-600">
                      {formatCurrency(expense.amount)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

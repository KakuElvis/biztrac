import { supabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
  }

  return supabase;
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === yesterday.getTime()) return "Yesterday";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatPaymentMethod(value) {
  const labels = {
    bank: "Bank",
    cash: "Cash",
    momo: "MoMo",
  };

  return labels[value] || "Cash";
}

function toPaymentMethod(value) {
  const normalized = String(value || "cash").toLowerCase();
  if (normalized === "momo") return "momo";
  if (normalized === "bank") return "bank";
  return "cash";
}

function toExpense(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    title: row.title,
    category: row.category,
    amount: Number(row.amount),
    method: formatPaymentMethod(row.payment_method),
    paymentMethod: row.payment_method,
    incurredOn: row.incurred_on,
    date: formatDate(row.incurred_on),
    notes: row.notes || "",
  };
}

function toExpenseRow(expense, userId) {
  return {
    title: expense.title.trim(),
    category: expense.category,
    amount: expense.amount,
    payment_method: toPaymentMethod(expense.paymentMethod),
    incurred_on: expense.incurredOn,
    notes: expense.notes.trim() || null,
    created_by: userId,
  };
}

export async function listExpenses(businessId) {
  const { data, error } = await requireSupabase()
    .from("expenses")
    .select("*")
    .eq("business_id", businessId)
    .order("incurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(toExpense);
}

export async function createExpense(businessId, userId, expense) {
  const { data, error } = await requireSupabase()
    .from("expenses")
    .insert({ business_id: businessId, ...toExpenseRow(expense, userId) })
    .select()
    .single();

  if (error) throw error;
  return toExpense(data);
}

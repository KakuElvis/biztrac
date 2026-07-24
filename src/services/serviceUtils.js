import { supabase } from "../lib/supabase.js";

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
  }
  return supabase;
}

export function toNumber(value) {
  return Number(value || 0);
}

export function shortReference(row) {
  if (!row) return "BT-UNKNOWN";
  return row.reference || `BT-${String(row.id).slice(0, 8).toUpperCase()}`;
}

export function formatPaymentMethod(value) {
  const labels = {
    bank: "Bank",
    cash: "Cash",
    credit: "Credit",
    momo: "MoMo",
  };

  return labels[value] || "Sale";
}

export async function loadCustomerNames(client, businessId, rows) {
  const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
  if (!customerIds.length) return new Map();

  const { data, error } = await client
    .from("customers")
    .select("id, name")
    .eq("business_id", businessId)
    .in("id", customerIds);

  if (error) throw error;

  return new Map(data.map((customer) => [customer.id, customer.name]));
}

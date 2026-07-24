import { supabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
  }

  return supabase;
}

export function toCustomer(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone || "",
    email: row.email || "",
    notes: row.notes || "",
  };
}

export async function listCustomers(businessId) {
  const { data, error } = await requireSupabase()
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .order("name");

  if (error) throw error;
  return data.map(toCustomer);
}

export async function createCustomer(businessId, { name, phone = "", email = "", notes = "" }) {
  const { data, error } = await requireSupabase()
    .from("customers")
    .insert([
      { business_id: businessId, name: (name || "").trim(), phone: (phone || "").trim(), email: (email || "").trim(), notes: (notes || "").trim() },
    ])
    .select()
    .single();

  if (error) throw error;
  return toCustomer(data);
}

export async function payCustomerDebt(businessId, customerId, amount, paymentMethod = "cash") {
  const { data, error } = await requireSupabase().rpc("pay_debt", {
    p_business_id: businessId,
    p_customer_id: customerId,
    p_amount: Number(amount),
    p_payment_method: (paymentMethod || "cash").toLowerCase(),
  });

  if (error) throw error;
  return data;
}

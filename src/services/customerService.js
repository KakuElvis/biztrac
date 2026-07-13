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

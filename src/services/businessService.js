import { supabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
  }

  return supabase;
}

function toBusiness(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || "",
    email: row.email || "",
    location: row.location || "",
    logo_url: row.logo_url || "",
    currency: row.currency || "GHS",
  };
}

function toBusinessRow(business) {
  return {
    name: business.name.trim(),
    phone: business.phone.trim() || null,
    email: business.email.trim() || null,
    location: business.location.trim() || null,
  };
}

export async function updateBusiness(businessId, business) {
  const row = toBusinessRow(business);
  if (!row.name) throw new Error("Business name is required.");

  const { data, error } = await requireSupabase()
    .from("businesses")
    .update(row)
    .eq("id", businessId)
    .select("id, name, phone, email, location, logo_url, currency")
    .single();

  if (error) throw error;
  return toBusiness(data);
}

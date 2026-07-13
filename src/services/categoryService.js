import { supabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
  }

  return supabase;
}

function toCategory(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
  };
}

export async function listCategories(businessId) {
  const { data, error } = await requireSupabase()
    .from("product_categories")
    .select("*")
    .eq("business_id", businessId)
    .order("name");

  if (error) throw error;
  return data.map(toCategory);
}

export async function createCategory(businessId, name) {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Category name is required.");

  const { data, error } = await requireSupabase()
    .from("product_categories")
    .insert({ business_id: businessId, name: trimmedName })
    .select()
    .single();

  if (error?.code === "23505") {
    throw new Error("This category already exists.");
  }

  if (error) throw error;
  return toCategory(data);
}

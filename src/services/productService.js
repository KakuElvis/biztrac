import { supabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
  }

  return supabase;
}

function toProduct(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    category: row.category || "",
    sku: row.sku || "",
    costPrice: Number(row.cost_price),
    sellingPrice: Number(row.selling_price),
    quantity: row.quantity,
    lowStockLimit: row.low_stock_limit,
    supplier: row.supplier || "",
    size: row.size || "",
    colour: row.colour || "",
    brand: row.brand || "",
    itemType: row.item_type || "",
  };
}

function toProductRow(product) {
  return {
    name: product.name.trim(),
    category: product.category.trim() || null,
    sku: product.sku.trim() || null,
    cost_price: product.costPrice,
    selling_price: product.sellingPrice,
    quantity: product.quantity,
    low_stock_limit: product.lowStockLimit,
    supplier: product.supplier.trim() || null,
    size: product.size.trim() || null,
    colour: product.colour.trim() || null,
    brand: product.brand.trim() || null,
    item_type: product.itemType.trim() || null,
  };
}

export async function listProducts(businessId) {
  const { data, error } = await requireSupabase()
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .order("name");

  if (error) throw error;
  return data.map(toProduct);
}

export async function createProduct(businessId, product) {
  const { data, error } = await requireSupabase()
    .from("products")
    .insert({ business_id: businessId, ...toProductRow(product) })
    .select()
    .single();

  if (error) throw error;
  return toProduct(data);
}

export async function updateProduct(businessId, productId, product) {
  const { data, error } = await requireSupabase()
    .from("products")
    .update(toProductRow(product))
    .eq("business_id", businessId)
    .eq("id", productId)
    .select()
    .single();

  if (error) throw error;
  return toProduct(data);
}

export async function deleteProduct(businessId, productId) {
  const { error } = await requireSupabase()
    .from("products")
    .delete()
    .eq("business_id", businessId)
    .eq("id", productId);

  if (error) throw error;
}

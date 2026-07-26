import { supabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
  }

  return supabase;
}

export function toProduct(row) {
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

export async function listProducts(businessId, options = {}) {
  const { page, pageSize, search, category } = options;

  let query = requireSupabase()
    .from("products")
    .select("*", { count: "exact" })
    .eq("business_id", businessId);

  if (category && category.trim()) {
    query = query.eq("category", category.trim());
  }

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(`name.ilike.${s},sku.ilike.${s},brand.ilike.${s}`);
  }

  query = query.order("name");

  if (typeof page === "number" && typeof pageSize === "number" && page > 0 && pageSize > 0) {
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;
    query = query.range(from, to);
  }

  const { data, count, error } = await query;

  if (error) throw error;
  const products = (data || []).map(toProduct);

  if (page && pageSize) {
    return {
      data: products,
      totalCount: count ?? products.length,
    };
  }

  return products;
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

export async function restockProduct(businessId, productId, restockData) {
  const { quantityAdded, newCostPrice, newSellingPrice, supplierName = "", notes = "" } = restockData;

  const { data, error } = await requireSupabase().rpc("restock_product", {
    p_business_id: businessId,
    p_product_id: productId,
    p_quantity_added: Number(quantityAdded),
    p_new_cost_price: Number(newCostPrice),
    p_new_selling_price: Number(newSellingPrice),
    p_supplier_name: (supplierName || "").trim(),
    p_notes: (notes || "").trim(),
  });

  if (error) throw error;
  return data;
}

export async function listProductRestocks(businessId, productId) {
  const { data, error } = await requireSupabase()
    .from("product_restocks")
    .select("*")
    .eq("business_id", businessId)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    productId: row.product_id,
    quantityAdded: row.quantity_added,
    previousQuantity: row.previous_quantity,
    newQuantity: row.new_quantity,
    oldCostPrice: Number(row.old_cost_price),
    newCostPrice: Number(row.new_cost_price),
    oldSellingPrice: Number(row.old_selling_price),
    newSellingPrice: Number(row.new_selling_price),
    supplierName: row.supplier_name || "",
    notes: row.notes || "",
    createdAt: row.created_at,
  }));
}

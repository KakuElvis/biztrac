import { supabase } from "../lib/supabase.js";
import { getActiveStaffSession, getStaffSessionToken } from "./staffService.js";

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
    // Missing cost means the caller is not authorized to see it (or the
    // manager is offline), so preserve that state instead of implying zero.
    costPrice: row.cost_price == null ? null : Number(row.cost_price),
    sellingPrice: Number(row.selling_price),
    quantity: row.quantity,
    lowStockLimit: row.low_stock_limit,
    supplier: row.supplier || "",
    size: row.size || "",
    colour: row.colour || "",
    brand: row.brand || "",
    itemType: row.item_type || "",
    taxTreatment: row.tax_treatment || "standard",
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
    tax_treatment: product.taxTreatment || "standard",
  };
}

export async function listProducts(businessId, options = {}) {
  const { page, pageSize, search, category, omitCostPrice } = options;
  const isCashier = Boolean(omitCostPrice || getActiveStaffSession()?.user?.isStaff);
  const client = requireSupabase();

  // If cashier session, fetch catalog using secure RPC list_counter_products (omitting wholesale cost_price)
  if (isCashier) {
    const sessionStaffId = getActiveStaffSession()?.user?.id || null;
    const validStaffId = sessionStaffId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionStaffId)
      ? sessionStaffId
      : null;

    try {
      const { data: counterData, error: rpcErr } = await client.rpc("list_counter_products", {
        p_business_id: businessId,
        p_category: category?.trim() || null,
        p_search: search?.trim() || null,
        p_session_token: getStaffSessionToken(),
        p_staff_account_id: validStaffId,
      });

      if (!rpcErr && Array.isArray(counterData)) {
        let list = counterData.map(toProduct);
        const totalCount = list.length;
        if (typeof page === "number" && typeof pageSize === "number" && page > 0 && pageSize > 0) {
          const from = (page - 1) * pageSize;
          list = list.slice(from, from + pageSize);
          return { data: list, totalCount };
        }
        return list;
      }
    } catch {
      // Fall through to safe column-limited member query.
    }
  }

  if (!isCashier) {
    const offset = page && pageSize ? (page - 1) * pageSize : 0;
    const limit = page && pageSize ? pageSize : 5000;
    const { data: managerData, error: managerError } = await client.rpc("list_manager_products", {
      p_business_id: businessId,
      p_product_id: null,
      p_category: category?.trim() || null,
      p_search: search?.trim() || null,
      p_offset: offset,
      p_limit: limit,
    });
    if (!managerError && Array.isArray(managerData)) {
      const countQuery = client.from("products").select("id", { count: "exact", head: true }).eq("business_id", businessId);
      if (category?.trim()) countQuery.eq("category", category.trim());
      if (search?.trim()) {
        const q = `%${search.trim()}%`;
        countQuery.or(`name.ilike.${q},sku.ilike.${q},brand.ilike.${q}`);
      }
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      const rows = managerData.map(toProduct);
      return page && pageSize ? { data: rows, totalCount: count ?? rows.length } : rows;
    }
    if (managerError && managerError.code !== "42501") throw managerError;
  }

  const selectColumns = isCashier
    ? "id, business_id, name, category, sku, selling_price, quantity, low_stock_limit, supplier, size, colour, brand, item_type, tax_treatment"
    : "id, business_id, name, category, sku, selling_price, quantity, low_stock_limit, supplier, size, colour, brand, item_type, tax_treatment";

  let query = client
    .from("products")
    .select(selectColumns, { count: "exact" })
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
  const { data, error } = await requireSupabase().rpc("save_manager_product", {
    p_business_id: businessId,
    p_product: toProductRow(product),
  });
  if (error) throw error;
  return toProduct(data);
}

export async function updateProduct(businessId, productId, product) {
  const { data, error } = await requireSupabase().rpc("save_manager_product", {
    p_business_id: businessId,
    p_product_id: productId,
    p_product: toProductRow(product),
  });
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
  const {
    quantityAdded,
    newCostPrice,
    newSellingPrice,
    supplierName = "",
    notes = "",
    costMethod = "avco",
  } = restockData;
  const normCostMethod = (costMethod || "avco").toLowerCase();
  const { data, error } = await requireSupabase().rpc("restock_product", {
    p_business_id: businessId,
    p_product_id: productId,
    p_quantity_added: Number(quantityAdded),
    p_new_cost_price: Number(newCostPrice),
    p_new_selling_price: Number(newSellingPrice),
    p_supplier_name: (supplierName || "").trim(),
    p_notes: (notes || "").trim(),
    p_cost_method: normCostMethod,
  });

  if (error) {
    if (error.code === "PGRST202" || error.message?.includes("restock_product")) {
      const client = requireSupabase();
      const { data: currentProduct, error: fetchErr } = await client
        .from("products")
        .select("quantity, cost_price, selling_price")
        .eq("id", productId)
        .eq("business_id", businessId)
        .single();

      if (fetchErr) throw fetchErr;

      const prevQty = Number(currentProduct.quantity || 0);
      const prevCost = Number(currentProduct.cost_price || 0);
      const addQty = Number(quantityAdded);
      const incomingCost = Number(newCostPrice);
      const newQty = prevQty + addQty;

      let finalCost = incomingCost;
      if (normCostMethod === "avco") {
        if (newQty > 0) {
          finalCost = Math.round(((prevQty * prevCost + addQty * incomingCost) / newQty) * 100) / 100;
        }
      }

      const finalSelling = !isNaN(Number(newSellingPrice)) && Number(newSellingPrice) > 0
        ? Number(newSellingPrice)
        : currentProduct.selling_price;

      await client
        .from("products")
        .update({
          quantity: newQty,
          cost_price: finalCost,
          selling_price: finalSelling,
        })
        .eq("id", productId)
        .eq("business_id", businessId);

      await client.from("product_restocks").insert({
        business_id: businessId,
        product_id: productId,
        quantity_added: addQty,
        previous_quantity: prevQty,
        new_quantity: newQty,
        old_cost_price: prevCost,
        new_cost_price: incomingCost,
        old_selling_price: currentProduct.selling_price,
        new_selling_price: finalSelling,
        supplier_name: (supplierName || "").trim() || null,
        notes: (notes || "").trim() || null,
      });

      return {
        product_id: productId,
        previous_quantity: prevQty,
        new_quantity: newQty,
        cost_price: finalCost,
        selling_price: finalSelling,
        cost_method: normCostMethod,
      };
    }
    throw error;
  }
  return data;
}

export async function listProductRestocks(businessId, productId) {
  const { data, error } = await requireSupabase().rpc("list_manager_product_restocks", {
    p_business_id: businessId,
    p_product_id: productId,
  });

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

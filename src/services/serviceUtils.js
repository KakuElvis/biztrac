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

export async function fetchAllPages(buildQuery, pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return { data: rows, error: null };
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

/**
 * Batches sale_items queries into chunks of at most 100 IDs to prevent
 * PostgREST HTTP 414 Request-URI Too Large errors on high-volume stores.
 */
export async function fetchSaleItemsInChunks(client, saleIds, selectFields = "*") {
  if (!Array.isArray(saleIds) || !saleIds.length) return [];
  const CHUNK_SIZE = 100;
  const chunks = [];
  for (let i = 0; i < saleIds.length; i += CHUNK_SIZE) {
    chunks.push(saleIds.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      client.from("sale_items").select(selectFields).in("sale_id", chunk)
    )
  );

  const allItems = [];
  for (const res of results) {
    if (res.error) throw res.error;
    if (Array.isArray(res.data)) allItems.push(...res.data);
  }
  return allItems;
}

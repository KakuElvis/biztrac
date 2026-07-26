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
  const client = requireSupabase();
  const [{ data: customers, error: custError }, { data: balances }] =
    await Promise.all([
      client.from("customers").select("*").eq("business_id", businessId).order("name"),
      client.from("customer_balances").select("*").eq("business_id", businessId),
    ]);

  if (custError) throw custError;

  const balanceMap = new Map(
    (balances || []).map((b) => [b.customer_id, Number(b.total_debt || 0)])
  );

  return (customers || []).map((c) => ({
    ...toCustomer(c),
    debt: balanceMap.get(c.id) || 0,
  }));
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

export async function updateCustomer(businessId, customerId, { name, phone = "", email = "", notes = "" }) {
  const { data, error } = await requireSupabase()
    .from("customers")
    .update({
      name: (name || "").trim(),
      phone: (phone || "").trim(),
      email: (email || "").trim(),
      notes: (notes || "").trim(),
    })
    .eq("id", customerId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) throw error;
  return toCustomer(data);
}

export async function getCustomerDetails(businessId, customerId) {
  const client = requireSupabase();
  const [{ data: customer, error: custError }, { data: sales, error: salesError }, { data: balance }] =
    await Promise.all([
      client.from("customers").select("*").eq("id", customerId).eq("business_id", businessId).single(),
      client.from("sales").select("*, sale_items(*)").eq("customer_id", customerId).eq("business_id", businessId).order("created_at", { ascending: false }),
      client.from("customer_balances").select("*").eq("customer_id", customerId).eq("business_id", businessId).maybeSingle(),
    ]);

  if (custError) throw custError;
  if (salesError) throw salesError;

  const purchases = (sales || []).map((s) => ({
    id: s.id,
    date: s.created_at,
    total: Number(s.total || 0),
    amountPaid: Number(s.amount_paid ?? s.total ?? 0),
    paymentMethod: s.payment_method || "cash",
    dueDate: s.due_date || null,
    itemsCount: Array.isArray(s.sale_items) ? s.sale_items.length : 0,
    items: (s.sale_items || []).map((item) => ({
      name: item.name || item.product_name || "Item",
      quantity: item.quantity,
      price: item.price,
    })),
  }));

  const totalOrders = purchases.length;
  const lifetimeSpend = purchases.reduce((sum, p) => sum + p.total, 0);
  const activeDebt = Number(balance?.total_debt || 0);

  return {
    customer: {
      ...toCustomer(customer),
      debt: activeDebt,
    },
    metrics: {
      totalOrders,
      lifetimeSpend,
      activeDebt,
    },
    purchases,
  };
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

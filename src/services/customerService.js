import { supabase } from "../lib/supabase.js";
import { getActiveStaffSession, getStaffSessionToken } from "./staffService.js";

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
  if (getActiveStaffSession()?.user?.isStaff) {
    const { data, error } = await client.rpc("list_counter_customers", {
      p_business_id: businessId,
      p_session_token: getStaffSessionToken(),
    });
    if (error) throw error;
    return (data || []).map((row) => ({ ...toCustomer(row), debt: Number(row.debt || 0) }));
  }
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
  if (getActiveStaffSession()?.user?.isStaff) {
    const { data, error } = await requireSupabase().rpc("save_counter_customer", {
      p_business_id: businessId,
      p_name: (name || "").trim(),
      p_phone: (phone || "").trim(),
      p_email: (email || "").trim(),
      p_notes: (notes || "").trim(),
      p_session_token: getStaffSessionToken(),
    });
    if (error) throw error;
    return toCustomer(data);
  }
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
  if (getActiveStaffSession()?.user?.isStaff) {
    const { data, error } = await requireSupabase().rpc("save_counter_customer", {
      p_business_id: businessId,
      p_customer_id: customerId,
      p_name: (name || "").trim(),
      p_phone: (phone || "").trim(),
      p_email: (email || "").trim(),
      p_notes: (notes || "").trim(),
      p_session_token: getStaffSessionToken(),
    });
    if (error) throw error;
    return toCustomer(data);
  }
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

export async function getCustomerDetails(businessId, customerId, { page = 1, pageSize = 25 } = {}) {
  const client = requireSupabase();
  const from = (Math.max(1, page) - 1) * pageSize;
  if (getActiveStaffSession()?.user?.isStaff) {
    const { data, error } = await client.rpc("get_counter_customer_details", {
      p_business_id: businessId,
      p_customer_id: customerId,
      p_session_token: getStaffSessionToken(),
      p_limit: pageSize,
      p_offset: from,
    });
    if (error) throw error;
    const purchases = (data?.purchases || []).map((sale) => ({
      id: sale.id,
      date: sale.created_at,
      total: Number(sale.total || 0),
      amountPaid: Number(sale.amount_paid ?? sale.total ?? 0),
      paymentMethod: sale.payment_method || "cash",
      dueDate: sale.due_date || null,
      itemsCount: Array.isArray(sale.sale_items) ? sale.sale_items.length : 0,
      items: (sale.sale_items || []).map((item) => ({
        name: item.product_name || "Item",
        quantity: item.quantity,
        price: item.unit_price ?? 0,
      })),
    }));
    return {
      customer: { ...toCustomer(data.customer), debt: Number(data.metrics?.active_debt || 0) },
      metrics: {
        totalOrders: Number(data.total_orders || 0),
        lifetimeSpend: Number(data.metrics?.lifetime_spend || 0),
        activeDebt: Number(data.metrics?.active_debt || 0),
        page: Math.max(1, page),
        pageSize,
        hasMore: from + purchases.length < Number(data.total_orders || 0),
      },
      purchases,
    };
  }
  const [{ data: customer, error: custError }, { data: sales, error: salesError, count: totalOrders }, { data: balance }, { data: metricsData, error: metricsError }] =
    await Promise.all([
      client.from("customers").select("*").eq("id", customerId).eq("business_id", businessId).single(),
      client.from("sales").select("*, sale_items(id, product_name, quantity, unit_price, line_total)", { count: "exact" }).eq("customer_id", customerId).eq("business_id", businessId).order("created_at", { ascending: false }).range(from, from + pageSize - 1),
      client.from("customer_balances").select("*").eq("customer_id", customerId).eq("business_id", businessId).maybeSingle(),
      client.rpc("get_customer_metrics", {
        p_business_id: businessId,
        p_customer_id: customerId,
        p_session_token: getStaffSessionToken(),
      }),
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
      price: item.unit_price ?? item.price ?? 0,
    })),
  }));

  const lifetimeSpend = !metricsError && metricsData
    ? Number(metricsData.lifetime_spend || 0)
    : purchases.reduce((sum, p) => sum + p.total, 0);

  const activeDebt = !metricsError && metricsData && metricsData.active_debt !== undefined
    ? Number(metricsData.active_debt)
    : Number(balance?.total_debt || 0);

  return {
    customer: {
      ...toCustomer(customer),
      debt: activeDebt,
    },
    metrics: {
      totalOrders: totalOrders || (metricsData?.total_orders ?? purchases.length),
      lifetimeSpend,
      activeDebt,
      page: Math.max(1, page),
      pageSize,
      hasMore: from + purchases.length < (totalOrders || purchases.length),
    },
    purchases,
  };
}

export async function payCustomerDebt(businessId, customerId, amount, paymentMethod = "cash", staffAccountId = null) {
  const staffId = staffAccountId || getActiveStaffSession()?.user?.id || null;
  const validStaffId = staffId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId)
    ? staffId
    : null;

  const { data, error } = await requireSupabase().rpc("pay_debt", {
    p_business_id: businessId,
    p_customer_id: customerId,
    p_amount: Number(amount),
    p_payment_method: (paymentMethod || "cash").toLowerCase(),
    p_session_token: getStaffSessionToken(),
    p_staff_account_id: validStaffId,
  });

  if (error) throw error;
  return data;
}

export async function forgiveCustomerDebt(
  businessId,
  customerId,
  { saleId = null, reason = "Debt forgiven by business owner", status = "forgiven" } = {}
) {
  const { data, error } = await requireSupabase().rpc("forgive_customer_debt", {
    p_business_id: businessId,
    p_customer_id: customerId,
    p_sale_id: saleId,
    p_reason: reason,
    p_status: status,
  });

  if (error) throw error;
  return data;
}

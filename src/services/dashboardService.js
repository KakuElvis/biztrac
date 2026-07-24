import {
  debtors as demoDebtors,
  expenses as demoExpenses,
  products as demoProducts,
  sales as demoSales,
} from "../lib/mockData.js";
import {
  requireSupabase,
  toNumber,
  shortReference,
  formatPaymentMethod,
  loadCustomerNames,
} from "./serviceUtils.js";

export const emptyDashboardSummary = {
  todaySales: 0,
  todayItemCount: 0,
  totalExpenses: 0,
  expenseCount: 0,
  estimatedProfit: 0,
  totalDebtors: 0,
  debtorCount: 0,
  recentSales: [],
  debtors: [],
};

function getTodayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    dateKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(
      start.getDate()
    ).padStart(2, "0")}`,
  };
}

function formatSaleTime(value) {
  if (!value) return "";

  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function toRecentSale(row, customerNames) {
  return {
    id: shortReference(row),
    customer: customerNames.get(row.customer_id) || "Walk-in",
    payment: formatPaymentMethod(row.payment_method),
    amount: toNumber(row.total),
    time: formatSaleTime(row.sold_at),
  };
}

function toDebtor(row, customerNames) {
  return {
    id: row.id,
    name: customerNames.get(row.customer_id) || shortReference(row),
    amount: Math.max(toNumber(row.total) - toNumber(row.amount_paid), 0),
    due: formatSaleTime(row.sold_at),
  };
}

export function getDemoDashboardSummary(products = demoProducts) {
  const todaySales = demoSales.reduce((total, sale) => total + sale.amount, 0);
  const totalExpenses = demoExpenses.reduce((total, expense) => total + expense.amount, 0);
  const totalDebtors = demoDebtors.reduce((total, debtor) => total + debtor.amount, 0);
  const estimatedProfit =
    products.reduce(
      (total, product) =>
        total + (product.sellingPrice - product.costPrice) * (product.soldToday || 0),
      0
    ) - totalExpenses;

  return {
    ...emptyDashboardSummary,
    todaySales,
    todayItemCount: demoSales.reduce((total, sale) => total + sale.items, 0),
    totalExpenses,
    expenseCount: demoExpenses.length,
    estimatedProfit,
    totalDebtors,
    debtorCount: demoDebtors.length,
    recentSales: demoSales,
    debtors: demoDebtors,
  };
}

export async function getDashboardSummary(businessId) {
  const client = requireSupabase();
  const { startIso, endIso, dateKey } = getTodayBounds();

  const [todaySalesResult, expensesResult, recentSalesResult, debtorBalancesResult] =
    await Promise.all([
      client
        .from("sales")
        .select("id, reference, payment_method, customer_id, total, amount_paid, sold_at")
        .eq("business_id", businessId)
        .gte("sold_at", startIso)
        .lt("sold_at", endIso)
        .order("sold_at", { ascending: false }),
      client
        .from("expenses")
        .select("id, amount")
        .eq("business_id", businessId)
        .eq("incurred_on", dateKey),
      client
        .from("sales")
        .select("id, reference, payment_method, customer_id, total, amount_paid, sold_at")
        .eq("business_id", businessId)
        .order("sold_at", { ascending: false })
        .limit(5),
      client
        .from("customer_balances")
        .select("customer_id, customer_name, total_debt, latest_sale_at")
        .eq("business_id", businessId)
        .order("latest_sale_at", { ascending: false }),
    ]);

  if (todaySalesResult.error) throw todaySalesResult.error;
  if (expensesResult.error) throw expensesResult.error;
  if (recentSalesResult.error) throw recentSalesResult.error;

  const todaySaleIds = todaySalesResult.data.map((sale) => sale.id);
  const saleItemsResult = todaySaleIds.length
    ? await client
        .from("sale_items")
        .select("sale_id, quantity, unit_cost, line_total")
        .in("sale_id", todaySaleIds)
    : { data: [], error: null };

  if (saleItemsResult.error) throw saleItemsResult.error;

  const customerNames = await loadCustomerNames(client, businessId, recentSalesResult.data);

  let debtors = [];
  let totalDebtors = 0;
  let debtorCount = 0;

  if (!debtorBalancesResult.error && debtorBalancesResult.data) {
    const balances = debtorBalancesResult.data;
    totalDebtors = balances.reduce((sum, item) => sum + toNumber(item.total_debt), 0);
    debtorCount = balances.length;
    debtors = balances.slice(0, 5).map((item) => ({
      id: item.customer_id,
      name: item.customer_name || "Customer",
      amount: toNumber(item.total_debt),
      due: formatSaleTime(item.latest_sale_at),
    }));
  } else {
    // Fallback if view doesn't exist yet on older schema
    const fallbackDebtorSales = await client
      .from("sales")
      .select("id, reference, customer_id, total, amount_paid, sold_at")
      .eq("business_id", businessId)
      .order("sold_at", { ascending: false })
      .limit(50);

    if (!fallbackDebtorSales.error && fallbackDebtorSales.data) {
      const fallbackNames = await loadCustomerNames(client, businessId, fallbackDebtorSales.data);
      const allDebtors = fallbackDebtorSales.data
        .map((sale) => toDebtor(sale, fallbackNames))
        .filter((d) => d.amount > 0);
      totalDebtors = allDebtors.reduce((sum, d) => sum + d.amount, 0);
      debtorCount = allDebtors.length;
      debtors = allDebtors.slice(0, 5);
    }
  }

  const totalExpenses = expensesResult.data.reduce(
    (total, expense) => total + toNumber(expense.amount),
    0
  );
  const estimatedGrossProfit = saleItemsResult.data.reduce(
    (total, item) => total + toNumber(item.line_total) - toNumber(item.unit_cost) * item.quantity,
    0
  );

  return {
    todaySales: todaySalesResult.data.reduce((total, sale) => total + toNumber(sale.total), 0),
    todayItemCount: saleItemsResult.data.reduce((total, item) => total + item.quantity, 0),
    totalExpenses,
    expenseCount: expensesResult.data.length,
    estimatedProfit: estimatedGrossProfit - totalExpenses,
    totalDebtors,
    debtorCount,
    recentSales: recentSalesResult.data.map((sale) => toRecentSale(sale, customerNames)),
    debtors,
  };
}

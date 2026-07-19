import { supabase } from "../lib/supabase.js";
import { debtors as demoDebtors, reportSeries as demoReportSeries } from "../lib/mockData.js";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
  }

  return supabase;
}

function toNumber(value) {
  return Number(value || 0);
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function createSeries(startDate, endDate) {
  const days = [];
  const current = new Date(startDate);

  while (current < endDate) {
    const date = new Date(current);
    days.push({
      key: getDateKey(date),
      day: new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date),
      date,
      sales: 0,
      expenses: 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function dateKeyForDate(date) {
  const nextDay = new Date(date);
  nextDay.setHours(0, 0, 0, 0);
  return getDateKey(nextDay);
}

function getDateRangeBounds(range, startDate, endDate) {
  const now = new Date();
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);

  let start;
  if (range === "monthly") {
    start = new Date(end);
    start.setDate(1);
  } else if (range === "yearly") {
    start = new Date(end);
    start.setMonth(0, 1);
  } else if (range === "custom" && startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const endInclusive = new Date(endDate);
    endInclusive.setHours(0, 0, 0, 0);
    endInclusive.setDate(endInclusive.getDate() + 1);
    end.setTime(endInclusive.getTime());
  } else {
    start = new Date(end);
    start.setDate(start.getDate() - 6);
  }

  if (start > end) {
    start = new Date(end);
    start.setDate(end.getDate() - 6);
  }

  const days = createSeries(start, end);
  const lastDay = new Date(end);
  lastDay.setDate(lastDay.getDate() - 1);

  return {
    start,
    end,
    seriesDays: days,
    startDateKey: getDateKey(start),
    endDateKey: getDateKey(lastDay),
  };
}

function formatSaleDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function shortReference(row) {
  return row.reference || `BT-${String(row.id).slice(0, 8).toUpperCase()}`;
}

function toDebtor(row, customerNames) {
  return {
    id: row.id,
    name: customerNames.get(row.customer_id) || shortReference(row),
    amount: Math.max(toNumber(row.total) - toNumber(row.amount_paid), 0),
    due: formatSaleDate(row.sold_at),
  };
}

async function loadCustomerNames(client, businessId, rows) {
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

function summarizeBestSellers(items) {
  const grouped = new Map();

  items.forEach((item) => {
    const key = item.product_id || item.product_name;
    const current = grouped.get(key) || {
      id: key,
      name: item.product_name,
      quantity: 0,
      amount: 0,
    };

    current.quantity += item.quantity;
    current.amount += toNumber(item.line_total);
    grouped.set(key, current);
  });

  return [...grouped.values()]
    .sort((a, b) => b.quantity - a.quantity || b.amount - a.amount)
    .slice(0, 3);
}

function getLastSevenDays() {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return createSeries(start, end);
}

export const emptyReportSummary = {
  series: getLastSevenDays().map(({ day, sales, expenses }) => ({ day, sales, expenses })),
  salesTotal: 0,
  expenseTotal: 0,
  profitTotal: 0,
  bestSellers: [],
  debtors: [],
};

export function getDemoReportSummary(products = []) {
  const salesTotal = demoReportSeries.reduce((sum, point) => sum + point.sales, 0);
  const expenseTotal = demoReportSeries.reduce((sum, point) => sum + point.expenses, 0);
  const bestSellers = [...products]
    .filter((product) => product.soldToday)
    .sort((a, b) => b.soldToday - a.soldToday)
    .slice(0, 3)
    .map((product) => ({
      id: product.id,
      name: product.name,
      quantity: product.soldToday,
      amount: product.sellingPrice * product.soldToday,
    }));

  return {
    series: demoReportSeries,
    salesTotal,
    expenseTotal,
    profitTotal: salesTotal - expenseTotal,
    bestSellers,
    debtors: demoDebtors,
  };
}

export async function getReportSummary(businessId, { range = "weekly", startDate, endDate } = {}) {
  const client = requireSupabase();
  const { start, end, seriesDays, startDateKey, endDateKey } = getDateRangeBounds(
    range,
    startDate,
    endDate
  );
  const seriesByDate = new Map(
    seriesDays.map(({ key, day, sales, expenses }) => [key, { day, sales, expenses }])
  );

  const [salesResult, expensesResult, debtorSalesResult] = await Promise.all([
    client
      .from("sales")
      .select("id, reference, customer_id, total, amount_paid, sold_at")
      .eq("business_id", businessId)
      .gte("sold_at", start.toISOString())
      .lt("sold_at", end.toISOString()),
    client
      .from("expenses")
      .select("amount, incurred_on")
      .eq("business_id", businessId)
      .gte("incurred_on", startDateKey)
      .lte("incurred_on", endDateKey),
    client
      .from("sales")
      .select("id, reference, customer_id, total, amount_paid, sold_at")
      .eq("business_id", businessId)
      .order("sold_at", { ascending: false })
      .limit(50),
  ]);

  if (salesResult.error) throw salesResult.error;
  if (expensesResult.error) throw expensesResult.error;
  if (debtorSalesResult.error) throw debtorSalesResult.error;

  salesResult.data.forEach((sale) => {
    const point = seriesByDate.get(getDateKey(new Date(sale.sold_at)));
    if (point) point.sales += toNumber(sale.total);
  });

  expensesResult.data.forEach((expense) => {
    const point = seriesByDate.get(expense.incurred_on);
    if (point) point.expenses += toNumber(expense.amount);
  });

  const saleIds = salesResult.data.map((sale) => sale.id);
  const saleItemsResult = saleIds.length
    ? await client
        .from("sale_items")
        .select("product_id, product_name, quantity, line_total")
        .in("sale_id", saleIds)
    : { data: [], error: null };

  if (saleItemsResult.error) throw saleItemsResult.error;

  const customerNames = await loadCustomerNames(client, businessId, debtorSalesResult.data);
  const debtors = debtorSalesResult.data
    .map((sale) => toDebtor(sale, customerNames))
    .filter((debtor) => debtor.amount > 0)
    .slice(0, 5);
  const series = [...seriesByDate.values()];
  const salesTotal = series.reduce((sum, point) => sum + point.sales, 0);
  const expenseTotal = series.reduce((sum, point) => sum + point.expenses, 0);

  return {
    period: range,
    startDate: getDateKey(start),
    endDate: getDateKey(new Date(end.getTime() - 1)),
    series,
    salesTotal,
    expenseTotal,
    profitTotal: salesTotal - expenseTotal,
    bestSellers: summarizeBestSellers(saleItemsResult.data),
    debtors,
  };
}

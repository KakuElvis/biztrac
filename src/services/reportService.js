import { debtors as demoDebtors, reportSeries as demoReportSeries } from "../lib/mockData.js";
import {
  requireSupabase,
  toNumber,
  shortReference,
  loadCustomerNames,
} from "./serviceUtils.js";

function getDateKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

function createSeries(startDate, endDate) {
  const days = [];
  const current = new Date(startDate.getTime());

  while (current < endDate) {
    const date = new Date(current.getTime());
    days.push({
      key: getDateKey(date),
      day: new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date),
      date,
      sales: 0,
      expenses: 0,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

function getDateRangeBounds(range, startDate, endDate) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);

  let start;
  if (range === "monthly") {
    start = new Date(end.getTime());
    start.setUTCDate(1);
  } else if (range === "yearly") {
    start = new Date(end.getTime());
    start.setUTCMonth(0, 1);
  } else if (range === "custom" && startDate && endDate) {
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    start = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));

    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const endInclusive = new Date(Date.UTC(endYear, endMonth - 1, endDay, 0, 0, 0, 0));
    endInclusive.setUTCDate(endInclusive.getUTCDate() + 1);
    end.setTime(endInclusive.getTime());
  } else {
    start = new Date(end.getTime());
    start.setUTCDate(start.getUTCDate() - 6);
  }

  if (start > end) {
    start = new Date(end.getTime());
    start.setUTCDate(end.getUTCDate() - 6);
  }

  const days = createSeries(start, end);
  const lastDay = new Date(end.getTime());
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);

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
    timeZone: "UTC",
  }).format(new Date(value));
}

function toDebtor(row, customerNames) {
  return {
    id: row.id,
    name: customerNames.get(row.customer_id) || shortReference(row),
    amount: Math.max(toNumber(row.total) - toNumber(row.amount_paid), 0),
    due: formatSaleDate(row.sold_at),
  };
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
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end.getTime());
  start.setUTCDate(start.getUTCDate() - 7);
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

  const [salesResult, expensesResult, debtorBalancesResult] = await Promise.all([
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
      .from("customer_balances")
      .select("customer_id, customer_name, total_debt, latest_sale_at")
      .eq("business_id", businessId)
      .order("latest_sale_at", { ascending: false }),
  ]);

  if (salesResult.error) throw salesResult.error;
  if (expensesResult.error) throw expensesResult.error;

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

  let debtors = [];
  if (!debtorBalancesResult.error && debtorBalancesResult.data) {
    debtors = debtorBalancesResult.data.slice(0, 5).map((item) => ({
      id: item.customer_id,
      name: item.customer_name || "Customer",
      amount: toNumber(item.total_debt),
      due: formatSaleDate(item.latest_sale_at),
    }));
  } else {
    const fallbackDebtorSales = await client
      .from("sales")
      .select("id, reference, customer_id, total, amount_paid, sold_at")
      .eq("business_id", businessId)
      .order("sold_at", { ascending: false })
      .limit(50);
    if (!fallbackDebtorSales.error && fallbackDebtorSales.data) {
      const fallbackNames = await loadCustomerNames(client, businessId, fallbackDebtorSales.data);
      debtors = fallbackDebtorSales.data
        .map((sale) => toDebtor(sale, fallbackNames))
        .filter((debtor) => debtor.amount > 0)
        .slice(0, 5);
    }
  }

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

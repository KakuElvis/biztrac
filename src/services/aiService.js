import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { formatCurrency } from "../lib/formatters.js";

/**
 * Quick action starters with initial prompts
 */
export const STARTER_PROMPTS = [
  {
    id: "business-snapshot",
    title: "📊 Business Overview",
    subtitle: "Sales, profit & stock status at a glance",
    prompt: "How is my business doing overall today?",
    category: "overview",
  },
  {
    id: "top-products",
    title: "🔥 Top Selling Products",
    subtitle: "Identify your highest revenue items",
    prompt: "Which products sold the most this month?",
    category: "inventory",
  },
  {
    id: "low-stock",
    title: "📦 Low Stock Warning",
    subtitle: "Find items needing urgent reorder",
    prompt: "Which products are running low on stock right now?",
    category: "inventory",
  },
  {
    id: "debtor-summary",
    title: "👥 Debtor & Overdue Analysis",
    subtitle: "See who owes money and outstanding amounts",
    prompt: "Who owes me money and what is the total debt?",
    category: "debtors",
  },
  {
    id: "expense-analysis",
    title: "💰 Expense Breakdown",
    subtitle: "Review operational costs and categories",
    prompt: "What are my biggest expenses this month?",
    category: "expenses",
  },
];

/**
 * Main AI query service
 */
export async function askBizTracAI({
  message,
  conversationId,
  contextData = {}, // { products, sales, customers, expenses, business }
}) {
  // If Supabase edge function is online and configured, call edge function
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.functions.invoke("biztrac-ai", {
        body: {
          message,
          conversation_id: conversationId,
          business_id: contextData?.business?.id,
        },
      });

      if (!error && data?.success) {
        return data;
      }
    } catch (err) {
      console.warn("Supabase Edge Function unavailable, using intelligent local engine:", err);
    }
  }

  // Fallback / Local Client Engine for Demo & Offline Mode
  return generateClientAIResponse(message, contextData);
}

/**
 * Intelligent Client-Side AI Response Engine for local/demo mode
 */
function generateClientAIResponse(message, contextData = {}) {
  const query = (message || "").toLowerCase();
  const products = contextData.products || [];
  const customers = contextData.customers || [];
  const expenses = contextData.expenses || [];
  const business = contextData.business || { name: "Your Business" };

  // 1. LOW STOCK / REORDER QUERY
  if (query.includes("stock") || query.includes("reorder") || query.includes("inventory") || query.includes("quantity")) {
    const lowStockItems = products.filter((p) => Number(p.quantity) <= Number(p.lowStockLimit));
    const totalItems = products.length;

    if (lowStockItems.length === 0) {
      return {
        success: true,
        type: "inventory",
        message: `Great news! All **${totalItems}** products in **${business.name}** are currently well-stocked above their minimum threshold.`,
        facts: [
          `Total Products Monitored: ${totalItems}`,
          `Items at Low Stock Threshold: 0`,
        ],
        insights: [
          `Stock turnover is stable. No immediate replenishment orders are required today.`,
        ],
        recommendation: `Regularly check fast-selling inventory ahead of weekends to prevent unexpected stockouts.`,
        dataCards: [],
        suggestions: [
          "Show top selling products",
          "Analyze my expenses",
          "Check overall business summary",
        ],
      };
    }

    const urgentItems = lowStockItems.map((p) => ({
      name: p.name,
      current: p.quantity,
      limit: p.lowStockLimit,
      category: p.category || "General",
      costPrice: p.costPrice,
    }));

    return {
      success: true,
      type: "inventory",
      message: `Attention required: You have **${lowStockItems.length}** product${lowStockItems.length > 1 ? "s" : ""} running at or below reorder threshold in **${business.name}**.`,
      facts: [
        `Low Stock Count: ${lowStockItems.length} of ${totalItems} total products`,
        `Urgent Restock Priority: ${urgentItems[0]?.name || "N/A"} (${urgentItems[0]?.current} remaining)`,
      ],
      insights: [
        `If current sales velocity continues, items like **${urgentItems[0]?.name}** may run out within 3 to 5 days.`,
      ],
      recommendation: `Prioritize restocking **${urgentItems.slice(0, 2).map((i) => i.name).join(" and ")}** immediately to avoid losing sales.`,
      dataCards: urgentItems.map((item) => ({
        title: item.name,
        value: `${item.current} left`,
        subtitle: `Limit: ${item.limit} | Category: ${item.category}`,
        badge: item.current === 0 ? "OUT OF STOCK" : "LOW STOCK",
        badgeType: item.current === 0 ? "critical" : "warning",
      })),
      suggestions: [
        "How much would it cost to restock these items?",
        "Who owe me money?",
        "Show my sales overview",
      ],
    };
  }

  // 2. DEBTORS / OVERDUE DEBT QUERY
  if (query.includes("debt") || query.includes("owe") || query.includes("customer") || query.includes("balance") || query.includes("credit")) {
    const debtors = customers
      .map((c) => ({
        name: c.name,
        phone: c.phone || "No phone",
        debt: Number(c.totalDebt || c.balance || 0),
        unpaidSales: c.unpaidSalesCount || 1,
      }))
      .filter((c) => c.debt > 0)
      .sort((a, b) => b.debt - a.debt);

    const totalDebt = debtors.reduce((sum, d) => sum + d.debt, 0);

    if (debtors.length === 0) {
      return {
        success: true,
        type: "debtors",
        message: `Fantastic! No customers currently owe **${business.name}** outstanding debts.`,
        facts: [
          `Total Customer Debt: ${formatCurrency(0)}`,
          `Overdue Accounts: 0`,
        ],
        insights: [
          `Your cash flow is healthy with zero pending credit collections.`,
        ],
        recommendation: `Maintain your current strict credit terms for new custom orders.`,
        dataCards: [],
        suggestions: [
          "Check low stock items",
          "What are my sales today?",
          "Show expense breakdown",
        ],
      };
    }

    const topDebtor = debtors[0];

    return {
      success: true,
      type: "debtors",
      message: `You currently have **${debtors.length} customer${debtors.length > 1 ? "s" : ""}** with pending balances totaling **${formatCurrency(totalDebt)}**.`,
      facts: [
        `Total Outstanding Debt: ${formatCurrency(totalDebt)}`,
        `Largest Debtor: ${topDebtor.name} (${formatCurrency(topDebtor.debt)})`,
        `Total Debtor Count: ${debtors.length}`,
      ],
      insights: [
        `**${topDebtor.name}** represents **${Math.round((topDebtor.debt / totalDebt) * 100)}%** of all outstanding customer credit balances.`,
      ],
      recommendation: `Send a friendly payment reminder via SMS/Call to **${topDebtor.name}** (${topDebtor.phone}) to collect ${formatCurrency(topDebtor.debt)}.`,
      dataCards: debtors.slice(0, 4).map((d) => ({
        title: d.name,
        value: formatCurrency(d.debt),
        subtitle: `Phone: ${d.phone}`,
        badge: "PENDING DEBT",
        badgeType: "warning",
      })),
      suggestions: [
        "How can I improve debt recovery?",
        "Check my low stock items",
        "Show my sales analysis",
      ],
    };
  }

  // 3. EXPENSES QUERY
  if (query.includes("expense") || query.includes("cost") || query.includes("spending") || query.includes("outflow")) {
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const categoryTotals = {};
    expenses.forEach((e) => {
      const cat = e.category || "General";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount || 0);
    });

    const sortedCategories = Object.entries(categoryTotals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    const topCategory = sortedCategories[0] || { name: "None", amount: 0 };

    return {
      success: true,
      type: "expenses",
      message: `Total recorded business expenses are **${formatCurrency(totalExpenses)}** across **${sortedCategories.length}** spending categories.`,
      facts: [
        `Total Expenses: ${formatCurrency(totalExpenses)}`,
        `Top Expense Category: ${topCategory.name} (${formatCurrency(topCategory.amount)})`,
      ],
      insights: [
        topCategory.amount > 0
          ? `**${topCategory.name}** is your single largest expense area, taking up **${Math.round((topCategory.amount / (totalExpenses || 1)) * 100)}%** of spending.`
          : `Expenses are well controlled with no major cost spikes observed.`,
      ],
      recommendation: `Review recurring payments under **${topCategory.name}** to look for supplier negotiation or bulk purchasing savings.`,
      dataCards: sortedCategories.slice(0, 4).map((c) => ({
        title: c.name,
        value: formatCurrency(c.amount),
        subtitle: `${Math.round((c.amount / (totalExpenses || 1)) * 100)}% of total expenses`,
        badge: "EXPENSE",
        badgeType: "info",
      })),
      suggestions: [
        "Analyze my profit and sales",
        "Which products sold the most?",
        "Check debtor list",
      ],
    };
  }

  // 4. TOP PRODUCTS & SALES ANALYSIS
  if (query.includes("product") || query.includes("sell") || query.includes("best") || query.includes("top") || query.includes("revenue")) {
    const sortedProducts = [...products].sort((a, b) => (b.sellingPrice * b.quantity) - (a.sellingPrice * a.quantity));
    const topItem = sortedProducts[0] || { name: "N/A", sellingPrice: 0, quantity: 0 };
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.sellingPrice * p.quantity), 0);

    return {
      success: true,
      type: "sales",
      message: `Here is the current product performance for **${business.name}**.`,
      facts: [
        `Total Active Products: ${products.length}`,
        `Highest Value Product Line: ${topItem.name}`,
        `Estimated Stock Value: ${formatCurrency(totalInventoryValue)}`,
      ],
      insights: [
        `**${topItem.name}** is currently your premier product line at ${formatCurrency(topItem.sellingPrice)} per unit.`,
      ],
      recommendation: `Ensure high availability of top-selling items to maximize gross margins during peak shopping hours.`,
      dataCards: sortedProducts.slice(0, 4).map((p) => ({
        title: p.name,
        value: formatCurrency(p.sellingPrice),
        subtitle: `In Stock: ${p.quantity} units | Category: ${p.category || "General"}`,
        badge: "TOP PERFORMER",
        badgeType: "success",
      })),
      suggestions: [
        "Which products need restocking?",
        "Who owes me money?",
        "Give me an overall business summary",
      ],
    };
  }

  // 5. DEFAULT / OVERALL BUSINESS SNAPSHOT
  const totalStockCount = products.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
  const lowStockCount = products.filter((p) => Number(p.quantity) <= Number(p.lowStockLimit)).length;
  const debtorsCount = customers.filter((c) => Number(c.totalDebt || c.balance || 0) > 0).length;
  const totalDebt = customers.reduce((sum, c) => sum + Number(c.totalDebt || c.balance || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return {
    success: true,
    type: "overview",
    message: `Here is your high-level executive summary for **${business.name}**:`,
    facts: [
      `Active Products: ${products.length} (${totalStockCount} total units in stock)`,
      `Low Stock Alerts: ${lowStockCount} item${lowStockCount === 1 ? "" : "s"}`,
      `Outstanding Customer Debts: ${formatCurrency(totalDebt)} (${debtorsCount} customer${debtorsCount === 1 ? "" : "s"})`,
      `Total Recorded Expenses: ${formatCurrency(totalExpenses)}`,
    ],
    insights: [
      lowStockCount > 0
        ? `⚠️ You have **${lowStockCount}** item(s) running low that require attention.`
        : `✅ Inventory levels are healthy with zero immediate low stock warnings.`,
      debtorsCount > 0
        ? `⚠️ You have **${formatCurrency(totalDebt)}** locked up in unpaid customer debts.`
        : `✅ Cash flow is strong with no customer balances pending.`,
    ],
    recommendation: lowStockCount > 0
      ? `Prioritize checking your low stock inventory and sending payment reminders to outstanding debtors.`
      : `Focus on expanding your top-performing product categories to boost weekly sales velocity.`,
    dataCards: [
      {
        title: "Low Stock Alert",
        value: `${lowStockCount} Products`,
        subtitle: "Items below reorder limit",
        badge: lowStockCount > 0 ? "ACTION NEEDED" : "HEALTHY",
        badgeType: lowStockCount > 0 ? "warning" : "success",
      },
      {
        title: "Outstanding Debt",
        value: formatCurrency(totalDebt),
        subtitle: `${debtorsCount} Customers pending`,
        badge: totalDebt > 0 ? "COLLECT DEBT" : "CLEAN",
        badgeType: totalDebt > 0 ? "warning" : "success",
      },
      {
        title: "Total Expenses",
        value: formatCurrency(totalExpenses),
        subtitle: `${expenses.length} records logged`,
        badge: "OPERATIONAL",
        badgeType: "info",
      },
    ],
    suggestions: [
      "Check low stock items",
      "Who owes me the most money?",
      "Show expense breakdown",
    ],
  };
}

/**
 * Generate proactive AI insights for the Dashboard
 */
export function generateProactiveAIInsights(contextData = {}) {
  const products = contextData.products || [];
  const customers = contextData.customers || [];
  const expenses = contextData.expenses || [];

  const insights = [];

  // Low Stock Insight
  const lowStockItems = products.filter((p) => Number(p.quantity) <= Number(p.lowStockLimit));
  if (lowStockItems.length > 0) {
    const topUrgent = lowStockItems[0];
    insights.push({
      id: "insight-stock-1",
      type: "low_stock",
      severity: "warning",
      title: "📦 Stock Reorder Warning",
      description: `${lowStockItems.length} product${lowStockItems.length > 1 ? "s" : ""} (including "${topUrgent.name}") are below reorder limit and may run out soon.`,
      actionLabel: "Check Stock AI",
      actionPrompt: "Which products are running low on stock right now?",
    });
  }

  // Debtor Alert Insight
  const debtors = customers
    .map((c) => ({ name: c.name, debt: Number(c.totalDebt || c.balance || 0) }))
    .filter((c) => c.debt > 0)
    .sort((a, b) => b.debt - a.debt);

  if (debtors.length > 0) {
    const totalDebt = debtors.reduce((sum, d) => sum + d.debt, 0);
    const topDebtor = debtors[0];
    insights.push({
      id: "insight-debtor-1",
      type: "debtor_risk",
      severity: "critical",
      title: "👥 Outstanding Customer Debt",
      description: `You have ${formatCurrency(totalDebt)} pending across ${debtors.length} customers. ${topDebtor.name} owes the most (${formatCurrency(topDebtor.debt)}).`,
      actionLabel: "Analyze Debts",
      actionPrompt: "Who owes me money and what is the total debt?",
    });
  }

  // Expense Optimization Insight
  if (expenses.length > 0) {
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    insights.push({
      id: "insight-expense-1",
      type: "expense_trend",
      severity: "info",
      title: "💡 Expense Optimization",
      description: `Total logged operational expenses stand at ${formatCurrency(totalExpenses)}. Ask AI to see category breakdowns and saving opportunities.`,
      actionLabel: "Analyze Expenses",
      actionPrompt: "What are my biggest expenses this month?",
    });
  }

  // Default positive growth insight if no critical issues
  if (insights.length < 2) {
    insights.push({
      id: "insight-growth-1",
      type: "business_growth",
      severity: "info",
      title: "✨ Business Intelligence Ready",
      description: "BizTrac AI is analyzing your sales, stock turnover, and customer activity to help you make smarter decisions today.",
      actionLabel: "Ask BizTrac AI",
      actionPrompt: "How is my business doing overall today?",
    });
  }

  return insights;
}

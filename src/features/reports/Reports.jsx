import { useMemo, useState, useEffect } from "react";
import * as Recharts from "recharts";
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Building2,
  Calendar,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  FileDown,
  FileSpreadsheet,
  History,
  Info,
  Loader2,
  PackageCheck,
  PackagePlus,
  Search,
  ShoppingCart,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";
import { showToast } from "../../lib/toast.js";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { emptyReportSummary } from "../../services/reportService.js";
import { formatCurrency } from "../../lib/formatters.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildReportHtml(summary, business, periodLabel, startDate, endDate, lowStock) {
  const businessName = business?.name || "BizTrac Business";
  const appName = "BizTrac";
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(businessName)} report</title>
      <style>
        body { font-family: Inter, system-ui, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
        h1, h2, h3 { margin: 0; }
        .page { max-width: 900px; margin: auto; }
        .header { margin-bottom: 24px; }
        .summary-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
        .card { border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; }
        .section { margin-top: 24px; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
        .small { color: #475569; font-size: 0.95rem; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header" style="border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
            <div>
              <h1 style="font-size: 1.75rem; font-weight: 900; color: #022864; margin: 0;">${escapeHtml(businessName)}</h1>
              <p class="small" style="margin: 6px 0 0 0; color: #475569; font-weight: 500; font-size: 0.875rem;">
                ${business?.location ? `Location: ${escapeHtml(business.location)}` : ""}
                ${business?.phone ? `${business.location ? " | " : ""}Phone: ${escapeHtml(business.phone)}` : ""}
                ${business?.email ? `${(business.location || business.phone) ? " | " : ""}Email: ${escapeHtml(business.email)}` : ""}
              </p>
            </div>
            <div style="text-align: right; min-width: 180px;">
              <p class="small" style="margin: 0; font-weight: 700; color: #027AEC; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.8rem;">
                ${escapeHtml(periodLabel)} Performance Report
              </p>
              <p class="small" style="margin: 4px 0 0 0; font-size: 0.85rem; font-weight: 600;">
                ${escapeHtml(startDate || "-")} to ${escapeHtml(endDate || "-")}
              </p>
            </div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="card">
            <h2>Sales</h2>
            <p>${escapeHtml(formatCurrency(summary.salesTotal))}</p>
          </div>
          <div class="card">
            <h2>Expenses</h2>
            <p>${escapeHtml(formatCurrency(summary.expenseTotal))}</p>
          </div>
          <div class="card">
            <h2>Profit</h2>
            <p>${escapeHtml(formatCurrency(summary.profitTotal))}</p>
          </div>
        </div>

        <div class="section">
          <h2>Best products</h2>
          <table class="table">
            <thead>
              <tr><th>Product</th><th>Sold</th><th>Value</th></tr>
            </thead>
            <tbody>
              ${summary.bestSellers
                .map(
                  (item) =>
                    `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(String(item.quantity))}</td><td>${escapeHtml(formatCurrency(item.amount))}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Low stock</h2>
          <table class="table">
            <thead>
              <tr><th>Product</th><th>Remaining</th><th>Category</th></tr>
            </thead>
            <tbody>
              ${lowStock
                .map(
                  (item) =>
                    `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(String(item.quantity))}</td><td>${escapeHtml(item.colour || item.category || "Stock")}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Debtors</h2>
          <table class="table">
            <thead>
              <tr><th>Customer</th><th>Due</th><th>Amount</th></tr>
            </thead>
            <tbody>
              ${summary.debtors
                .map(
                  (debtor) =>
                    `<tr><td>${escapeHtml(debtor.name)}</td><td>${escapeHtml(debtor.due)}</td><td>${escapeHtml(formatCurrency(debtor.amount))}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <div class="footer" style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 0.8rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
          Powered by ${appName}
        </div>
      </div>
    </body>
  </html>`;
}

async function printReport(business, summary, lowStock, reportRange, reportStartDate, reportEndDate) {
  const businessName = business?.name || "BizTrac Business";
  const periodLabel = reportRange === "monthly" ? "Monthly" : reportRange === "yearly" ? "Yearly" : reportRange === "custom" ? "Custom" : "Weekly";
  const html = buildReportHtml(summary, business, periodLabel, reportStartDate, reportEndDate, lowStock);

  async function loadHtml2PdfFromCdn() {
    if (window.html2pdf) return window.html2pdf;
    return new Promise((resolve, reject) => {
      try {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";
        script.async = true;
        script.onload = () => {
          if (window.html2pdf) return resolve(window.html2pdf);
          return reject(new Error("html2pdf did not initialize on window"));
        };
        script.onerror = () => reject(new Error("Failed to load html2pdf from CDN"));
        document.head.appendChild(script);
      } catch (e) {
        reject(e);
      }
    });
  }

  try {
    const html2pdf = await loadHtml2PdfFromCdn();
    await html2pdf()
      .set({
        margin: 10,
        filename: `${businessName.replace(/\s+/g, "-")}-report.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(html)
      .save();
    return;
  } catch (err) {
    console.warn("html2pdf generation failed, falling back to print window", err);
    showToast("Export failed; falling back to print window", { type: "warn" });
  }

  const printWindow = window.open("about:blank", "_blank", "width=900,height=800");

  if (!printWindow) {
    window.alert("Unable to open the print window. Please allow popups for this site.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function buildReportCsv(summary, business, periodLabel, startDate, endDate, lowStock) {
  const businessName = business?.name || "BizTrac Business";
  const lines = [];

  lines.push(`"BUSINESS NAME","${businessName.replace(/"/g, '""')}"`);
  lines.push(`"REPORT PERIOD","${periodLabel}"`);
  lines.push(`"DATE RANGE","${startDate || "-"} to ${endDate || "-"}"`);
  lines.push("");

  lines.push(`"SUMMARY METRICS"`);
  lines.push(`"Sales Total","${summary.salesTotal}"`);
  lines.push(`"Expense Total","${summary.expenseTotal}"`);
  lines.push(`"Profit Total","${summary.profitTotal}"`);
  lines.push("");

  lines.push(`"DAILY BREAKDOWN"`);
  lines.push(`"Date / Day","Sales","Expenses"`);
  (summary.series || []).forEach((item) => {
    lines.push(`"${item.day}","${item.sales}","${item.expenses}"`);
  });
  lines.push("");

  lines.push(`"BEST SELLERS"`);
  lines.push(`"Product Name","Quantity Sold","Total Value"`);
  (summary.bestSellers || []).forEach((item) => {
    lines.push(`"${item.name.replace(/"/g, '""')}","${item.quantity}","${item.amount}"`);
  });
  lines.push("");

  lines.push(`"LOW STOCK REPORT"`);
  lines.push(`"Product Name","Quantity Remaining","Category/Colour"`);
  lowStock.forEach((item) => {
    lines.push(`"${item.name.replace(/"/g, '""')}","${item.quantity}","${(item.colour || item.category || "Stock").replace(/"/g, '""')}"`);
  });
  lines.push("");

  lines.push(`"DEBTORS REPORT"`);
  lines.push(`"Customer Name","Due Date","Amount Owed"`);
  (summary.debtors || []).forEach((item) => {
    lines.push(`"${item.name.replace(/"/g, '""')}","${item.due}","${item.amount}"`);
  });

  return lines.join("\n");
}

function exportReportCsv(business, summary, lowStock, reportRange, reportStartDate, reportEndDate) {
  const businessName = business?.name || "BizTrac Business";
  const periodLabel = reportRange === "monthly" ? "Monthly" : reportRange === "yearly" ? "Yearly" : reportRange === "custom" ? "Custom" : "Weekly";
  const csvContent = buildReportCsv(summary, business, periodLabel, reportStartDate, reportEndDate, lowStock);

  const filename = `${businessName.replace(/\s+/g, "-")}-${periodLabel.toLowerCase()}-report.csv`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.click();
  URL.revokeObjectURL(url);
  showToast("CSV report downloaded.", { type: "success" });
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
      {children}
    </div>
  );
}

function LoadingState({ children }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {children}
    </div>
  );
}

export function Reports({
  business,
  products = [],
  productsLoading,
  reportSummary = emptyReportSummary,
  reportRange,
  reportStartDate,
  reportEndDate,
  onReportRangeChange,
  onReportStartDateChange,
  onReportEndDateChange,
  onRefreshReport,
  onFetchProductStockTimeline,
  reportsError,
  reportsLoading,
}) {
  const [activeReportTab, setActiveReportTab] = useState("overview"); // "overview" | "stock"
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategoryFilter, setStockCategoryFilter] = useState("all");
  const [selectedTimelineProduct, setSelectedTimelineProduct] = useState(null);

  const summary = reportSummary || emptyReportSummary;
  const series = summary.series?.length ? summary.series : emptyReportSummary.series;
  const lowStock = products.filter((product) => product.quantity <= product.lowStockLimit);
  const periodLabel = useMemo(() => {
    if (reportRange === "monthly") return "Monthly";
    if (reportRange === "yearly") return "Yearly";
    if (reportRange === "custom") return "Custom period";
    return "Weekly";
  }, [reportRange]);

  // Stock Report Aggregations
  const stockMetrics = useMemo(() => {
    const totalCostValuation = products.reduce((sum, p) => sum + (p.costPrice || 0) * (p.quantity || 0), 0);
    const totalRetailValuation = products.reduce((sum, p) => sum + (p.sellingPrice || 0) * (p.quantity || 0), 0);
    const totalUnitsInStock = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const expectedMargin = totalRetailValuation - totalCostValuation;

    return {
      totalProductsCount: products.length,
      totalUnitsInStock,
      totalCostValuation,
      totalRetailValuation,
      expectedMargin,
      lowStockCount: lowStock.length,
    };
  }, [products, lowStock]);

  const categoryValuationData = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const cat = p.category || "General";
      const val = (p.costPrice || 0) * (p.quantity || 0);
      map.set(cat, (map.get(cat) || 0) + val);
    });

    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [products]);

  const filteredStockList = useMemo(() => {
    let list = products;
    if (stockCategoryFilter !== "all") {
      list = list.filter((p) => (p.category || "") === stockCategoryFilter);
    }

    if (stockSearch.trim()) {
      const q = stockSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, stockCategoryFilter, stockSearch]);

  const categoriesList = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Top Report View Tab Switcher */}
      <div className="flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1 self-start max-w-md">
        <button
          type="button"
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
            activeReportTab === "overview"
              ? "bg-white text-palm shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setActiveReportTab("overview")}
        >
          <ChartNoAxesCombined className="h-4 w-4" />
          <span>Sales & Revenue</span>
        </button>

        <button
          type="button"
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
            activeReportTab === "stock"
              ? "bg-white text-palm shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setActiveReportTab("stock")}
        >
          <Boxes className="h-4 w-4" />
          <span>Stock & Inventory Report</span>
        </button>
      </div>

      {activeReportTab === "overview" ? (
        <>
          <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm sm:grid-cols-[1.4fr_auto] sm:items-start sm:p-5">
            <div className="grid items-center gap-3">
              <div>
                <p className="text-sm font-bold text-palm">Reports</p>
                <p className="mt-2 text-sm text-slate-500">
                  {periodLabel} analysis across sales, expenses, stock, and debtors.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1.6fr_auto] items-start">
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Time range
                      </p>
                      <p className="text-xs text-slate-500">Choose a report window to update analysis.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    {[
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                      { value: "yearly", label: "Yearly" },
                      { value: "custom", label: "Custom range" },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                          reportRange === item.value
                            ? "bg-palm text-white shadow-lg shadow-palm/20"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                        }`}
                        onClick={() => onReportRangeChange(item.value)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {reportRange === "custom" ? (
                    <div className="grid gap-2 pt-3 sm:grid-cols-2">
                      <label className="block text-xs font-semibold text-slate-500">
                        Start date
                        <input
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-palm"
                          type="date"
                          value={reportStartDate}
                          onChange={(event) => onReportStartDateChange(event.target.value)}
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-500">
                        End date
                        <input
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-palm"
                          type="date"
                          value={reportEndDate}
                          onChange={(event) => onReportEndDateChange(event.target.value)}
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-slate-500">
                          Set a custom date range and click refresh to reload the report.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 self-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Export options
                    </p>
                    <p className="text-xs text-slate-500">Download or refresh custom reports.</p>
                  </div>
                  <div className="grid gap-2">
                    <Button
                      icon={FileSpreadsheet}
                      variant="secondary"
                      type="button"
                      className="w-full"
                      onClick={() => exportReportCsv(business, summary, lowStock, reportRange, reportStartDate, reportEndDate)}
                    >
                      Export Excel / CSV
                    </Button>
                    <Button
                      icon={FileDown}
                      variant="secondary"
                      type="button"
                      className="w-full"
                      onClick={() => printReport(business, summary, lowStock, reportRange, reportStartDate, reportEndDate)}
                    >
                      Export PDF
                    </Button>
                    {reportRange === "custom" ? (
                      <Button
                        icon={FileDown}
                        variant="ghost"
                        type="button"
                        className="w-full text-slate-700"
                        onClick={onRefreshReport}
                      >
                        Refresh custom range
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {reportsError ? (
            <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {reportsError}
            </div>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-3">
            <Summary
              label="Weekly sales"
              value={formatCurrency(summary.salesTotal)}
              isLoading={reportsLoading}
            />
            <Summary
              label="Weekly expenses"
              value={formatCurrency(summary.expenseTotal)}
              isLoading={reportsLoading}
            />
            <Summary
              label="Profit summary"
              value={formatCurrency(summary.profitTotal)}
              isLoading={reportsLoading}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="panel p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label">Daily sales</p>
                  <h2 className="mt-1 text-lg font-black text-ink">This week</h2>
                </div>
                <Badge variant={reportsLoading ? "slate" : "green"}>
                  {reportsLoading ? "Loading" : "Live"}
                </Badge>
              </div>
              <div className="mt-5 h-72">
                {Recharts ? (
                  <Recharts.ResponsiveContainer width="100%" height="100%">
                    <Recharts.AreaChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#027AEC" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#027AEC" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Recharts.CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                      <Recharts.XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 12 }}
                      />
                      <Recharts.Tooltip formatter={(value) => formatCurrency(value)} />
                      <Recharts.Area
                        type="monotone"
                        dataKey="sales"
                        stroke="#027AEC"
                        strokeWidth={3}
                        fill="url(#salesGradient)"
                      />
                    </Recharts.AreaChart>
                  </Recharts.ResponsiveContainer>
                ) : (
                  <div className="h-72 flex items-center justify-center">
                    <LoadingState>Loading chart</LoadingState>
                  </div>
                )}
              </div>
            </div>

            <div className="panel p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label">Expense summary</p>
                  <h2 className="mt-1 text-lg font-black text-ink">Sales vs costs</h2>
                </div>
                <ChartNoAxesCombined className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-5 h-72">
                {Recharts ? (
                  <Recharts.ResponsiveContainer width="100%" height="100%">
                    <Recharts.BarChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <Recharts.CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                      <Recharts.XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 12 }}
                      />
                      <Recharts.Tooltip formatter={(value) => formatCurrency(value)} />
                      <Recharts.Bar dataKey="sales" fill="#027AEC" radius={[8, 8, 0, 0]} />
                      <Recharts.Bar dataKey="expenses" fill="#F5A623" radius={[8, 8, 0, 0]} />
                    </Recharts.BarChart>
                  </Recharts.ResponsiveContainer>
                ) : (
                  <div className="h-72 flex items-center justify-center">
                    <LoadingState>Loading chart</LoadingState>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            <ReportList
              title="Best sellers"
              label="Products"
              icon={Crown}
              isLoading={reportsLoading}
              emptyText="No sold products yet."
              items={summary.bestSellers.map((product) => ({
                name: product.name,
                meta: `${product.quantity} sold this week`,
                value: formatCurrency(product.amount),
              }))}
            />
            <ReportList
              title="Low stock report"
              label="Inventory"
              icon={AlertTriangle}
              isLoading={productsLoading}
              emptyText="No low stock items."
              items={lowStock.map((product) => ({
                name: product.name,
                meta: `${product.quantity} remaining`,
                value: product.colour || product.category || "Stock",
              }))}
            />
            <ReportList
              title="Debtors report"
              label="Customers"
              icon={UsersRound}
              isLoading={reportsLoading}
              emptyText="No outstanding debtors."
              items={summary.debtors.map((debtor) => ({
                name: debtor.name,
                meta: debtor.due,
                value: formatCurrency(debtor.amount),
              }))}
            />
          </section>
        </>
      ) : (
        /* Dedicated Stock & Inventory Report Tab View */
        <div className="space-y-6">
          <section className="panel p-5 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-palm">Inventory Audit</p>
              <h2 className="text-2xl font-black text-ink">Stock & Valuation Report</h2>
              <p className="text-xs text-slate-500 mt-1">
                Click on any product row below to open its complete Stock History Ledger (Creation, Restock Batches, & Sales).
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Summary
                label="Capital Invested (Cost Value)"
                value={formatCurrency(stockMetrics.totalCostValuation)}
                isLoading={productsLoading}
              />
              <Summary
                label="Retail Revenue Potential"
                value={formatCurrency(stockMetrics.totalRetailValuation)}
                isLoading={productsLoading}
              />
              <Summary
                label="Expected Gross Margin"
                value={formatCurrency(stockMetrics.expectedMargin)}
                isLoading={productsLoading}
              />
              <Summary
                label="Low Stock Items Alert"
                value={`${stockMetrics.lowStockCount} SKUs`}
                isLoading={productsLoading}
              />
            </div>
          </section>

          {/* Category Valuation Chart */}
          <section className="panel p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="label">Stock Allocation</p>
                <h3 className="text-lg font-black text-ink">Valuation by Category</h3>
              </div>
              <Boxes className="h-5 w-5 text-palm" />
            </div>

            <div className="h-64">
              {Recharts && categoryValuationData.length > 0 ? (
                <Recharts.ResponsiveContainer width="100%" height="100%">
                  <Recharts.BarChart data={categoryValuationData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <Recharts.CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                    <Recharts.XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                    />
                    <Recharts.Tooltip formatter={(value) => formatCurrency(value)} />
                    <Recharts.Bar dataKey="value" fill="#027AEC" radius={[8, 8, 0, 0]} />
                  </Recharts.BarChart>
                </Recharts.ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-xs font-semibold text-slate-400">No category stock data available.</p>
                </div>
              )}
            </div>
          </section>

          {/* Stock Valuation Table */}
          <section className="panel p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-ink">Stock Inventory Ledger</h3>
                <p className="text-xs text-slate-500">Showing {filteredStockList.length} products</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs font-semibold text-ink placeholder-slate-400 focus:border-palm focus:bg-white focus:outline-none"
                    placeholder="Search stock..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                  />
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>

                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-ink focus:border-palm focus:outline-none"
                  value={stockCategoryFilter}
                  onChange={(e) => setStockCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3.5">Product Name / SKU</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Stock Quantity</th>
                    <th className="p-3.5">Unit Cost</th>
                    <th className="p-3.5">Selling Price</th>
                    <th className="p-3.5">Cost Valuation</th>
                    <th className="p-3.5">Retail Potential</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {filteredStockList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        No products match your inventory filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStockList.map((product) => {
                      const isLow = product.quantity <= product.lowStockLimit;
                      const costVal = (product.costPrice || 0) * (product.quantity || 0);
                      const retailVal = (product.sellingPrice || 0) * (product.quantity || 0);

                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-skyglass transition cursor-pointer"
                          onClick={() => setSelectedTimelineProduct(product)}
                        >
                          <td className="p-3.5">
                            <p className="font-black text-ink">{product.name}</p>
                            {product.sku ? (
                              <p className="text-[10px] text-slate-400">SKU: {product.sku}</p>
                            ) : null}
                          </td>
                          <td className="p-3.5">{product.category || "General"}</td>
                          <td className="p-3.5">
                            <Badge variant={isLow ? "amber" : "green"}>{product.quantity} pcs</Badge>
                          </td>
                          <td className="p-3.5">{formatCurrency(product.costPrice)}</td>
                          <td className="p-3.5 font-bold text-ink">{formatCurrency(product.sellingPrice)}</td>
                          <td className="p-3.5">{formatCurrency(costVal)}</td>
                          <td className="p-3.5 font-bold text-palm">{formatCurrency(retailVal)}</td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTimelineProduct(product);
                              }}
                            >
                              <History className="h-3.5 w-3.5 text-palm" />
                              <span>View History</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Product Stock Lifecycle Timeline Drawer */}
      {selectedTimelineProduct && (
        <StockTimelineDrawer
          product={selectedTimelineProduct}
          onClose={() => setSelectedTimelineProduct(null)}
          onFetchTimeline={onFetchProductStockTimeline}
        />
      )}
    </div>
  );
}

function StockTimelineDrawer({ product, onClose, onFetchTimeline }) {
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (onFetchTimeline) {
      onFetchTimeline(product.id)
        .then((res) => {
          if (isMounted) setTimeline(res);
        })
        .catch((err) => {
          console.warn("Unable to load stock timeline", err);
          if (isMounted) setTimeline(null);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [product, onFetchTimeline]);

  const p = timeline?.product || product;
  const metrics = timeline?.metrics || {
    totalSold: 0,
    totalRevenue: 0,
    totalRestockedUnits: 0,
    currentValuationAtCost: (product.costPrice || 0) * (product.quantity || 0),
    currentValuationAtRetail: (product.sellingPrice || 0) * (product.quantity || 0),
    profitMarginPerUnit: (product.sellingPrice || 0) - (product.costPrice || 0),
  };

  const restocks = timeline?.restocks || [];
  const sales = timeline?.sales || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl bg-white p-6 shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-palm">Product Stock History</p>
            <h2 className="text-2xl font-black text-ink">{p.name}</h2>
            {p.sku && <p className="text-xs font-semibold text-slate-400">SKU: {p.sku}</p>}
          </div>
          <button type="button" className="icon-button h-9 w-9" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <LoadingState>Loading full stock history timeline…</LoadingState>
          </div>
        ) : (
          <div className="flex-1 py-4 space-y-6">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block font-semibold">Category</span>
                <span className="font-black text-ink">{p.category || "General"}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block font-semibold">Current Stock</span>
                <span className="font-black text-emerald-700">{p.quantity} pcs</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block font-semibold">Unit Cost</span>
                <span className="font-black text-ink">{formatCurrency(p.costPrice)}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block font-semibold">Unit Selling</span>
                <span className="font-black text-palm">{formatCurrency(p.sellingPrice)}</span>
              </div>
            </div>

            {/* Financial Lifecycle Metrics */}
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-800">Financial Valuation Summary</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Current Capital (Cost):</span>
                  <span className="text-sm font-black text-ink">{formatCurrency(metrics.currentValuationAtCost)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Retail Valuation:</span>
                  <span className="text-sm font-black text-palm">{formatCurrency(metrics.currentValuationAtRetail)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Profit Margin / Unit:</span>
                  <span className="text-sm font-black text-emerald-700">{formatCurrency(metrics.profitMarginPerUnit)}</span>
                </div>
              </div>
            </div>

            {/* Complete Chronological Timeline */}
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">
                Chronological Audit Trail
              </h3>

              <div className="relative border-l-2 border-slate-200 ml-3 pl-6 space-y-6">
                {/* Product Creation Event */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 grid h-6 w-6 place-items-center rounded-full bg-palm text-white text-[10px] font-bold">
                    🏁
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-ink font-black">Original Stock Created</span>
                      <span className="text-slate-400 font-semibold">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" }) : "Initial"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Product created with initial pricing of <span className="font-bold text-ink">{formatCurrency(p.costPrice)}</span> cost and <span className="font-bold text-palm">{formatCurrency(p.sellingPrice)}</span> selling price.
                    </p>
                  </div>
                </div>

                {/* Restock Batch Arrivals Timeline */}
                {restocks.map((r) => {
                  const costDiff = r.newCostPrice - r.oldCostPrice;
                  const sellingDiff = r.newSellingPrice - r.oldSellingPrice;

                  return (
                    <div key={r.id} className="relative">
                      <div className="absolute -left-[31px] top-0 grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                        📦
                      </div>
                      <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-sm space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-emerald-900 font-black">
                            Restock Arrival (+{r.quantityAdded} pcs)
                          </span>
                          <span className="text-slate-500 font-semibold">
                            {new Date(r.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 flex justify-between">
                          <span>Stock Level: {r.previousQuantity} → {r.newQuantity} pcs</span>
                          <span className="font-semibold text-slate-500">{r.supplierName ? `Supplier: ${r.supplierName}` : "Direct Arrival"}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block font-semibold">Cost Price Shift</span>
                            <span className="font-bold text-slate-700">
                              {formatCurrency(r.oldCostPrice)} → {formatCurrency(r.newCostPrice)}
                            </span>
                            {costDiff !== 0 && (
                              <span className={`block font-black text-[10px] ${costDiff > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                {costDiff > 0 ? `+${formatCurrency(costDiff)}` : formatCurrency(costDiff)}
                              </span>
                            )}
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block font-semibold">Selling Price Shift</span>
                            <span className="font-bold text-slate-700">
                              {formatCurrency(r.oldSellingPrice)} → {formatCurrency(r.newSellingPrice)}
                            </span>
                            {sellingDiff !== 0 && (
                              <span className={`block font-black text-[10px] ${sellingDiff > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                                {sellingDiff > 0 ? `+${formatCurrency(sellingDiff)}` : formatCurrency(sellingDiff)}
                              </span>
                            )}
                          </div>
                        </div>

                        {r.notes && (
                          <p className="text-[11px] font-medium text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                            Note: {r.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Sales Transactions Activity */}
                {sales.length > 0 && (
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 grid h-6 w-6 place-items-center rounded-full bg-sky-600 text-white text-[10px] font-bold">
                      🛒
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-ink font-black">Total Sales Activity</span>
                        <span className="text-sky-700 font-bold">{metrics.totalSold} pcs sold</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Total sales revenue generated: <span className="font-black text-palm">{formatCurrency(metrics.totalRevenue)}</span> across {sales.length} transactions.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100">
          <button
            type="button"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            Close History Drawer
          </button>
        </div>
      </div>
    </div>
  );
}

function Summary({ isLoading, label, value }) {
  return (
    <article className="panel p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-ink">{isLoading ? "Loading" : value}</p>
    </article>
  );
}

function ReportList({ emptyText, isLoading, label, title, icon: Icon, items }) {
  return (
    <article className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label">{label}</p>
          <h2 className="mt-1 text-lg font-black text-ink">{title}</h2>
        </div>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {isLoading ? <LoadingState>Loading report</LoadingState> : null}
        {!isLoading && !items.length ? <EmptyState>{emptyText}</EmptyState> : null}
        {!isLoading &&
          items.map((item) => (
            <div key={`${item.name}-${item.meta}`} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">{item.name}</p>
                <p className="text-xs font-semibold text-slate-500">{item.meta}</p>
              </div>
              <p className="text-right text-sm font-black text-palm">{item.value}</p>
            </div>
          ))}
      </div>
    </article>
  );
}

export default Reports;

import { useMemo, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChartNoAxesCombined,
  Crown,
  FileDown,
  FileSpreadsheet,
  Loader2,
  UsersRound,
} from "lucide-react";
// Dynamically import heavy libraries at runtime to keep the initial bundle small.
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
  // Generate a PDF using html2pdf loaded from a CDN to keep it out of the app bundle.
  // If it errors, fall back to a print window.
  async function loadHtml2PdfFromCdn() {
    if (window.html2pdf) return window.html2pdf;
    return new Promise((resolve, reject) => {
      try {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";
        script.async = true;
        script.onload = () => {
          // html2pdf exposes a global factory function
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

  // Fallback: open print window (kept for compatibility)
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
  reportsError,
  reportsLoading,
}) {
  const summary = reportSummary || emptyReportSummary;
  const series = summary.series?.length ? summary.series : emptyReportSummary.series;
  const lowStock = products.filter((product) => product.quantity <= product.lowStockLimit);
  const periodLabel = useMemo(() => {
    if (reportRange === "monthly") return "Monthly";
    if (reportRange === "yearly") return "Yearly";
    if (reportRange === "custom") return "Custom period";
    return "Weekly";
  }, [reportRange]);

  const [Recharts, setRecharts] = useState(null);
  useEffect(() => {
    let mounted = true;
    // Load recharts as an ESM module from a CDN to keep it out of the app bundle.
    import("https://cdn.jsdelivr.net/npm/recharts@3.9.2/esm/index.js")
      .then((mod) => {
        if (mounted) setRecharts(mod);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* <div>
          <p className="text-sm font-bold text-palm">Reports</p>
      </div> */}
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

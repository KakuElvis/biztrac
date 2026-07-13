import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  AlertCircle,
  AlertTriangle,
  ChartNoAxesCombined,
  Crown,
  FileDown,
  Loader2,
  UsersRound,
} from "lucide-react";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { emptyReportSummary } from "../../services/reportService.js";
import { formatCurrency } from "../../lib/formatters.js";

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
  products = [],
  productsLoading,
  reportSummary = emptyReportSummary,
  reportsError,
  reportsLoading,
}) {
  const summary = reportSummary || emptyReportSummary;
  const series = summary.series?.length ? summary.series : emptyReportSummary.series;
  const lowStock = products.filter((product) => product.quantity <= product.lowStockLimit);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-palm">Reports</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-ink">Business pulse</h1>
        </div>
        <Button icon={FileDown} variant="secondary" type="button">
          Export PDF
        </Button>
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
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#027AEC" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#027AEC" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#027AEC"
                  strokeWidth={3}
                  fill="url(#salesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="sales" fill="#027AEC" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expenses" fill="#F5A623" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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

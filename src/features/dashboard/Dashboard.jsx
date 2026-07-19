import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  CreditCard,
  Loader2,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { MetricCard } from "../../components/cards/MetricCard.jsx";
import { emptyDashboardSummary } from "../../services/dashboardService.js";
import { formatCompactCurrency, formatCurrency } from "../../lib/formatters.js";

function countNote(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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

function greetingForHour(hour) {
  if (hour >= 18 || hour < 5) {
    return "Good evening";
  }

  if (hour >= 12) {
    return "Good afternoon";
  }

  return "Good morning";
}

export function Dashboard({
  business,
  dashboardError,
  dashboardLoading,
  dashboardSummary = emptyDashboardSummary,
  products = [],
  productsLoading,
  onNavigate,
}) {
  const summary = dashboardSummary || emptyDashboardSummary;
  const ownerName = business?.owner || "there";
  const greeting = greetingForHour(new Date().getHours());
  const totalStockValue = products.reduce(
    (total, product) => total + product.costPrice * product.quantity,
    0
  );
  const lowStockItems = products.filter((product) => product.quantity <= product.lowStockLimit);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-palm">{greeting}, {ownerName}</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-ink">Today at a glance</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button icon={ShoppingCart} onClick={() => onNavigate("sales")}>
            New Sale
          </Button>
          <Button icon={Boxes} variant="secondary" onClick={() => onNavigate("inventory")}>
            Add Stock
          </Button>
        </div>
      </section>

      {dashboardError ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {dashboardError}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Today's sales"
          value={formatCurrency(summary.todaySales)}
          note={
            dashboardLoading
              ? "Loading sales"
              : `${countNote(summary.todayItemCount, "item")} sold`
          }
          icon={ReceiptText}
          tone="green"
        />
        <MetricCard
          label="Stock value"
          value={formatCompactCurrency(totalStockValue)}
          note={productsLoading ? "Loading stock" : `${products.length} products tracked`}
          icon={Boxes}
          tone="blue"
        />
        <MetricCard
          label="Estimated profit"
          value={formatCurrency(summary.estimatedProfit)}
          note={dashboardLoading ? "Loading profit" : "After recorded expenses"}
          icon={TrendingUp}
          tone="green"
        />
        <MetricCard
          label="Expenses"
          value={formatCurrency(summary.totalExpenses)}
          note={
            dashboardLoading
              ? "Loading expenses"
              : `${countNote(summary.expenseCount, "entry", "entries")} today`
          }
          icon={WalletCards}
          tone="amber"
          trend="down"
        />
        <MetricCard
          label="Debtors"
          value={formatCurrency(summary.totalDebtors)}
          note={
            dashboardLoading
              ? "Loading debtors"
              : `${countNote(summary.debtorCount, "customer")} owing`
          }
          icon={CreditCard}
          tone="red"
          trend="down"
        />
        <MetricCard
          label="Low stock"
          value={lowStockItems.length}
          note={productsLoading ? "Loading stock" : "Restock soon"}
          icon={AlertTriangle}
          tone="amber"
          trend="down"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="label">Quick actions</p>
              <h2 className="mt-1 text-lg font-black text-ink">Counter workflow</h2>
            </div>
            <Badge variant="green">Open</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Create invoice", icon: ReceiptText, screen: "more" },
              { label: "Record expense", icon: WalletCards, screen: "expenses" },
              { label: "Stock in", icon: Boxes, screen: "inventory" },
              { label: "Debtors list", icon: CreditCard, screen: "more" },
            ].map((action) => (
              <button
                key={action.label}
                className="flex min-h-20 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-palm/40 hover:bg-skyglass"
                onClick={() => onNavigate(action.screen)}
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-palm">
                  <action.icon className="h-5 w-5" />
                </span>
                <span className="font-black text-ink">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Low stock alert</p>
              <h2 className="mt-1 text-lg font-black text-ink">Needs attention</h2>
            </div>
            <button className="text-sm font-bold text-palm" onClick={() => onNavigate("inventory")}>
              View stock
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {productsLoading ? <LoadingState>Loading stock</LoadingState> : null}
            {!productsLoading && !lowStockItems.length ? (
              <EmptyState>No low stock items.</EmptyState>
            ) : null}
            {!productsLoading &&
              lowStockItems.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-warning/10 p-3"
                >
                  <div>
                    <p className="text-sm font-black text-ink">{product.name}</p>
                    <p className="text-xs font-medium text-slate-500">
                      {[product.size, product.colour].filter(Boolean).join(" | ") || "Stock item"}
                    </p>
                  </div>
                  <Badge variant="amber">{product.quantity} left</Badge>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Recent sales</p>
              <h2 className="mt-1 text-lg font-black text-ink">Latest receipts</h2>
            </div>
            <ReceiptText className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {dashboardLoading ? <LoadingState>Loading sales</LoadingState> : null}
            {!dashboardLoading && !summary.recentSales.length ? (
              <EmptyState>No sales recorded yet.</EmptyState>
            ) : null}
            {!dashboardLoading &&
              summary.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-black text-ink">{sale.customer}</p>
                    <p className="text-xs font-medium text-slate-500">
                      {sale.id} | {sale.time} | {sale.payment}
                    </p>
                  </div>
                  <p className="text-sm font-black text-ink">{formatCurrency(sale.amount)}</p>
                </div>
              ))}
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Debtors</p>
              <h2 className="mt-1 text-lg font-black text-ink">Follow up</h2>
            </div>
            <CreditCard className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {dashboardLoading ? <LoadingState>Loading debtors</LoadingState> : null}
            {!dashboardLoading && !summary.debtors.length ? (
              <EmptyState>No outstanding debtors.</EmptyState>
            ) : null}
            {!dashboardLoading &&
              summary.debtors.map((debtor) => (
                <div key={debtor.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-black text-ink">{debtor.name}</p>
                    <p className="text-xs font-medium text-slate-500">{debtor.due}</p>
                  </div>
                  <p className="text-sm font-black text-red-600">
                    {formatCurrency(debtor.amount)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}

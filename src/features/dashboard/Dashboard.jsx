import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  ChevronRight,
  Clock,
  CreditCard,
  Loader2,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { MetricCard } from "../../components/cards/MetricCard.jsx";
import { emptyDashboardSummary } from "../../services/dashboardService.js";
import { classNames, formatCompactCurrency, formatCurrency } from "../../lib/formatters.js";

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
  canViewProfit = true,
  canViewCostPrice = true,
  isCashier = false,
  permissions,
  dashboardError,
  dashboardLoading,
  dashboardSummary = emptyDashboardSummary,
  products = [],
  productsLoading,
  onNavigate,
}) {
  const effectiveIsCashier = Boolean(isCashier || permissions?.isCashier);
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
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={ShoppingCart} onClick={() => onNavigate("sales")}>
            New Sale
          </Button>
          {!effectiveIsCashier && (
            <Button icon={Boxes} variant="secondary" onClick={() => onNavigate("inventory")}>
              Add Stock
            </Button>
          )}
        </div>
      </section>

      {dashboardError ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {dashboardError}
        </div>
      ) : null}

      <section className="grid gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Today's sales"
          value={formatCurrency(summary.todaySales)}
          note={
            dashboardLoading
              ? "Loading sales"
              : `${countNote(summary.todayItemCount, "item")} sold`
          }
          icon={ReceiptText}
          tone="emerald"
          trend="up"
          onClick={() => onNavigate("sales")}
        />
        {!effectiveIsCashier && (
          <MetricCard
            label={canViewCostPrice ? "Stock value" : "Catalog products"}
            value={canViewCostPrice ? formatCompactCurrency(totalStockValue) : products.length}
            note={
              productsLoading
                ? "Loading stock"
                : canViewCostPrice
                ? `${products.length} products tracked`
                : "Active inventory items"
            }
            icon={Boxes}
            tone="blue"
            trend="neutral"
            onClick={() => onNavigate("inventory")}
          />
        )}
        {canViewProfit ? (
          <MetricCard
            label="Estimated profit"
            value={formatCurrency(summary.estimatedProfit)}
            note={dashboardLoading ? "Loading profit" : "After recorded expenses"}
            icon={TrendingUp}
            tone="teal"
            trend={summary.estimatedProfit < 0 ? "down" : "up"}
            onClick={() => onNavigate("reports")}
          />
        ) : (
          <MetricCard
            label="Items sold today"
            value={summary.todayItemCount || 0}
            note={dashboardLoading ? "Loading counts" : "Total items checked out"}
            icon={ReceiptText}
            tone="teal"
            trend="up"
            onClick={() => onNavigate("sales")}
          />
        )}
        {!effectiveIsCashier && (
          <MetricCard
            label="Expenses"
            value={formatCurrency(summary.totalExpenses)}
            note={
              dashboardLoading
                ? "Loading expenses"
                : `${countNote(summary.expenseCount, "entry", "entries")} today`
            }
            icon={WalletCards}
            tone="rose"
            trend="down"
            onClick={() => onNavigate("expenses")}
          />
        )}
        <MetricCard
          label="Debtors"
          value={formatCurrency(summary.totalDebtors)}
          note={
            dashboardLoading
              ? "Loading debtors"
              : `${countNote(summary.debtorCount, "customer")} owing`
          }
          icon={CreditCard}
          tone="purple"
          trend={summary.totalDebtors > 0 ? "alert" : "neutral"}
          onClick={() => onNavigate("customers")}
        />
        {!effectiveIsCashier && (
          <MetricCard
            label="Low stock"
            value={lowStockItems.length}
            note={
              productsLoading
                ? "Loading stock"
                : lowStockItems.length === 0
                  ? "All items well stocked"
                  : `${countNote(lowStockItems.length, "item")} need restock`
            }
            icon={AlertTriangle}
            tone="amber"
            trend={lowStockItems.length > 0 ? "alert" : "neutral"}
            onClick={() => onNavigate("inventory")}
          />
        )}
      </section>

      <section className={classNames("grid gap-5", effectiveIsCashier ? "grid-cols-1" : "lg:grid-cols-[1.2fr_0.8fr]")}>
        <div className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="label">Quick actions</p>
              <h2 className="mt-1 text-lg font-black text-ink">Counter workflow</h2>
            </div>
            <Badge variant="green">Open</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(effectiveIsCashier
              ? [
                  {
                    label: "New POS Sale",
                    desc: "Ring up sale & print receipt",
                    icon: ShoppingCart,
                    screen: "sales",
                    color: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white border-emerald-100",
                  },
                  {
                    label: "Customers & Debt",
                    desc: "Directory & debt collection",
                    icon: UsersRound,
                    screen: "customers",
                    color: "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white border-purple-100",
                  },
                ]
              : [
                  {
                    label: "Create invoice",
                    desc: "Generate bills & quotes",
                    icon: ReceiptText,
                    screen: "more",
                    color: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white border-indigo-100",
                  },
                  {
                    label: "Record expense",
                    desc: "Log daily shop spending",
                    icon: WalletCards,
                    screen: "expenses",
                    color: "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white border-rose-100",
                  },
                  {
                    label: "Stock in",
                    desc: "Add or restock items",
                    icon: Boxes,
                    screen: "inventory",
                    color: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white border-emerald-100",
                  },
                  {
                    label: "Customers",
                    desc: "Directory & debt collection",
                    icon: UsersRound,
                    screen: "customers",
                    color: "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white border-purple-100",
                  },
                ]
            ).map((action) => (
              <button
                key={action.label}
                className="group flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:scale-[0.98]"
                onClick={() => onNavigate(action.screen)}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border transition-colors duration-200 ${action.color}`}>
                    <action.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-ink text-sm sm:text-base group-hover:text-palm transition-colors">{action.label}</p>
                    <p className="text-xs font-medium text-slate-400 truncate">{action.desc}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-slate-600" />
              </button>
            ))}
          </div>
        </div>

        {!effectiveIsCashier && (
          <div className="panel p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="label">Low stock alert</p>
                <h2 className="mt-1 text-lg font-black text-ink">Needs attention</h2>
              </div>
              <button className="text-sm font-bold text-palm hover:text-palmDeep transition" onClick={() => onNavigate("inventory")}>
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
                    className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3 transition hover:bg-amber-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-ink">{product.name}</p>
                      <p className="text-xs font-medium text-slate-500">
                        {[product.size, product.colour].filter(Boolean).join(" | ") || "Stock item"}
                      </p>
                    </div>
                    <Badge variant="amber">{product.quantity} left</Badge>
                  </div>
                ))}
            </div>
          </div>
        )}
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
                <div key={sale.id} className="flex items-center justify-between gap-4 py-3 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-palm/10 group-hover:text-palm transition">
                      <ReceiptText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-ink">{sale.customer}</p>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 flex-wrap">
                        <span className="font-mono text-slate-400">{sale.id}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {sale.time}
                        </span>
                        <span>•</span>
                        <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          {sale.payment}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-black text-ink shrink-0">{formatCurrency(sale.amount)}</p>
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
            <button className="text-sm font-bold text-palm hover:text-palmDeep transition" onClick={() => onNavigate("customers")}>
              View & Pay
            </button>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {dashboardLoading ? <LoadingState>Loading debtors</LoadingState> : null}
            {!dashboardLoading && !summary.debtors.length ? (
              <EmptyState>No outstanding debtors.</EmptyState>
            ) : null}
            {!dashboardLoading &&
              summary.debtors.map((debtor) => (
                <div key={debtor.id} className="flex items-center justify-between gap-4 py-3 group">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-ink">{debtor.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="rounded-full bg-red-50 border border-red-200/60 px-2 py-0.5 text-[10px] font-bold text-red-600">
                        {debtor.due || "Due"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-black text-red-600">
                      {formatCurrency(debtor.amount)}
                    </p>
                    <button
                      onClick={() => onNavigate("customers")}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs"
                    >
                      Collect
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;

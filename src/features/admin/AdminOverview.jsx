import {
  TrendingUp,
  DollarSign,
  Building2,
  Users,
  Package,
  ShoppingCart,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { formatCurrency } from "../../lib/formatters.js";

export function AdminOverview({ stats, onNavigateTab }) {
  if (!stats) return null;

  const cards = [
    {
      label: "Platform Revenue (GHS)",
      value: formatCurrency(stats.total_revenue_ghs || 0),
      subtext: "Total collected subscription fees",
      icon: DollarSign,
      tone: "amber",
      border: "border-amber-200",
      bg: "bg-amber-50 text-amber-700",
    },
    {
      label: "Platform GMV (GHS)",
      value: formatCurrency(stats.platform_gmv_ghs || 0),
      subtext: "Gross sales rung across all shops",
      icon: TrendingUp,
      tone: "emerald",
      border: "border-emerald-200",
      bg: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Active Pro Stores",
      value: stats.active_pro || 0,
      subtext: `${stats.free_tier || 0} Free tier stores`,
      icon: ShieldCheck,
      tone: "purple",
      border: "border-purple-200",
      bg: "bg-purple-50 text-purple-700",
    },
    {
      label: "Total Businesses",
      value: stats.total_businesses || 0,
      subtext: "Registered tenant stores",
      icon: Building2,
      tone: "blue",
      border: "border-blue-200",
      bg: "bg-blue-50 text-blue-700",
    },
    {
      label: "This Month Sales",
      value: stats.current_month_sales_count || 0,
      subtext: "Transactions processed this month",
      icon: ShoppingCart,
      tone: "sky",
      border: "border-sky-200",
      bg: "bg-sky-50 text-sky-700",
    },
    {
      label: "Tracked Catalog Items",
      value: stats.total_products_tracked || 0,
      subtext: "Active retail SKUs & inventory",
      icon: Package,
      tone: "slate",
      border: "border-slate-200",
      bg: "bg-slate-100 text-slate-700",
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-5 rounded-3xl bg-white border ${card.border} shadow-xs space-y-3 transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {card.label}
                </span>
                <div className={`grid h-10 w-10 place-items-center rounded-2xl ${card.bg}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-ink tracking-tight">{card.value}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{card.subtext}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Action & Lead Management Callout */}
      <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-500/10 via-amber-50 to-white p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-800">
            <Zap className="h-3 w-3" /> Growth & Subscriptions
          </div>
          <h3 className="text-base font-black text-slate-900">
            Direct MoMo Reconciliation & Upgrade Management
          </h3>
          <p className="text-xs text-slate-600 max-w-xl">
            Did a merchant pay you via direct MTN MoMo or Telecel Cash? Open the Business Directory
            to manually extend their subscription period or upgrade them to Pro.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab("businesses")}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition active:scale-95"
        >
          Manage Business Directory →
        </button>
      </div>
    </div>
  );
}

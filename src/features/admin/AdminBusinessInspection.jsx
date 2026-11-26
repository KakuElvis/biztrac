import { DollarSign, Eye, MapPin, Package, ShoppingCart, Users, X } from "lucide-react";
import { formatCurrency } from "../../lib/formatters.js";

function formatDate(value, options = {}) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, options)
    : "—";
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-indigo-500" />
      </div>
      <div className="mt-2 text-xl font-black text-ink">{value}</div>
    </div>
  );
}

export function AdminBusinessInspection({ inspection, onClose }) {
  const business = inspection?.business || {};
  const metrics = inspection?.metrics || {};
  const lowStockProducts = Array.isArray(inspection?.low_stock_products)
    ? inspection.low_stock_products
    : [];
  const recentSales = Array.isArray(inspection?.recent_sales) ? inspection.recent_sales : [];
  const hasSnapshot = Boolean(inspection?.metrics);
  const currency = business.currency || "GHS";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-inspection-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:p-6">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-700">
              <Eye className="h-3.5 w-3.5" /> Read-only inspection
            </div>
            <h2 id="admin-inspection-title" className="truncate text-xl font-black text-ink">
              {business.name || "Store inspection"}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>{business.owner_name || "Store Owner"}</span>
              {business.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {business.location}
                </span>
              ) : null}
              <span>Joined {formatDate(business.created_at, { dateStyle: "medium" })}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close store inspection"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-6">
          {!hasSnapshot ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900">
              This database has not returned the inspection snapshot yet. Apply the latest admin inspection migration, then reopen this store.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Sales total" value={formatCurrency(metrics.sales_total, currency)} icon={ShoppingCart} />
            <Metric label="Transactions" value={metrics.sales_count ?? 0} icon={ShoppingCart} />
            <Metric label="Products" value={metrics.products_count ?? 0} icon={Package} />
            <Metric label="Low stock" value={metrics.low_stock_count ?? 0} icon={Package} />
            <Metric label="Customers" value={metrics.customers_count ?? 0} icon={Users} />
            <Metric label="Sales this month" value={metrics.current_month_sales_count ?? 0} icon={ShoppingCart} />
            <Metric label="Expenses" value={formatCurrency(metrics.expenses_total, currency)} icon={DollarSign} />
            <Metric
              label="Plan"
              value={(business.plan_tier || "free").toUpperCase()}
              icon={Eye}
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-black text-slate-800">Low stock products</h3>
                <span className="text-[10px] font-bold text-slate-400">Up to 10 items</span>
              </div>
              {lowStockProducts.length ? (
                <div className="divide-y divide-slate-100">
                  {lowStockProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-800">{product.name}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">SKU: {product.sku || "—"}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-black text-rose-700">{product.quantity} left</div>
                        <div className="text-[10px] text-slate-400">Limit {product.low_stock_limit}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-xs text-slate-400">No low stock products.</p>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-black text-slate-800">Recent sales</h3>
                <span className="text-[10px] font-bold text-slate-400">Up to 10 transactions</span>
              </div>
              {recentSales.length ? (
                <div className="divide-y divide-slate-100">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-800">{sale.reference}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {formatDate(sale.sold_at)} · {(sale.payment_method || "unknown").toUpperCase()}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-black text-slate-800">{formatCurrency(sale.total, currency)}</div>
                        <div className="text-[10px] text-slate-400">
                          Paid {formatCurrency(sale.amount_paid, currency)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-xs text-slate-400">No sales recorded yet.</p>
              )}
            </section>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-xs">
            <h3 className="mb-2 font-black text-slate-800">Store contact</h3>
            <div className="grid gap-2 text-slate-600 sm:grid-cols-2">
              <div><span className="font-bold text-slate-400">Phone:</span> {business.phone || "—"}</div>
              <div><span className="font-bold text-slate-400">Email:</span> {business.owner_email || business.email || "—"}</div>
              <div>
                <span className="font-bold text-slate-400">Plan expiry:</span>{" "}
                {business.plan_expires_at
                  ? formatDate(business.plan_expires_at, { dateStyle: "medium" })
                  : business.plan_tier && business.plan_tier !== "free"
                  ? "Perpetual"
                  : "—"}
              </div>
              <div>
                <span className="font-bold text-slate-400">Status:</span>{" "}
                {business.is_suspended ? `Suspended${business.suspension_reason ? ` — ${business.suspension_reason}` : ""}` : "Active"}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

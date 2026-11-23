import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Crown,
  Edit3,
  X,
  AlertCircle,
  Download,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "../../lib/formatters.js";
import {
  listAdminBusinesses,
  overrideBusinessPlan,
  toggleBusinessSuspension,
  exportBusinessesCsv,
  impersonateBusiness,
} from "../../services/adminService.js";
import { showToast } from "../../lib/toast.js";

export function AdminBusinesses({ onImpersonateStore, adminRole = "super_admin" }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  // Sorting state
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Plan Override Modal State
  const [targetBiz, setTargetBiz] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [daysValid, setDaysValid] = useState(30);
  const [overrideBaseDate, setOverrideBaseDate] = useState(0);
  const [reason, setReason] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Suspension Modal State
  const [suspensionTarget, setSuspensionTarget] = useState(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [suspensionSubmitting, setSuspensionSubmitting] = useState(false);

  const fetchBusinesses = useCallback(async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * pageSize;
      const data = await listAdminBusinesses({
        search,
        planFilter,
        sortBy,
        sortDir,
        limit: pageSize,
        offset,
      });

      setBusinesses(data);
      setTotalCount(data.totalCount ?? data.length);
    } catch (err) {
      console.error("[AdminBusinesses] Failed to load businesses:", err);
      showToast(err.message || "Failed to load businesses", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, sortBy, sortDir, page, pageSize]);

  const handleSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnKey);
      setSortDir(columnKey === "name" ? "asc" : "desc");
    }
    setPage(1);
  };

  const renderSortIcon = (columnKey) => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400 transition" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-palm" />
    ) : (
      <ArrowDown className="h-3 w-3 text-palm" />
    );
  };

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBusinesses();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchBusinesses]);

  // Reset to page 1 on search or filter change
  const handleSearchChange = (val) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (filterId) => {
    setPlanFilter(filterId);
    setPage(1);
  };

  const handleOpenOverride = (biz) => {
    setTargetBiz(biz);
    setSelectedPlan(biz.plan_tier === "enterprise" ? "enterprise" : "pro");
    setDaysValid(30);
    setReason("");
    setAmountPaid("");
    const now = Date.now();
    const expiryTime = biz.plan_expires_at ? new Date(biz.plan_expires_at).getTime() : 0;
    setOverrideBaseDate(expiryTime > now ? expiryTime : now);
  };

  const handleCloseOverride = () => {
    setTargetBiz(null);
    setReason("");
    setAmountPaid("");
  };

  const handleSubmitOverride = async (e) => {
    e.preventDefault();
    if (!targetBiz) return;
    if (!Number.isInteger(Number(daysValid)) || Number(daysValid) < 1 || Number(daysValid) > 3650) {
      showToast("Plan duration must be between 1 and 3650 days.", { type: "warn" });
      return;
    }
    if (!Number.isFinite(Number(amountPaid)) || Number(amountPaid) < 0 || Number(amountPaid) > 1000000) {
      showToast("Payment amount must be between 0 and 1,000,000.", { type: "warn" });
      return;
    }
    if (Number(amountPaid) > 0 && !reason.trim()) {
      showToast("Add a payment reference or note when recording a payment.", { type: "warn" });
      return;
    }

    try {
      setSubmitting(true);
      await overrideBusinessPlan(targetBiz.id, {
        planTier: selectedPlan,
        daysValid: Number(daysValid),
        reason: reason.trim() || `Manual admin update: ${selectedPlan}`,
        amountPaid: Number(amountPaid) || 0,
      });

      const revenueMsg = Number(amountPaid) > 0 ? ` (Recorded GH₵ ${Number(amountPaid).toFixed(2)})` : "";
      showToast(
        `Updated plan for ${targetBiz.name} to ${selectedPlan.toUpperCase()}.${revenueMsg}`,
        { type: "success" }
      );

      handleCloseOverride();
      fetchBusinesses();
    } catch (err) {
      console.error("[AdminBusinesses] Override error:", err);
      showToast(err.message || "Failed to update business plan", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSuspension = (biz) => {
    setSuspensionTarget(biz);
    setSuspensionReason(biz.suspension_reason || "");
  };

  const handleCloseSuspension = () => {
    setSuspensionTarget(null);
    setSuspensionReason("");
  };

  const handleConfirmSuspension = async (e) => {
    e.preventDefault();
    if (!suspensionTarget) return;

    const willSuspend = !suspensionTarget.is_suspended;

    try {
      setSuspensionSubmitting(true);
      await toggleBusinessSuspension(suspensionTarget.id, {
        suspend: willSuspend,
        reason: suspensionReason.trim(),
      });

      showToast(
        willSuspend
          ? `Store "${suspensionTarget.name}" has been suspended.`
          : `Store "${suspensionTarget.name}" has been reactivated.`,
        { type: willSuspend ? "info" : "success" }
      );

      handleCloseSuspension();
      fetchBusinesses();
    } catch (err) {
      console.error("[AdminBusinesses] Suspension error:", err);
      showToast(err.message || "Failed to update store status", { type: "error" });
    } finally {
      setSuspensionSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    try {
      if (!businesses || !businesses.length) {
        showToast("No store records to export in the current view.", { type: "error" });
        return;
      }
      exportBusinessesCsv(businesses);
      showToast("Exported directory to CSV successfully.", { type: "success" });
    } catch (err) {
      console.error("[AdminBusinesses] Export error:", err);
      showToast(err.message || "Failed to export CSV", { type: "error" });
    }
  };

  const handleImpersonate = async (biz) => {
    try {
      const res = await impersonateBusiness(biz.id);
      if (res?.success) {
        showToast(`Entering inspection mode for "${biz.name}"`, { type: "info" });
        if (onImpersonateStore) {
          onImpersonateStore(biz);
        }
      }
    } catch (err) {
      console.error("[AdminBusinesses] Impersonate error:", err);
      showToast(err.message || "Failed to inspect store", { type: "error" });
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const fromRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-4">
      {/* Top Search, Filter, and Export Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by store name, phone, email, owner..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-palm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Plan & Status Filters */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            {[
              { id: "all", label: "All Stores" },
              { id: "pro", label: "Pro Active" },
              { id: "free", label: "Free Tier" },
              { id: "suspended", label: "Suspended" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleFilterChange(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  planFilter === tab.id
                    ? "bg-white text-ink shadow-xs"
                    : "text-slate-500 hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            title="Download CSV export of currently listed stores"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 font-bold text-xs shadow-2xs transition active:scale-95"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Businesses Table & Mobile Cards */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Mobile Stacked Cards View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-slate-400 font-bold text-xs">
              Loading businesses directory...
            </div>
          ) : businesses.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-bold text-xs">
              No businesses matching search criteria.
            </div>
          ) : (
            businesses.map((biz) => {
              const isPro = Boolean(biz.is_pro);
              const isSuspended = Boolean(biz.is_suspended);
              return (
                <div
                  key={biz.id}
                  className={`p-4 space-y-3 transition-colors ${
                    isSuspended ? "bg-rose-50/40" : "hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-sm text-ink">{biz.name}</span>
                        {isSuspended && (
                          <span className="rounded-md bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.2 text-[9px] font-black uppercase">
                            Suspended
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {biz.location || "Location not set"}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase shrink-0 ${
                        isPro
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isPro && <Crown className="h-3 w-3 text-amber-600" />}
                      {biz.plan_tier || "free"}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">{biz.owner_name}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">
                        {biz.phone || biz.owner_email || "No contact"}
                      </span>
                    </div>
                    {biz.plan_expires_at ? (
                      <span className="text-[10px] text-slate-400">
                        Exp: {new Date(biz.plan_expires_at).toLocaleDateString()}
                      </span>
                    ) : isPro ? (
                      <span className="text-[10px] text-emerald-600 font-bold">Perpetual</span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Products</span>
                      <span className="font-mono font-bold text-slate-700">{biz.products_count}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Platform GMV</span>
                      <span className="font-mono font-black text-ink">{formatCurrency(biz.total_sales_volume || 0)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {onImpersonateStore && adminRole !== "billing" && (
                      <button
                        type="button"
                        onClick={() => handleImpersonate(biz)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold text-xs shadow-2xs active:scale-95"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect</span>
                      </button>
                    )}

                    {adminRole !== "support" && (
                      <button
                        type="button"
                        onClick={() => handleOpenOverride(biz)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs active:scale-95"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Plan</span>
                      </button>
                    )}

                    {adminRole !== "billing" && (
                      <button
                        type="button"
                        onClick={() => handleOpenSuspension(biz)}
                        className={`flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl border font-bold text-xs shadow-2xs active:scale-95 ${
                          isSuspended
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {isSuspended ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Reactivate</span>
                          </>
                        ) : (
                          <>
                            <Ban className="h-3.5 w-3.5" />
                            <span>Suspend</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                <th
                  onClick={() => handleSort("name")}
                  className="py-3.5 px-4 cursor-pointer select-none group hover:bg-slate-100/80 transition"
                  title="Sort by Store Name"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Business / Location</span>
                    {renderSortIcon("name")}
                  </div>
                </th>
                <th className="py-3.5 px-4">Owner Contact</th>
                <th
                  onClick={() => handleSort("plan_expires_at")}
                  className="py-3.5 px-4 cursor-pointer select-none group hover:bg-slate-100/80 transition"
                  title="Sort by Plan Expiration"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Plan & Status</span>
                    {renderSortIcon("plan_expires_at")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("products_count")}
                  className="py-3.5 px-4 text-right cursor-pointer select-none group hover:bg-slate-100/80 transition"
                  title="Sort by Products Count"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Products</span>
                    {renderSortIcon("products_count")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("total_sales_volume")}
                  className="py-3.5 px-4 text-right cursor-pointer select-none group hover:bg-slate-100/80 transition"
                  title="Sort by Platform GMV"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Platform GMV</span>
                    {renderSortIcon("total_sales_volume")}
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    Loading businesses directory...
                  </td>
                </tr>
              ) : businesses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    No businesses matching search criteria.
                  </td>
                </tr>
              ) : (
                businesses.map((biz) => {
                  const isPro = Boolean(biz.is_pro);
                  const isSuspended = Boolean(biz.is_suspended);
                  return (
                    <tr
                      key={biz.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSuspended ? "bg-rose-50/40" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-black text-ink">
                          <span>{biz.name}</span>
                          {isSuspended && (
                            <span
                              title={biz.suspension_reason || "Suspended by admin"}
                              className="inline-flex items-center gap-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.2 text-[9px] font-black uppercase"
                            >
                              Suspended
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {biz.location || "Location not set"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{biz.owner_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {biz.phone || biz.owner_email || "No contact"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                              isPro
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {isPro && <Crown className="h-3 w-3 text-amber-600" />}
                            {biz.plan_tier || "free"}
                          </span>
                        </div>
                        {biz.plan_expires_at ? (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Expires: {new Date(biz.plan_expires_at).toLocaleDateString()}
                          </div>
                        ) : isPro ? (
                          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                            Perpetual Pro
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                        {biz.products_count}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-ink">
                        {formatCurrency(biz.total_sales_volume || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Impersonate / Inspect Trigger */}
                          {onImpersonateStore && adminRole !== "billing" && (
                            <button
                              type="button"
                              onClick={() => handleImpersonate(biz)}
                              title="Inspect this store in read-only administrator mode"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-indigo-200 hover:border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition shadow-2xs"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Inspect</span>
                            </button>
                          )}

                          {/* Plan Override Trigger */}
                          {adminRole !== "support" && (
                            <button
                              type="button"
                              onClick={() => handleOpenOverride(biz)}
                              title="Override subscription tier or extend days"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-palm bg-slate-50 hover:bg-palm/5 text-slate-700 hover:text-palm text-[11px] font-bold transition shadow-2xs"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Plan</span>
                            </button>
                          )}

                          {/* Suspension Toggle Trigger */}
                          {adminRole !== "billing" && (
                            <button
                              type="button"
                              onClick={() => handleOpenSuspension(biz)}
                              title={isSuspended ? "Reactivate store account" : "Suspend store account"}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition shadow-2xs ${
                                isSuspended
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              }`}
                            >
                              {isSuspended ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Reactivate</span>
                                </>
                              ) : (
                                <>
                                  <Ban className="h-3 w-3" />
                                  <span>Suspend</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Status Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-800">{fromRecord}</strong> -{" "}
              <strong className="text-slate-800">{toRecord}</strong> of{" "}
              <strong className="text-slate-800">{totalCount}</strong> stores
            </span>
            <div className="hidden sm:inline-block h-3 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700 font-bold focus:outline-none focus:border-palm"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition shadow-2xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-2 text-xs font-bold text-slate-700">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition shadow-2xs"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Plan Override Slide-Over / Modal */}
      {targetBiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={handleCloseOverride}
          />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-ink">Subscription Plan Override</h3>
                <p className="text-xs text-slate-500">Store: {targetBiz.name}</p>
              </div>
              <button
                type="button"
                onClick={handleCloseOverride}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitOverride} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Plan Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {["pro", "enterprise", "free"].map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedPlan(tier)}
                      className={`py-2 px-3 rounded-xl border text-center font-bold capitalize transition ${
                        selectedPlan === tier
                          ? "border-palm bg-palm/10 text-palm"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              {selectedPlan !== "free" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Duration (Days)</label>
                    <span className="text-[10px] text-palm font-black">+{daysValid} Days</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[14, 30, 90, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDaysValid(d)}
                        className={`py-1.5 rounded-xl border text-xs font-bold transition ${
                          daysValid === d
                            ? "border-palm bg-palm text-white shadow-2xs"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        +{d}d
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={daysValid}
                    onChange={(e) => setDaysValid(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    placeholder="Custom days count"
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:border-palm"
                  />
                </div>
              )}

              {/* Live Expiration Preview */}
              {targetBiz && selectedPlan !== "free" && overrideBaseDate > 0 && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    <span>New Expiration Preview</span>
                  </div>
                  <p className="leading-relaxed">
                    Extending <strong>{targetBiz.name}</strong> on <strong>{selectedPlan.toUpperCase()}</strong> for{" "}
                    <strong>+{daysValid} days</strong>. New expiration date will be:{" "}
                    <strong className="underline decoration-amber-400">
                      {new Date(overrideBaseDate + daysValid * 86400000).toLocaleDateString()}
                    </strong>.
                  </p>
                </div>
              )}

              {/* Direct MoMo / Cash Revenue Input */}
              {selectedPlan !== "free" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Direct MoMo Amount Received (GH₵) &bull; Optional
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                      GH₵
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1000000"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder="e.g. 70.00 (credits platform revenue)"
                      className="w-full border border-slate-200 rounded-xl pl-12 pr-3 py-2 bg-slate-50 focus:outline-none focus:border-palm"
                    />
                  </div>
                  {Number(amountPaid) > 0 ? (
                    <div className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 p-2 rounded-xl flex items-center gap-1.5 mt-1.5">
                      <DollarSign className="h-3 w-3 text-emerald-600 shrink-0" />
                      <span>Will credit GH₵ {Number(amountPaid).toFixed(2)} to Platform Revenue ledger</span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Entering an amount automatically adds a record to platform revenue tracking.
                    </p>
                  )}
                </div>
              )}

              <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Reason / Payment Reference {Number(amountPaid) > 0 ? "(Required for payment)" : ""}
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Paid via MTN MoMo ref: 948194827"
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:border-palm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseOverride}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-palm hover:bg-palmDeep text-white font-black shadow-xs transition active:scale-95 disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Apply Plan Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Store Suspension / Reactivation Modal */}
      {suspensionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={handleCloseSuspension}
          />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`grid h-8 w-8 place-items-center rounded-xl ${
                    suspensionTarget.is_suspended
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {suspensionTarget.is_suspended ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <ShieldAlert className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-ink">
                    {suspensionTarget.is_suspended ? "Reactivate Store Account" : "Suspend Store Account"}
                  </h3>
                  <p className="text-xs text-slate-500">Store: {suspensionTarget.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseSuspension}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSuspension} className="space-y-4 text-xs">
              <p className="text-xs text-slate-600 leading-relaxed">
                {suspensionTarget.is_suspended
                  ? `Reactivating "${suspensionTarget.name}" will restore POS and dashboard access for all staff and owners immediately.`
                  : `Suspending "${suspensionTarget.name}" will immediately block store owners and cashiers from ringing sales or opening the store dashboard.`}
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {suspensionTarget.is_suspended ? "Reactivation Note (Optional)" : "Reason for Suspension"}
                </label>
                <textarea
                  rows={2}
                  required={!suspensionTarget.is_suspended}
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder={
                    suspensionTarget.is_suspended
                      ? "e.g. Account dispute resolved"
                      : "e.g. Violation of Terms / Non-payment / Fraud investigation"
                  }
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:border-palm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseSuspension}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={suspensionSubmitting}
                  className={`px-4 py-2 rounded-xl text-white font-black shadow-xs transition active:scale-95 disabled:opacity-60 ${
                    suspensionTarget.is_suspended
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {suspensionSubmitting
                    ? "Updating..."
                    : suspensionTarget.is_suspended
                    ? "Confirm Reactivation"
                    : "Confirm Suspension"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

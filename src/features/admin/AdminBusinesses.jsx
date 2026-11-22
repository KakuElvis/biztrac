import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Crown,
  Calendar,
  Building2,
  Phone,
  Mail,
  Edit3,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { formatCurrency } from "../../lib/formatters.js";
import { listAdminBusinesses, overrideBusinessPlan } from "../../services/adminService.js";
import { showToast } from "../../lib/toast.js";

export function AdminBusinesses() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  // Plan Override Modal State
  const [targetBiz, setTargetBiz] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [daysValid, setDaysValid] = useState(30);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchBusinesses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAdminBusinesses({
        search,
        planFilter,
        limit: 50,
      });
      setBusinesses(data);
    } catch (err) {
      console.error("[AdminBusinesses] Failed to load businesses:", err);
      showToast(err.message || "Failed to load businesses", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [search, planFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBusinesses();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchBusinesses]);

  const handleOpenOverride = (biz) => {
    setTargetBiz(biz);
    setSelectedPlan(biz.plan_tier === "enterprise" ? "enterprise" : "pro");
    setDaysValid(30);
    setReason("");
  };

  const handleCloseOverride = () => {
    setTargetBiz(null);
    setReason("");
  };

  const handleSubmitOverride = async (e) => {
    e.preventDefault();
    if (!targetBiz) return;

    try {
      setSubmitting(true);
      await overrideBusinessPlan(targetBiz.id, {
        planTier: selectedPlan,
        daysValid: Number(daysValid),
        reason: reason.trim() || `Manual admin update: ${selectedPlan}`,
      });

      showToast(`Updated plan for ${targetBiz.name} to ${selectedPlan.toUpperCase()}.`, {
        type: "success",
      });

      handleCloseOverride();
      fetchBusinesses();
    } catch (err) {
      console.error("[AdminBusinesses] Override error:", err);
      showToast(err.message || "Failed to update business plan", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by store name, phone, email, owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-palm"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
          {[
            { id: "all", label: "All Stores" },
            { id: "pro", label: "Pro Active" },
            { id: "free", label: "Free Tier" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPlanFilter(tab.id)}
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
      </div>

      {/* Businesses Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Business / Location</th>
                <th className="py-3.5 px-4">Owner Contact</th>
                <th className="py-3.5 px-4">Current Plan</th>
                <th className="py-3.5 px-4 text-right">Products</th>
                <th className="py-3.5 px-4 text-right">Platform GMV</th>
                <th className="py-3.5 px-4 text-center">Action</th>
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
                  return (
                    <tr key={biz.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-black text-ink">{biz.name}</div>
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
                          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Perpetual Pro</div>
                        ) : null}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                        {biz.products_count}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-ink">
                        {formatCurrency(biz.total_sales_volume || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenOverride(biz)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-palm bg-slate-50 hover:bg-palm/5 text-slate-700 hover:text-palm text-[11px] font-bold transition shadow-2xs"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Plan</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
                  <label className="block font-bold text-slate-700 mb-1">Duration (Days)</label>
                  <div className="flex gap-2">
                    {[30, 90, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDaysValid(d)}
                        className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition ${
                          daysValid === d
                            ? "border-palm bg-palm text-white"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        +{d} Days
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason / Payment Reference
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
    </div>
  );
}

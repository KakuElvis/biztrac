import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  DollarSign,
  Ban,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Download,
} from "lucide-react";
import { getAdminAuditLogs, exportAuditLogsCsv } from "../../services/adminService.js";
import { formatCurrency } from "../../lib/formatters.js";
import { showToast } from "../../lib/toast.js";

const FILTER_TABS = [
  { id: "all", label: "All Events" },
  { id: "overrides", label: "Plan Overrides" },
  { id: "suspensions", label: "Suspensions & Reactivations" },
];

export function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * pageSize;
      const data = await getAdminAuditLogs({
        actionFilter,
        limit: pageSize,
        offset,
      });

      setLogs(data);
      setTotalCount(data.totalCount ?? data.length);
    } catch (err) {
      console.error("[AdminAuditLogs] Failed to load logs:", err);
      showToast(err.message || "Failed to load audit logs", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [actionFilter, page, pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (filterId) => {
    setActionFilter(filterId);
    setPage(1);
  };

  const handleExportCsv = () => {
    try {
      if (!logs.length) {
        showToast("No audit logs available to export", { type: "info" });
        return;
      }
      exportAuditLogsCsv(logs);
      showToast("Audit logs exported to CSV", { type: "success" });
    } catch (err) {
      console.error("[AdminAuditLogs] Export CSV error:", err);
      showToast(err.message || "Failed to export audit logs", { type: "error" });
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const fromRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, totalCount);

  const renderActionBadge = (action) => {
    switch (action) {
      case "MANUAL_PLAN_OVERRIDE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
            <Sparkles className="h-2.5 w-2.5 text-purple-600" />
            Plan Override
          </span>
        );
      case "SUSPEND_STORE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
            <Ban className="h-2.5 w-2.5 text-rose-600" />
            Suspension
          </span>
        );
      case "REACTIVATE_STORE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
            Reactivation
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
            <Shield className="h-2.5 w-2.5 text-slate-500" />
            {action}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header and Controls */}
      <div className="p-5 sm:p-6 border-b border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-ink">Platform Audit Log</h3>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-md text-[10px] uppercase">
                Immutable
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cryptographically recorded super admin interventions, manual MoMo overrides, and store suspensions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || logs.length === 0}
              title="Export audit logs to CSV"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl border border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 font-bold text-xs shadow-2xs transition active:scale-95 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              title="Refresh timeline"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl border border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 font-bold text-xs shadow-2xs transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1.5 rounded-xl text-xs">
              {totalCount} Total Events
            </span>
          </div>
        </div>

        {/* Action Type Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <Filter className="h-3.5 w-3.5 text-slate-400 mr-1 shrink-0" />
          {FILTER_TABS.map((tab) => {
            const isActive = actionFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleFilterChange(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                  isActive
                    ? "bg-palm text-white shadow-palm/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Audit Log Timeline */}
      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-bold text-xs">
            Loading audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-bold text-xs">
            No audit events found for this filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const meta = log.metadata || {};
              const amountPaid = Number(meta.amount_paid) || 0;

              return (
                <div
                  key={log.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 -mx-3 px-3 rounded-2xl transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderActionBadge(log.action)}
                      <span className="font-bold text-xs text-slate-900">
                        Target: <span className="text-ink">{log.target_business_name || log.target_business_id}</span>
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2.5">
                      {meta.plan_tier && (
                        <span className="font-semibold text-palm bg-palm/5 px-2 py-0.5 rounded-md border border-palm/20">
                          Tier: {meta.plan_tier.toUpperCase()}
                        </span>
                      )}
                      {meta.days_valid && (
                        <span className="text-slate-500 font-medium">
                          Duration: +{meta.days_valid} days
                        </span>
                      )}
                      {amountPaid > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                          <DollarSign className="h-3 w-3 text-emerald-600" />
                          Paid: {formatCurrency(amountPaid)}
                        </span>
                      )}
                      {(meta.reason || meta.suspension_reason) && (
                        <span className="italic text-slate-500">
                          Note: "{meta.reason || meta.suspension_reason}"
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between text-[11px] font-mono text-slate-400 shrink-0">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-300" />
                      <span>{new Date(log.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination & Status Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="text-slate-700">{fromRecord}</strong> to{" "}
            <strong className="text-slate-700">{toRecord}</strong> of{" "}
            <strong className="text-slate-700">{totalCount}</strong> events
          </span>
          <span className="text-slate-300">|</span>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-400">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700 outline-none focus:border-palm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            aria-label="Previous Page"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 shadow-2xs transition"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </button>
          <span className="px-2 font-mono font-bold text-slate-600">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            aria-label="Next Page"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 shadow-2xs transition"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

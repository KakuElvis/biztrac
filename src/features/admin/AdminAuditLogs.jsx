import { useState, useEffect } from "react";
import { History, Shield, Clock, FileText, CheckCircle2 } from "lucide-react";
import { getAdminAuditLogs } from "../../services/adminService.js";
import { showToast } from "../../lib/toast.js";

export function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getAdminAuditLogs({ limit: 50 })
      .then((data) => {
        if (isMounted) setLogs(data);
      })
      .catch((err) => {
        console.error("[AdminAuditLogs] Failed to load logs:", err);
        showToast("Failed to load audit logs", { type: "error" });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-ink">Platform Audit Log</h3>
          <p className="text-xs text-slate-500">
            Immutable, cryptographically recorded super admin interventions and plan overrides.
          </p>
        </div>
        <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-xl text-xs">
          {logs.length} Logged Events
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 font-bold text-xs">
          Loading audit logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center text-slate-400 font-bold text-xs">
          No audit logs recorded yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {logs.map((log) => {
            const meta = log.metadata || {};
            return (
              <div key={log.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                      {log.action}
                    </span>
                    <span className="font-bold text-xs text-slate-800">
                      Target: {log.target_business_name || log.target_business_id}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-2">
                    {meta.plan_tier && (
                      <span className="font-semibold text-palm">
                        Tier: {meta.plan_tier.toUpperCase()}
                      </span>
                    )}
                    {meta.days_valid && (
                      <span>Duration: +{meta.days_valid} days</span>
                    )}
                    {meta.reason && (
                      <span className="italic">Note: "{meta.reason}"</span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-400 sm:text-right shrink-0">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

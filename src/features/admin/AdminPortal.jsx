import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  BarChart3,
  Building2,
  History,
  ArrowLeft,
  Sparkles,
  Lock,
  LogOut,
  Megaphone,
} from "lucide-react";
import { AdminOverview } from "./AdminOverview.jsx";
import { AdminBusinesses } from "./AdminBusinesses.jsx";
import { AdminAuditLogs } from "./AdminAuditLogs.jsx";
import { AdminAnnouncements } from "./AdminAnnouncements.jsx";
import {
  checkIsSuperAdmin,
  getAdminDashboardStats,
  getAdminRole,
} from "../../services/adminService.js";
import { showToast } from "../../lib/toast.js";

export function AdminPortal({
  onExitAdmin,
  onSignOut,
  onImpersonateStore,
  hasStore = false,
}) {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "businesses" | "announcements" | "audit"
  const [isSuperAdmin, setIsSuperAdmin] = useState(null);
  const [adminRole, setAdminRole] = useState("none");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalError, setPortalError] = useState("");

  const loadPortalData = useCallback(async () => {
    try {
      setLoading(true);
      setPortalError("");
      const isAuthorized = await checkIsSuperAdmin();
      setIsSuperAdmin(isAuthorized);

      if (isAuthorized) {
        const [statsData, roleData] = await Promise.all([
          getAdminDashboardStats(),
          getAdminRole(),
        ]);
        setStats(statsData);
        setAdminRole(roleData || "none");
      }
    } catch (err) {
      console.error("[AdminPortal] Initialization error:", err);
      setPortalError(err.message || "Could not verify admin access or load portal data.");
      showToast(err.message || "Failed to initialize Admin Portal", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-10 w-10 border-3 border-palm border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-600">Verifying super-admin credentials...</p>
      </div>
    );
  }

  if (isSuperAdmin === false || adminRole === "none") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 bg-rose-100 text-rose-600 rounded-3xl grid place-items-center mb-4 shadow-sm">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-ink mb-1">
          {isSuperAdmin ? "Admin Role Could Not Be Verified" : "Access Restricted"}
        </h2>
        <p className="text-sm text-slate-500 max-w-md mb-6 font-medium">
          {isSuperAdmin
            ? portalError || "The admin role service did not return a valid role. Retry after checking the connection."
            : "Your account is not registered in the platform admin directory. Regular store owners and cashiers cannot access this area."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {isSuperAdmin ? (
            <button type="button" onClick={loadPortalData} className="px-5 py-2.5 rounded-xl bg-purple-700 text-white font-bold text-xs">
              Retry verification
            </button>
          ) : null}
          {onExitAdmin ? (
            <button
              type="button"
              onClick={onExitAdmin}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ink hover:bg-slate-900 text-white font-bold text-xs shadow-xs transition active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" /> Return to Store Dashboard
            </button>
          ) : null}
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 font-bold text-xs shadow-xs transition active:scale-95"
            >
              <LogOut className="h-4 w-4" /> Sign In as Super Admin
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-800">
      {/* Top Super Admin Navigation Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-purple-700 to-indigo-600 text-white shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-ink tracking-tight">BizPurse Super Admin</h1>
                <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  {adminRole.replace("_", " ")}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Tenant Directory & Billing Controls</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasStore && onExitAdmin ? (
              <button
                type="button"
                onClick={onExitAdmin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs bg-slate-50 hover:bg-slate-100 transition shadow-2xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Shop</span>
              </button>
            ) : null}
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 hover:border-rose-300 text-rose-700 hover:text-rose-800 font-bold text-xs bg-rose-50 hover:bg-rose-100 transition shadow-2xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Tab Switcher Toolbar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-2 border-t border-slate-100 overflow-x-auto py-1">
          {[
            { id: "overview", label: "Executive Overview", icon: BarChart3 },
            { id: "businesses", label: "Tenant Directory", icon: Building2 },
            ...(adminRole === "super_admin" ? [{ id: "announcements", label: "Broadcasts", icon: Megaphone }] : []),
            { id: "audit", label: "Audit Timeline", icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-black transition-all whitespace-nowrap ${
                  isActive
                    ? "border-purple-600 text-purple-700 bg-purple-50/50"
                    : "border-transparent text-slate-500 hover:text-ink hover:bg-slate-50"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-purple-600" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {activeTab === "overview" && (
          <AdminOverview stats={stats} onNavigateTab={setActiveTab} />
        )}
        {activeTab === "businesses" && (
          <AdminBusinesses onImpersonateStore={onImpersonateStore} adminRole={adminRole} />
        )}
        {activeTab === "announcements" && adminRole === "super_admin" && <AdminAnnouncements />}
        {activeTab === "audit" && <AdminAuditLogs />}
      </main>
    </div>
  );
}

export default AdminPortal;

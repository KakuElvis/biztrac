import { useEffect, useState, useCallback, useRef, Suspense, lazy } from "react";
import { Lock, Megaphone, X } from "lucide-react";
import { AppLogo } from "./components/common/AppLogo.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";
import { ErrorBoundary } from "./components/common/ErrorBoundary.jsx";
import { usePlan } from "./hooks/usePlan.js";
import { UpgradeModal } from "./components/subscription/UpgradeModal.jsx";
import { ProGate } from "./components/common/ProGate.jsx";
import { PRO_FEATURES } from "./lib/plans.js";
import { AuthScreen, PasswordRecoveryScreen } from "./features/auth/AuthScreen.jsx";
import { getRepository } from "./services/repositories/dataRepository.js";
import { useAuthSession } from "./hooks/useAuthSession.js";
import { useInventory } from "./hooks/useInventory.js";
import { useCustomers } from "./hooks/useCustomers.js";
import { useExpenses } from "./hooks/useExpenses.js";
import { useAnalytics } from "./hooks/useAnalytics.js";
import { useOfflineSync } from "./hooks/useOfflineSync.js";
import { usePWA } from "./hooks/usePWA.js";
import { handleBackPop, clearBackStack } from "./services/navigation/backStackService.js";
import { useBackButtonModal } from "./hooks/useBackButtonModal.js";
import { showToast } from "./lib/toast.js";
import { usePermissions } from "./features/staff/index.js";
import { checkIsSuperAdmin } from "./services/adminService.js";
import { getActiveAnnouncements, dismissAnnouncement } from "./services/announcementService.js";

const Dashboard = lazy(() => import("./features/dashboard/Dashboard.jsx").then((m) => ({ default: m.Dashboard || m.default })));
const Inventory = lazy(() => import("./features/inventory/Inventory.jsx").then((m) => ({ default: m.Inventory || m.default })));
const Sales = lazy(() => import("./features/sales/Sales.jsx").then((m) => ({ default: m.Sales || m.default })));
const Expenses = lazy(() => import("./features/expenses/Expenses.jsx").then((m) => ({ default: m.Expenses || m.default })));
const Reports = lazy(() => import("./features/reports/Reports.jsx").then((m) => ({ default: m.Reports || m.default })));
const More = lazy(() => import("./features/settings/More.jsx").then((m) => ({ default: m.More || m.default })));
const Customers = lazy(() => import("./features/customers/Customers.jsx").then((m) => ({ default: m.Customers || m.default })));
const Invoices = lazy(() => import("./features/invoices/Invoices.jsx").then((m) => ({ default: m.Invoices || m.default })));
const AdminPortal = lazy(() => import("./features/admin/AdminPortal.jsx").then((m) => ({ default: m.AdminPortal || m.default })));
const AdminLoginScreen = lazy(() => import("./features/admin/AdminLoginScreen.jsx").then((m) => ({ default: m.AdminLoginScreen || m.default })));

const screens = {
  dashboard: Dashboard,
  customers: Customers,
  sales: Sales,
  inventory: Inventory,
  reports: Reports,
  expenses: Expenses,
  invoices: Invoices,
  more: More,
  admin: AdminPortal,
};

const CASHIER_RESTRICTED_SCREENS = ["inventory", "reports", "expenses", "invoices", "more"];

function getScreenFromUrl() {
  if (typeof window === "undefined") return "dashboard";
  if (window.location.pathname.startsWith("/admin")) return "admin";
  const params = new URLSearchParams(window.location.search);
  const screenParam = params.get("screen");
  if (screenParam === "admin") return "admin";
  return screenParam && screens[screenParam] ? screenParam : "dashboard";
}

export default function App() {
  const { canInstall, isInstalled, isIOS, needRefresh, offlineReady, installApp, updateApp } = usePWA();
  const pwaState = {
    canInstall,
    isInstalled,
    isIOS,
    needRefresh,
    offlineReady,
    onInstallPwa: installApp,
    onUpdatePwa: updateApp,
  };
  const {
    session,
    workspace,
    setWorkspace,
    workspaceLoading,
    isLoading,
    isRecoveringPassword,
    setIsRecoveringPassword,
    business,
    handleSignOut: authSignOut,
  } = useAuthSession();

  const [activeScreen, setActiveScreen] = useState(getScreenFromUrl);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const plan = usePlan(business);

  const handlePlanUpdated = (updatedBusiness) => {
    setWorkspace((prev) => (prev ? { ...prev, business: updatedBusiness } : prev));
  };
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [previewRole, setPreviewRole] = useState(null);
  const lastBackPressRef = useRef(0);

  const permissions = usePermissions(workspace?.role, previewRole);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const isCashier = Boolean(session && permissions?.isCashier && !isSuperAdmin && workspace?.business);

  // System Broadcast Announcements
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    let isMounted = true;
    if (session && !isSuperAdmin) {
      getActiveAnnouncements()
        .then((data) => {
          if (isMounted) setAnnouncements(data);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [session, isSuperAdmin]);

  useEffect(() => {
    let isMounted = true;
    if (session?.user && !session.isStaffSession) {
      checkIsSuperAdmin()
        .then((res) => {
          if (isMounted) {
            const isSuper = Boolean(res);
            setIsSuperAdmin(isSuper);
            if (isSuper) {
              if (
                !workspace?.business ||
                (typeof window !== "undefined" && window.location.pathname.startsWith("/admin"))
              ) {
                setActiveScreen("admin");
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.pathname = "/admin";
                  url.searchParams.delete("screen");
                  window.history.replaceState({ screen: "admin" }, "", url.toString());
                }
              }
            }
          }
        })
        .catch(() => {
          if (isMounted) setIsSuperAdmin(false);
        });
    } else {
      setIsSuperAdmin(false);
    }
    return () => {
      isMounted = false;
    };
  }, [session, workspace]);

  // Hook password recovery screen into the back stack
  useBackButtonModal(
    isRecoveringPassword,
    () => setIsRecoveringPassword(false),
    "password-recovery"
  );

  const businessId = workspace?.business?.id;
  const repository = getRepository();

  const handleNavigate = useCallback((nextScreen, { replace = false } = {}) => {
    if (!screens[nextScreen]) return;

    if (session && nextScreen === "admin" && !isSuperAdmin) {
      showToast("Access restricted: Super admin credentials required.", { type: "warn" });
      return;
    }

    if (session && isCashier && CASHIER_RESTRICTED_SCREENS.includes(nextScreen)) {
      showToast("Access restricted. This section is only available to store owners and managers.", {
        type: "info",
      });
      return;
    }

    setActiveScreen(nextScreen);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (nextScreen === "admin") {
        url.pathname = "/admin";
        url.searchParams.delete("screen");
      } else {
        if (url.pathname.startsWith("/admin")) {
          url.pathname = "/";
        }
        url.searchParams.set("screen", nextScreen);
      }

      if (replace) {
        window.history.replaceState({ screen: nextScreen }, "", url.toString());
      } else {
        window.history.pushState({ screen: nextScreen }, "", url.toString());
      }
    }
  }, [isCashier, isSuperAdmin, session]);

  // Guard activeScreen: immediately bounce cashier away if currently on a restricted screen
  useEffect(() => {
    if (session && isCashier && CASHIER_RESTRICTED_SCREENS.includes(activeScreen)) {
      showToast("Access restricted. Redirecting to Sales.", { type: "info" });
      handleNavigate("sales", { replace: true });
    }
  }, [session, isCashier, activeScreen, handleNavigate]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    // Initialize history state with current screen
    const current = getScreenFromUrl();
    const url = new URL(window.location.href);
    if (current === "admin") {
      url.pathname = "/admin";
      url.searchParams.delete("screen");
    } else {
      url.searchParams.set("screen", current);
    }
    window.history.replaceState({ screen: current }, "", url.toString());

    const handlePopState = (event) => {
      // 1. Check if an active modal or drawer was open and consume the back press
      const modalHandled = handleBackPop();
      if (modalHandled) {
        return; // Overlay was dismissed, stay on current screen
      }

      // 2. Read target screen from history state or URL parameter
      const screenFromState = event.state?.screen;
      const screenFromUrl = new URLSearchParams(window.location.search).get("screen");
      const target = screenFromState || screenFromUrl || "dashboard";

      // 3. Android back press double-tap protection on root Dashboard
      const isMobileDevice =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        window.matchMedia("(display-mode: standalone)").matches;

      if (activeScreen === "dashboard" && target === "dashboard" && isMobileDevice) {
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          // Double press confirmed: allow native browser/PWA exit
          return;
        }

        // First press: retain trap and show toast warning
        lastBackPressRef.current = now;
        window.history.pushState({ screen: "dashboard" }, "", url.toString());
        showToast("Press back again to exit BizPurse", { type: "info", duration: 2000 });
        return;
      }

      if (isCashier && CASHIER_RESTRICTED_SCREENS.includes(target)) {
        setActiveScreen("sales");
        return;
      }

      if (session && target === "admin" && !isSuperAdmin) {
        setActiveScreen("dashboard");
        return;
      }

      if (screens[target]) {
        setActiveScreen(target);
      } else {
        setActiveScreen("dashboard");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeScreen, isCashier, isSuperAdmin, session]);

  const {
    products,
    setProducts,
    productsLoading,
    productsError,
    catalogProducts,
    catalogLoading,
    setCatalogProducts,
    categories,
    categoriesLoading,
    categoriesError,
    lowStockCount,
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setPageSize,
    handleCreateProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleRestockProduct,
    fetchProductRestocks,
    handleCreateCategory,
    resetInventory,
  } = useInventory(repository, businessId);

  const {
    dashboardSummary,
    dashboardLoading,
    dashboardError,
    reportSummary,
    reportsLoading,
    reportsError,
    reportRange,
    setReportRange,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    refreshReport,
    fetchProductStockTimeline,
    refreshAnalytics,
    resetAnalytics,
  } = useAnalytics(repository, businessId, permissions.canViewProfit);

  const {
    customers,
    setCustomers,
    customersLoading,
    customersError,
    handleCreateCustomer,
    handleUpdateCustomer,
    fetchCustomerDetails,
    handlePayDebt,
    handleForgiveDebt,
    resetCustomers,
  } = useCustomers(repository, businessId, refreshAnalytics);

  const {
    expenses,
    expensesLoading,
    expensesError,
    handleCreateExpense,
    resetExpenses,
  } = useExpenses(repository, businessId, session?.user?.id, refreshAnalytics);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function handleResetAll() {
    clearBackStack();
    resetInventory();
    resetCustomers();
    resetExpenses();
    resetAnalytics();
    handleNavigate("dashboard", { replace: true });
  }

  const handleSignOut = () => authSignOut(handleResetAll);

  const handleUpdateBusinessProfile = async (nextBusiness) => {
    if (!workspace?.business?.id) return;
    const updated = await repository.updateBusiness(workspace.business.id, nextBusiness);
    if (updated) {
      setWorkspace((prev) => (prev ? { ...prev, business: updated } : prev));
    }
    return updated;
  };

  const handleCompleteSale = async ({ customer, lines, paymentType, amountPaid, dueDate, notes, clientSaleId, queuedBusinessId }) => {
    if (queuedBusinessId && queuedBusinessId !== businessId) {
      throw new Error("This offline sale belongs to a different business. Switch to that business to sync it.");
    }
    const result = await repository.completeSale(businessId, {
      customer,
      lines,
      paymentType,
      amountPaid,
      dueDate,
      notes,
      clientSaleId,
    });

    setProducts((current) =>
      current.map((product) => {
        const updated = result.updatedProducts.find((item) => item.id === product.id);
        return updated || product;
      })
    );
    setCatalogProducts((current) =>
      current.map((product) => {
        const updated = result.updatedProducts.find((item) => item.id === product.id);
        return updated || product;
      })
    );

    if (result.customer) {
      setCustomers((current) => {
        const exists = current.some((customerItem) => customerItem.id === result.customer.id);
        if (exists) {
          return current.map((customerItem) =>
            customerItem.id === result.customer.id ? result.customer : customerItem
          );
        }
        return [...current, result.customer].sort((a, b) => a.name.localeCompare(b.name));
      });
    }

    await refreshAnalytics(businessId);

    return { reference: result.sale.reference, sale: result.sale };
  };

  const handleSyncComplete = useCallback(async () => {
    try {
      const updatedProducts = await repository.listProducts(businessId);
      if (Array.isArray(updatedProducts)) {
        setProducts(updatedProducts);
      }
    } catch {
      // Ignore background refetch error
    }
    await refreshAnalytics(businessId);
  }, [repository, businessId, setProducts, refreshAnalytics]);

  const {
    queuedCount,
    conflictedCount,
    conflictedSales,
    isSyncing,
    refreshQueueCount,
    triggerSync,
    dismissConflicted,
    dismissAllConflicted,
    retryConflicted,
  } = useOfflineSync(
    handleCompleteSale,
    isOnline,
    handleSyncComplete,
    businessId
  );

  if (isLoading || (session && workspaceLoading)) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-4">
        <div className="flex flex-col items-center gap-4 rounded-[1.75rem] border border-slate-200 bg-white px-8 py-8 shadow-soft">
          <AppLogo
            showText={false}
            imageClassName="h-16 w-16 rounded-3xl object-cover shadow-lg shadow-palm/20"
          />
          <p className="text-sm font-bold text-palm">
            {isLoading ? "Opening BizPurse" : "Loading your workspace"}
          </p>
        </div>
      </main>
    );
  }

  if (isRecoveringPassword) {
    return <PasswordRecoveryScreen onComplete={() => setIsRecoveringPassword(false)} />;
  }

  if (!session) {
    const isPathAdmin =
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/admin") ||
        new URLSearchParams(window.location.search).get("screen") === "admin");
    if (activeScreen === "admin" || isPathAdmin) {
      return (
        <Suspense
          fallback={
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-400">
              <div className="h-10 w-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Opening Admin Console...
              </p>
            </div>
          }
        >
          <AdminLoginScreen
            onSwitchToMerchant={() => {
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.pathname = "/";
                url.searchParams.delete("screen");
                window.history.pushState({ screen: "dashboard" }, "", url.toString());
              }
              setActiveScreen("dashboard");
            }}
            onLoginSuccess={() => {
              setActiveScreen("admin");
            }}
          />
        </Suspense>
      );
    }

    return (
      <AuthScreen
        onSwitchToAdmin={() => {
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.pathname = "/admin";
            url.searchParams.delete("screen");
            window.history.pushState({ screen: "admin" }, "", url.toString());
          }
          setActiveScreen("admin");
        }}
      />
    );
  }

  if (activeScreen === "admin" || (isSuperAdmin && !workspace?.business)) {
    return (
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-600">
              <div className="h-10 w-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Loading Platform Console...
              </p>
            </div>
          }
        >
          <AdminPortal
            currentUser={session?.user}
            hasStore={Boolean(workspace?.business)}
            onExitAdmin={() => handleNavigate("dashboard")}
            onSignOut={() => {
              authSignOut(() => {
                setActiveScreen("admin");
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.pathname = "/admin";
                  url.searchParams.delete("screen");
                  window.history.replaceState({ screen: "admin" }, "", url.toString());
                }
              });
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (business?.is_suspended && !isSuperAdmin) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-4">
          <div className="mx-auto h-16 w-16 bg-rose-100 text-rose-600 rounded-3xl grid place-items-center shadow-xs">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-ink">Store Account Suspended</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {business.name ? `"${business.name}"` : "This store account"} has been temporarily suspended by the platform administrator.
            {business.suspension_reason ? ` Reason: ${business.suspension_reason}` : ""}
          </p>
          <p className="text-[11px] text-slate-400">
            Please contact BizPurse support to resolve this account suspension.
          </p>
          <button
            type="button"
            onClick={() => authSignOut()}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
          >
            Sign Out
          </button>
        </div>
      </main>
    );
  }

  const Screen = screens[activeScreen] ?? Dashboard;

  return (
    <>
      {/* Merchant System Announcements Banner */}
      {announcements.map((ann) => (
        <div
          key={ann.id}
          className={`px-4 py-2 text-xs font-bold flex items-center justify-between gap-3 shadow-2xs ${
            ann.level === "critical"
              ? "bg-rose-600 text-white"
              : ann.level === "warning"
              ? "bg-amber-500 text-slate-950"
              : "bg-sky-600 text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 shrink-0" />
            <span>
              <strong>{ann.title}:</strong> {ann.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              dismissAnnouncement(ann.id);
              setAnnouncements((prev) => prev.filter((a) => a.id !== ann.id));
            }}
            className="p-1 rounded-lg hover:bg-black/20 text-current transition shrink-0"
            title="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <AppShell
        activeScreen={activeScreen}
        business={business}
      lowStockCount={lowStockCount}
      isOnline={isOnline}
      onNavigate={handleNavigate}
      onSignOut={handleSignOut}
      queuedCount={queuedCount}
      conflictedCount={conflictedCount}
      conflictedSales={conflictedSales}
      onDismissConflicted={dismissAllConflicted}
      onRetryConflicted={retryConflicted}
      onDismissSingleConflicted={dismissConflicted}
      isSyncing={isSyncing}
      onTriggerSync={triggerSync}
      pwaState={pwaState}
      permissions={permissions}
      previewRole={previewRole}
      onSetPreviewRole={setPreviewRole}
      plan={plan}
      onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
      isSuperAdmin={isSuperAdmin}
    >
      <ErrorBoundary>
        <Suspense fallback={<div className="p-6">Loading...</div>}>
          {activeScreen === "invoices" && !plan.canAccess(PRO_FEATURES.INVOICING) ? (
            <ProGate
              business={business}
              feature={PRO_FEATURES.INVOICING}
              onUpgrade={() => setIsUpgradeModalOpen(true)}
            />
          ) : (
            <Screen
          business={business}
          plan={plan}
          onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
          onExitAdmin={() => handleNavigate("dashboard")}
          currentUser={session?.user}
          permissions={permissions}
          previewRole={previewRole}
          onSetPreviewRole={setPreviewRole}
          canDeleteProducts={permissions.canDeleteProducts}
          canManageCategories={permissions.canManageCategories}
          canForgiveDebt={permissions.canForgiveDebt}
          canViewProfit={permissions.canViewProfit}
          canViewCostPrice={permissions.canViewCostPrice}
          canManageSettings={permissions.canManageSettings}
          canManageStaff={permissions.canManageStaff}
          canRestock={permissions.canRestock}
          canCreateProduct={permissions.canCreateProduct}
          canEditProduct={permissions.canEditProduct}
          canViewFinancialReports={permissions.canViewFinancialReports}
          isCashier={permissions.isCashier}
          categories={categories}
          categoriesError={categoriesError}
          categoriesLoading={categoriesLoading}
          customers={customers}
          customersError={customersError}
          customersLoading={customersLoading}
          onForgiveDebt={handleForgiveDebt}
          dashboardError={dashboardError}
          dashboardLoading={dashboardLoading}
          dashboardSummary={dashboardSummary}
          expenses={expenses}
          expensesError={expensesError}
          expensesLoading={expensesLoading}
          onCreateExpense={handleCreateExpense}
          onCreateProduct={handleCreateProduct}
          onDeleteProduct={handleDeleteProduct}
          onCompleteSale={handleCompleteSale}
          onCreateCategory={handleCreateCategory}
          onUpdateBusiness={handleUpdateBusinessProfile}
          products={activeScreen === "sales" ? (catalogProducts && catalogProducts.length ? catalogProducts : products) : products}
          productsError={productsError}
          productsLoading={activeScreen === "sales" ? (catalogLoading && !catalogProducts.length) : productsLoading}
          reportSummary={reportSummary}
          reportRange={reportRange}
          reportStartDate={reportStartDate}
          reportEndDate={reportEndDate}
          onReportRangeChange={setReportRange}
          onReportStartDateChange={setReportStartDate}
          onReportEndDateChange={setReportEndDate}
          onRefreshReport={refreshReport}
          reportsError={reportsError}
          reportsLoading={reportsLoading}
          setProducts={setProducts}
          onUpdateProduct={handleUpdateProduct}
          onRestockProduct={handleRestockProduct}
          onFetchProductRestocks={fetchProductRestocks}
          onFetchProductStockTimeline={fetchProductStockTimeline}
          onUpdateCustomer={handleUpdateCustomer}
          onFetchCustomerDetails={fetchCustomerDetails}
          onCreateCustomer={handleCreateCustomer}
          onPayDebt={handlePayDebt}
          onNavigate={handleNavigate}
          onSignOut={handleSignOut}
          queuedCount={queuedCount}
          isSyncing={isSyncing}
          onTriggerSync={triggerSync}
          onRefreshQueueCount={refreshQueueCount}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pwaState={pwaState}
        />
          )}
        </Suspense>
      </ErrorBoundary>
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        business={business}
        onPlanUpdated={handlePlanUpdated}
      />
    </AppShell>
    </>
  );
}

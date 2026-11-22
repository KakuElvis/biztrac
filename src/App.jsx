import { useEffect, useState, useCallback, useRef, Suspense, lazy } from "react";
import { AppLogo } from "./components/common/AppLogo.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";
import { ErrorBoundary } from "./components/common/ErrorBoundary.jsx";
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

const Dashboard = lazy(() => import("./features/dashboard/Dashboard.jsx").then((m) => ({ default: m.Dashboard || m.default })));
const Inventory = lazy(() => import("./features/inventory/Inventory.jsx").then((m) => ({ default: m.Inventory || m.default })));
const Sales = lazy(() => import("./features/sales/Sales.jsx").then((m) => ({ default: m.Sales || m.default })));
const Expenses = lazy(() => import("./features/expenses/Expenses.jsx").then((m) => ({ default: m.Expenses || m.default })));
const Reports = lazy(() => import("./features/reports/Reports.jsx").then((m) => ({ default: m.Reports || m.default })));
const More = lazy(() => import("./features/settings/More.jsx").then((m) => ({ default: m.More || m.default })));
const Customers = lazy(() => import("./features/customers/Customers.jsx").then((m) => ({ default: m.Customers || m.default })));
const Invoices = lazy(() => import("./features/invoices/Invoices.jsx").then((m) => ({ default: m.Invoices || m.default })));

const screens = {
  dashboard: Dashboard,
  customers: Customers,
  sales: Sales,
  inventory: Inventory,
  reports: Reports,
  expenses: Expenses,
  invoices: Invoices,
  more: More,
};

const CASHIER_RESTRICTED_SCREENS = ["inventory", "reports", "expenses", "invoices", "more"];

function getScreenFromUrl() {
  if (typeof window === "undefined") return "dashboard";
  const params = new URLSearchParams(window.location.search);
  const screenParam = params.get("screen");
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
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [previewRole, setPreviewRole] = useState(null);
  const lastBackPressRef = useRef(0);

  const permissions = usePermissions(workspace?.role, previewRole);
  const isCashier = Boolean(permissions?.isCashier);

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

    if (isCashier && CASHIER_RESTRICTED_SCREENS.includes(nextScreen)) {
      showToast("Access restricted. This section is only available to store owners and managers.", {
        type: "info",
      });
      return;
    }

    setActiveScreen(nextScreen);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("screen", nextScreen);

      if (replace) {
        window.history.replaceState({ screen: nextScreen }, "", url.toString());
      } else {
        window.history.pushState({ screen: nextScreen }, "", url.toString());
      }
    }
  }, [isCashier]);

  // Guard activeScreen: immediately bounce cashier away if currently on a restricted screen
  useEffect(() => {
    if (isCashier && CASHIER_RESTRICTED_SCREENS.includes(activeScreen)) {
      showToast("Access restricted. Redirecting to Sales.", { type: "info" });
      handleNavigate("sales", { replace: true });
    }
  }, [isCashier, activeScreen, handleNavigate]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    // Initialize history state with current screen
    const current = getScreenFromUrl();
    const url = new URL(window.location.href);
    url.searchParams.set("screen", current);
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

      if (screens[target]) {
        setActiveScreen(target);
      } else {
        setActiveScreen("dashboard");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeScreen, isCashier]);

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
    return <AuthScreen />;
  }

  const Screen = screens[activeScreen] ?? Dashboard;

  return (
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
    >
      <ErrorBoundary>
        <Suspense fallback={<div className="p-6">Loading...</div>}>
          <Screen
          business={business}
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
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

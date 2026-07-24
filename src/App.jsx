import { useEffect, useState, Suspense, lazy } from "react";
import { AppLogo } from "./components/common/AppLogo.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";
import { AuthScreen, PasswordRecoveryScreen } from "./features/auth/AuthScreen.jsx";
import { getRepository } from "./services/repositories/dataRepository.js";
import { useAuthSession } from "./hooks/useAuthSession.js";
import { useInventory } from "./hooks/useInventory.js";
import { useCustomers } from "./hooks/useCustomers.js";
import { useExpenses } from "./hooks/useExpenses.js";
import { useAnalytics } from "./hooks/useAnalytics.js";

const Dashboard = lazy(() => import("./features/dashboard/Dashboard.jsx").then((m) => ({ default: m.Dashboard || m.default })));
const Inventory = lazy(() => import("./features/inventory/Inventory.jsx").then((m) => ({ default: m.Inventory || m.default })));
const Sales = lazy(() => import("./features/sales/Sales.jsx").then((m) => ({ default: m.Sales || m.default })));
const Expenses = lazy(() => import("./features/expenses/Expenses.jsx").then((m) => ({ default: m.Expenses || m.default })));
const Reports = lazy(() => import("./features/reports/Reports.jsx").then((m) => ({ default: m.Reports || m.default })));
const More = lazy(() => import("./features/settings/More.jsx").then((m) => ({ default: m.More || m.default })));
const Customers = lazy(() => import("./features/customers/Customers.jsx").then((m) => ({ default: m.Customers || m.default })));

const screens = {
  dashboard: Dashboard,
  customers: Customers,
  sales: Sales,
  inventory: Inventory,
  reports: Reports,
  expenses: Expenses,
  more: More,
};

export default function App() {
  const {
    session,
    workspace,
    workspaceLoading,
    isDemo,
    isLoading,
    isRecoveringPassword,
    setIsRecoveringPassword,
    business,
    setDemoBusinessProfile,
    handleSignOut: authSignOut,
    startDemo: authStartDemo,
  } = useAuthSession();

  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const businessId = workspace?.business?.id;
  const repository = getRepository(isDemo);

  const {
    products,
    setProducts,
    productsLoading,
    productsError,
    categories,
    categoriesLoading,
    categoriesError,
    lowStockCount,
    handleCreateProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleCreateCategory,
    resetInventory,
  } = useInventory(repository, businessId, isDemo);

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
    refreshAnalytics,
    resetAnalytics,
  } = useAnalytics(repository, businessId, isDemo, products);

  const {
    customers,
    setCustomers,
    customersLoading,
    customersError,
    handleCreateCustomer,
    handlePayDebt,
    resetCustomers,
  } = useCustomers(repository, businessId, isDemo, refreshAnalytics);

  const {
    expenses,
    expensesLoading,
    expensesError,
    handleCreateExpense,
    resetExpenses,
  } = useExpenses(repository, businessId, session?.user?.id, isDemo, refreshAnalytics);

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
    resetInventory();
    resetCustomers();
    resetExpenses();
    resetAnalytics();
    setActiveScreen("dashboard");
  }

  const handleSignOut = () => authSignOut(handleResetAll);

  const handleStartDemo = () => authStartDemo(handleResetAll);

  const handleUpdateBusinessProfile = async (nextBusiness) => {
    if (isDemo) {
      const updated = await repository.updateBusiness("demo", nextBusiness, business);
      setDemoBusinessProfile(updated);
      return;
    }
    await repository.updateBusiness(workspace.business.id, nextBusiness);
  };

  const handleCompleteSale = async ({ customer, lines, paymentType }) => {
    if (isDemo) {
      const result = await repository.completeSale({ customer, lines, currentProducts: products });
      setProducts(result.updatedProducts);
      if (result.newCustomer) {
        setCustomers((current) => [...current, result.newCustomer]);
      }
      await refreshAnalytics();
      return { reference: result.reference };
    }

    const result = await repository.completeSale(businessId, { customer, lines, paymentType });

    setProducts((current) =>
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

    return { reference: result.sale.reference };
  };

  if (isLoading || (session && workspaceLoading)) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="flex flex-col items-center gap-4 rounded-[1.75rem] border border-slate-200 bg-white px-8 py-8 shadow-soft">
          <AppLogo
            showText={false}
            imageClassName="h-16 w-16 rounded-3xl object-cover shadow-lg shadow-palm/20"
          />
          <p className="text-sm font-bold text-palm">
            {isLoading ? "Opening BizTrac" : "Loading your workspace"}
          </p>
        </div>
      </main>
    );
  }

  if (isRecoveringPassword) {
    return <PasswordRecoveryScreen onComplete={() => setIsRecoveringPassword(false)} />;
  }

  if (!session && !isDemo) {
    return <AuthScreen onDemo={handleStartDemo} />;
  }

  const Screen = screens[activeScreen] ?? Dashboard;

  return (
    <AppShell
      activeScreen={activeScreen}
      business={business}
      lowStockCount={lowStockCount}
      isOnline={isOnline}
      onNavigate={setActiveScreen}
      onSignOut={handleSignOut}
    >
      <Suspense fallback={<div className="p-6">Loading…</div>}>
        <Screen
          business={business}
          canDeleteProducts={isDemo || ["owner", "admin"].includes(workspace?.role)}
          canManageCategories={isDemo || ["owner", "admin"].includes(workspace?.role)}
          categories={categories}
          categoriesError={categoriesError}
          categoriesLoading={categoriesLoading}
          customers={customers}
          customersError={customersError}
          customersLoading={customersLoading}
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
          products={products}
          productsError={productsError}
          productsLoading={productsLoading}
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
          onCreateCustomer={handleCreateCustomer}
          onPayDebt={handlePayDebt}
          onNavigate={setActiveScreen}
          onSignOut={handleSignOut}
        />
      </Suspense>
    </AppShell>
  );
}

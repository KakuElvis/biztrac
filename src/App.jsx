import { useEffect, useMemo, useState } from "react";
import { AppLogo } from "./components/common/AppLogo.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";
import { AuthScreen, PasswordRecoveryScreen } from "./features/auth/AuthScreen.jsx";
import { Dashboard } from "./features/dashboard/Dashboard.jsx";
import { Inventory } from "./features/inventory/Inventory.jsx";
import { Sales } from "./features/sales/Sales.jsx";
import { Expenses } from "./features/expenses/Expenses.jsx";
import { Reports } from "./features/reports/Reports.jsx";
import { More } from "./features/settings/More.jsx";
import {
  business as demoBusiness,
  debtors as initialDebtors,
  expenses as initialExpenses,
  products as initialProducts,
} from "./lib/mockData.js";
import {
  emptyDashboardSummary,
  getDashboardSummary,
  getDemoDashboardSummary,
} from "./services/dashboardService.js";
import { createExpense, listExpenses } from "./services/expenseService.js";
import { createCategory, listCategories } from "./services/categoryService.js";
import { listCustomers } from "./services/customerService.js";
import { updateBusiness } from "./services/businessService.js";
import {
  getSession,
  getWorkspace,
  signOut,
  subscribeToAuthChanges,
} from "./services/authService.js";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "./services/productService.js";
import {
  emptyReportSummary,
  getDemoReportSummary,
  getReportSummary,
} from "./services/reportService.js";
import { createSale } from "./services/saleService.js";

const screens = {
  dashboard: Dashboard,
  sales: Sales,
  inventory: Inventory,
  reports: Reports,
  expenses: Expenses,
  more: More,
};

function categoriesFromProducts(products) {
  return [...new Set(products.map((product) => product.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ id: name, name }));
}

function customersFromDebtors(debtors) {
  return debtors.map((debtor) => ({
    id: debtor.id,
    businessId: "demo",
    name: debtor.name,
    phone: "",
    email: "",
    notes: "",
  }));
}

export default function App() {
  const [session, setSession] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [demoBusinessProfile, setDemoBusinessProfile] = useState(demoBusiness);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [dashboardSummary, setDashboardSummary] = useState(emptyDashboardSummary);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesError, setExpensesError] = useState("");
  const [reportSummary, setReportSummary] = useState(emptyReportSummary);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");

  useEffect(() => {
    let isMounted = true;

    getSession()
      .then((currentSession) => {
        if (isMounted) setSession(currentSession);
      })
      .catch((error) => console.error("Unable to restore session", error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const unsubscribe = subscribeToAuthChanges((nextSession, event) => {
      setSession(nextSession);
      if (nextSession) setIsDemo(false);
      if (event === "PASSWORD_RECOVERY") setIsRecoveringPassword(true);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!session?.user) {
      setWorkspace(null);
      setWorkspaceLoading(false);
      return undefined;
    }

    setWorkspaceLoading(true);
    getWorkspace(session.user.id)
      .then((nextWorkspace) => {
        if (isMounted) setWorkspace(nextWorkspace);
      })
      .catch((error) => {
        console.error("Unable to load workspace", error);
        if (isMounted) setWorkspace(null);
      })
      .finally(() => {
        if (isMounted) setWorkspaceLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    if (isDemo) {
      setProducts(initialProducts);
      setProductsError("");
      setProductsLoading(false);
      return undefined;
    }

    const businessId = workspace?.business?.id;
    if (!businessId) {
      setProducts([]);
      return undefined;
    }

    setProductsLoading(true);
    setProductsError("");

    listProducts(businessId)
      .then((nextProducts) => {
        if (isMounted) setProducts(nextProducts);
      })
      .catch((error) => {
        console.error("Unable to load products", error);
        if (isMounted) setProductsError(error.message || "Unable to load inventory.");
      })
      .finally(() => {
        if (isMounted) setProductsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDemo, session, workspace?.business?.id]);

  useEffect(() => {
    let isMounted = true;

    if (isDemo) {
      setCategories(categoriesFromProducts(initialProducts));
      setCategoriesError("");
      setCategoriesLoading(false);
      return undefined;
    }

    const businessId = workspace?.business?.id;
    if (!businessId) {
      setCategories([]);
      setCategoriesLoading(false);
      return undefined;
    }

    setCategoriesLoading(true);
    setCategoriesError("");

    listCategories(businessId)
      .then((nextCategories) => {
        if (isMounted) setCategories(nextCategories);
      })
      .catch((error) => {
        console.error("Unable to load product categories", error);
        if (isMounted) {
          setCategories([]);
          setCategoriesError(error.message || "Unable to load product categories.");
        }
      })
      .finally(() => {
        if (isMounted) setCategoriesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDemo, workspace?.business?.id]);

  useEffect(() => {
    let isMounted = true;

    if (isDemo) {
      setCustomers(customersFromDebtors(initialDebtors));
      setCustomersError("");
      setCustomersLoading(false);
      return undefined;
    }

    const businessId = workspace?.business?.id;
    if (!businessId) {
      setCustomers([]);
      setCustomersLoading(false);
      return undefined;
    }

    setCustomersLoading(true);
    setCustomersError("");

    listCustomers(businessId)
      .then((nextCustomers) => {
        if (isMounted) setCustomers(nextCustomers);
      })
      .catch((error) => {
        console.error("Unable to load customers", error);
        if (isMounted) {
          setCustomers([]);
          setCustomersError(error.message || "Unable to load customers.");
        }
      })
      .finally(() => {
        if (isMounted) setCustomersLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDemo, workspace?.business?.id]);

  useEffect(() => {
    if (!isDemo) return;

    setDashboardSummary(getDemoDashboardSummary(products));
    setDashboardError("");
    setDashboardLoading(false);
  }, [isDemo, products]);

  useEffect(() => {
    let isMounted = true;

    if (isDemo) return undefined;

    const businessId = workspace?.business?.id;
    if (!businessId) {
      setDashboardSummary(emptyDashboardSummary);
      setDashboardLoading(false);
      return undefined;
    }

    setDashboardLoading(true);
    setDashboardError("");

    getDashboardSummary(businessId)
      .then((nextSummary) => {
        if (isMounted) setDashboardSummary(nextSummary);
      })
      .catch((error) => {
        console.error("Unable to load dashboard", error);
        if (isMounted) {
          setDashboardSummary(emptyDashboardSummary);
          setDashboardError(error.message || "Unable to load dashboard data.");
        }
      })
      .finally(() => {
        if (isMounted) setDashboardLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDemo, session, workspace?.business?.id]);

  useEffect(() => {
    let isMounted = true;

    if (isDemo) {
      setExpenses(initialExpenses);
      setExpensesError("");
      setExpensesLoading(false);
      return undefined;
    }

    const businessId = workspace?.business?.id;
    if (!businessId) {
      setExpenses([]);
      setExpensesLoading(false);
      return undefined;
    }

    setExpensesLoading(true);
    setExpensesError("");

    listExpenses(businessId)
      .then((nextExpenses) => {
        if (isMounted) setExpenses(nextExpenses);
      })
      .catch((error) => {
        console.error("Unable to load expenses", error);
        if (isMounted) {
          setExpenses([]);
          setExpensesError(error.message || "Unable to load expenses.");
        }
      })
      .finally(() => {
        if (isMounted) setExpensesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDemo, workspace?.business?.id]);

  useEffect(() => {
    let isMounted = true;

    if (isDemo) {
      setReportSummary(getDemoReportSummary(products));
      setReportsError("");
      setReportsLoading(false);
      return undefined;
    }

    const businessId = workspace?.business?.id;
    if (!businessId) {
      setReportSummary(emptyReportSummary);
      setReportsLoading(false);
      return undefined;
    }

    setReportsLoading(true);
    setReportsError("");

    getReportSummary(businessId)
      .then((nextSummary) => {
        if (isMounted) setReportSummary(nextSummary);
      })
      .catch((error) => {
        console.error("Unable to load reports", error);
        if (isMounted) {
          setReportSummary(emptyReportSummary);
          setReportsError(error.message || "Unable to load reports.");
        }
      })
      .finally(() => {
        if (isMounted) setReportsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDemo, products, workspace?.business?.id]);

  const Screen = screens[activeScreen] ?? Dashboard;
  const lowStockCount = useMemo(
    () => products.filter((product) => product.quantity <= product.lowStockLimit).length,
    [products]
  );
  const business = useMemo(() => {
    if (isDemo) return demoBusinessProfile;

    const fallbackOwner =
      session?.user?.user_metadata?.full_name || session?.user?.email || "there";

    if (!workspace?.business) {
      return {
        name: "BizTrac",
        owner: fallbackOwner,
        logoText: "BT",
        phone: "",
        email: session?.user?.email || "",
        location: "",
        currency: "GHS",
      };
    }

    const current = workspace.business;
    const initials = current.name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();

    return {
      ...current,
      logoText: initials || "BT",
      owner: fallbackOwner,
    };
  }, [demoBusinessProfile, isDemo, session, workspace]);

  async function handleSignOut() {
    if (isDemo) {
      setIsDemo(false);
      setProducts([]);
      setCategories([]);
      setCustomers([]);
      setDashboardSummary(emptyDashboardSummary);
      setExpenses([]);
      setReportSummary(emptyReportSummary);
      setActiveScreen("dashboard");
      return;
    }

    try {
      await signOut();
      setProducts([]);
      setCategories([]);
      setCustomers([]);
      setDashboardSummary(emptyDashboardSummary);
      setExpenses([]);
      setReportSummary(emptyReportSummary);
      setActiveScreen("dashboard");
    } catch (error) {
      console.error("Unable to sign out", error);
    }
  }

  function handleStartDemo() {
    setDemoBusinessProfile(demoBusiness);
    setProducts(initialProducts);
    setCategories(categoriesFromProducts(initialProducts));
    setCustomers(customersFromDebtors(initialDebtors));
    setDashboardSummary(getDemoDashboardSummary(initialProducts));
    setExpenses(initialExpenses);
    setReportSummary(getDemoReportSummary(initialProducts));
    setIsDemo(true);
  }

  async function handleCreateProduct(product) {
    if (isDemo) {
      const nextProduct = { ...product, id: crypto.randomUUID() };
      setProducts((current) => [nextProduct, ...current]);
      return nextProduct;
    }

    const nextProduct = await createProduct(workspace.business.id, product);
    setProducts((current) => [nextProduct, ...current]);
    return nextProduct;
  }

  async function handleCreateCategory(name) {
    if (isDemo) {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Category name is required.");
      if (categories.some((category) => category.name.toLowerCase() === trimmedName.toLowerCase())) {
        throw new Error("This category already exists.");
      }

      const nextCategory = { id: crypto.randomUUID(), name: trimmedName };
      setCategories((current) =>
        [...current, nextCategory].sort((a, b) => a.name.localeCompare(b.name))
      );
      return nextCategory;
    }

    const nextCategory = await createCategory(workspace.business.id, name);
    setCategories((current) =>
      [...current, nextCategory].sort((a, b) => a.name.localeCompare(b.name))
    );
    return nextCategory;
  }

  async function handleUpdateProduct(productId, product) {
    if (isDemo) {
      const nextProduct = { ...product, id: productId };
      setProducts((current) =>
        current.map((item) => (item.id === productId ? nextProduct : item))
      );
      return nextProduct;
    }

    const nextProduct = await updateProduct(workspace.business.id, productId, product);
    setProducts((current) =>
      current.map((item) => (item.id === productId ? nextProduct : item))
    );
    return nextProduct;
  }

  async function handleDeleteProduct(productId) {
    if (!isDemo) await deleteProduct(workspace.business.id, productId);
    setProducts((current) => current.filter((product) => product.id !== productId));
  }

  async function handleCreateExpense(expense) {
    if (isDemo) {
      const paymentLabels = {
        bank: "Bank",
        cash: "Cash",
        momo: "MoMo",
      };
      const nextExpense = {
        ...expense,
        id: crypto.randomUUID(),
        method: paymentLabels[expense.paymentMethod] || "Cash",
        date: "Today",
      };
      setExpenses((current) => [nextExpense, ...current]);
      return nextExpense;
    }

    const businessId = workspace.business.id;
    const nextExpense = await createExpense(businessId, session.user.id, expense);
    setExpenses((current) => [nextExpense, ...current]);

    const [nextDashboard, nextReport] = await Promise.allSettled([
      getDashboardSummary(businessId),
      getReportSummary(businessId),
    ]);
    if (nextDashboard.status === "fulfilled") {
      setDashboardSummary(nextDashboard.value);
    } else {
      console.error("Unable to refresh dashboard after expense save", nextDashboard.reason);
    }
    if (nextReport.status === "fulfilled") {
      setReportSummary(nextReport.value);
    } else {
      console.error("Unable to refresh reports after expense save", nextReport.reason);
    }

    return nextExpense;
  }

  async function handleUpdateBusinessProfile(nextBusiness) {
    if (isDemo) {
      setDemoBusinessProfile((current) => ({
        ...current,
        ...nextBusiness,
        logoText:
          nextBusiness.name
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join("")
            .toUpperCase() || "BT",
      }));
      return;
    }

    const updatedBusiness = await updateBusiness(workspace.business.id, nextBusiness);
    setWorkspace((current) => ({
      ...current,
      business: updatedBusiness,
    }));
  }

  async function handleCompleteSale({ customer, lines, paymentType }) {
    if (isDemo) {
      const updatedProducts = products.map((product) => {
        const line = lines.find((item) => item.product.id === product.id);
        if (!line) return product;

        return {
          ...product,
          quantity: Math.max(0, product.quantity - line.quantity),
          soldToday: (product.soldToday || 0) + line.quantity,
        };
      });

      setProducts(updatedProducts);
      setDashboardSummary(getDemoDashboardSummary(updatedProducts));
      setReportSummary(getDemoReportSummary(updatedProducts));

      if (customer?.mode === "new" && customer.name.trim()) {
        setCustomers((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            businessId: "demo",
            name: customer.name.trim(),
            phone: (customer.phone || "").trim(),
            email: "",
            notes: "",
          },
        ]);
      }

      return {
        reference: `BT-${Math.floor(1000 + Math.random() * 9000)}`,
      };
    }

    const businessId = workspace.business.id;
    const result = await createSale(businessId, { customer, lines, paymentType });

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

    const [nextDashboard, nextReport] = await Promise.allSettled([
      getDashboardSummary(businessId),
      getReportSummary(businessId),
    ]);

    if (nextDashboard.status === "fulfilled") {
      setDashboardSummary(nextDashboard.value);
    } else {
      console.error("Unable to refresh dashboard after sale", nextDashboard.reason);
    }

    if (nextReport.status === "fulfilled") {
      setReportSummary(nextReport.value);
    } else {
      console.error("Unable to refresh reports after sale", nextReport.reason);
    }

    return {
      reference: result.sale.reference,
    };
  }

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

  return (
    <AppShell
      activeScreen={activeScreen}
      business={business}
      lowStockCount={lowStockCount}
      onNavigate={setActiveScreen}
      onSignOut={handleSignOut}
    >
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
        reportsError={reportsError}
        reportsLoading={reportsLoading}
        setProducts={setProducts}
        onUpdateProduct={handleUpdateProduct}
        onNavigate={setActiveScreen}
        onSignOut={handleSignOut}
      />
    </AppShell>
  );
}

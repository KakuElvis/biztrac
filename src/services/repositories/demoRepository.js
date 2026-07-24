import {
  business as demoBusiness,
  debtors as initialDebtors,
  expenses as initialExpenses,
  products as initialProducts,
} from "../../lib/mockData.js";
import { getDemoDashboardSummary } from "../dashboardService.js";
import { getDemoReportSummary } from "../reportService.js";

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

export const demoRepository = {
  isDemo: true,

  async getInitialProducts() {
    return [...initialProducts];
  },

  async getInitialCategories(products = initialProducts) {
    return categoriesFromProducts(products);
  },

  async getInitialCustomers() {
    return customersFromDebtors(initialDebtors);
  },

  async getInitialExpenses() {
    return [...initialExpenses];
  },

  async getInitialBusiness() {
    return { ...demoBusiness };
  },

  async listProducts() {
    return [...initialProducts];
  },

  async createProduct(_businessId, product) {
    return { ...product, id: crypto.randomUUID() };
  },

  async updateProduct(_businessId, productId, product) {
    return { ...product, id: productId };
  },

  async deleteProduct() {
    return true;
  },

  async listCategories() {
    return categoriesFromProducts(initialProducts);
  },

  async createCategory(_businessId, name, existingCategories = []) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Category name is required.");
    if (existingCategories.some((cat) => cat.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error("This category already exists.");
    }
    return { id: crypto.randomUUID(), name: trimmedName };
  },

  async listCustomers() {
    return customersFromDebtors(initialDebtors);
  },

  async createCustomer(_businessId, customer) {
    return {
      id: crypto.randomUUID(),
      businessId: "demo",
      name: (customer.name || "").trim(),
      phone: (customer.phone || "").trim(),
      email: (customer.email || "").trim(),
      notes: customer.notes || "",
    };
  },

  async payCustomerDebt(_businessId, _customerId, amount) {
    return Number(amount);
  },

  async listExpenses() {
    return [...initialExpenses];
  },

  async createExpense(_businessId, _userId, expense) {
    const paymentLabels = { bank: "Bank", cash: "Cash", momo: "MoMo" };
    return {
      ...expense,
      id: crypto.randomUUID(),
      method: paymentLabels[expense.paymentMethod] || "Cash",
      date: "Today",
    };
  },

  async getDashboardSummary(_businessId, products = initialProducts) {
    return getDemoDashboardSummary(products);
  },

  async getReportSummary(_businessId, _options = {}, products = initialProducts) {
    return getDemoReportSummary(products);
  },

  async completeSale({ customer, lines, currentProducts }) {
    const updatedProducts = currentProducts.map((product) => {
      const line = lines.find((item) => item.product.id === product.id);
      if (!line) return product;

      return {
        ...product,
        quantity: Math.max(0, product.quantity - line.quantity),
        soldToday: (product.soldToday || 0) + line.quantity,
      };
    });

    let newCustomer = null;
    if (customer?.mode === "new" && customer.name.trim()) {
      newCustomer = {
        id: crypto.randomUUID(),
        businessId: "demo",
        name: customer.name.trim(),
        phone: (customer.phone || "").trim(),
        email: "",
        notes: "",
      };
    }

    return {
      reference: `BT-${Math.floor(1000 + Math.random() * 9000)}`,
      updatedProducts,
      newCustomer,
    };
  },

  async updateBusiness(_businessId, nextBusiness, currentBusiness) {
    const name = nextBusiness.name || currentBusiness.name || "BizTrac";
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();

    return {
      ...currentBusiness,
      ...nextBusiness,
      logoText: initials || "BT",
    };
  },
};

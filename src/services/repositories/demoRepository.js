import {
  business as demoBusiness,
  debtors as initialDebtors,
  expenses as initialExpenses,
  products as initialProducts,
} from "../../lib/mockData.js";
import { getDemoDashboardSummary } from "../dashboardService.js";
import { getDemoReportSummary } from "../reportService.js";

const demoRestockLogs = new Map();

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

  async listProducts(_businessId, options) {
    let prods = [...initialProducts];
    if (options?.category) {
      prods = prods.filter((p) => p.category === options.category);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      prods = prods.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      );
    }
    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize;
      const end = start + options.pageSize;
      return {
        data: prods.slice(start, end),
        totalCount: prods.length,
      };
    }
    return prods;
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

  async restockProduct(_businessId, productId, restockData) {
    const { quantityAdded, newCostPrice, newSellingPrice, supplierName, notes } = restockData;
    const prod = initialProducts.find((p) => String(p.id) === String(productId));
    const prevQty = prod ? prod.quantity : 0;
    const oldCost = prod ? prod.costPrice : 0;
    const oldSelling = prod ? prod.sellingPrice : 0;
    const added = Number(quantityAdded);

    if (prod) {
      prod.quantity = prevQty + added;
      if (newCostPrice !== undefined && newCostPrice !== null && !isNaN(Number(newCostPrice))) {
        prod.costPrice = Number(newCostPrice);
      }
      if (newSellingPrice !== undefined && newSellingPrice !== null && !isNaN(Number(newSellingPrice))) {
        prod.sellingPrice = Number(newSellingPrice);
      }
    }

    const logEntry = {
      id: crypto.randomUUID(),
      productId,
      quantityAdded: added,
      previousQuantity: prevQty,
      newQuantity: prevQty + added,
      oldCostPrice: oldCost,
      newCostPrice: prod ? prod.costPrice : oldCost,
      oldSellingPrice: oldSelling,
      newSellingPrice: prod ? prod.sellingPrice : oldSelling,
      supplierName: supplierName || "",
      notes: notes || "",
      createdAt: new Date().toISOString(),
    };

    if (!demoRestockLogs.has(String(productId))) {
      demoRestockLogs.set(String(productId), []);
    }
    demoRestockLogs.get(String(productId)).unshift(logEntry);

    return {
      restock: logEntry,
      updatedProduct: prod ? { ...prod } : null,
    };
  },

  async listProductRestocks(_businessId, productId) {
    return demoRestockLogs.get(String(productId)) || [];
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

  async updateCustomer(_businessId, customerId, updates) {
    const debtor = initialDebtors.find((d) => String(d.id) === String(customerId));
    if (debtor) {
      if (updates.name) debtor.name = updates.name.trim();
      if (updates.phone !== undefined) debtor.phone = updates.phone.trim();
    }
    return {
      id: customerId,
      businessId: "demo",
      name: (updates.name || debtor?.name || "Customer").trim(),
      phone: (updates.phone ?? debtor?.phone ?? "").trim(),
      email: (updates.email || "").trim(),
      notes: (updates.notes || "").trim(),
      debt: debtor ? debtor.amount : 0,
    };
  },

  async getCustomerDetails(_businessId, customerId) {
    const debtor = initialDebtors.find((d) => String(d.id) === String(customerId));
    const activeDebt = debtor ? debtor.amount : 0;

    const mockPurchases = [
      {
        id: "demo-sale-1",
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        total: 450,
        amountPaid: activeDebt > 0 ? 0 : 450,
        paymentMethod: activeDebt > 0 ? "credit" : "cash",
        dueDate: debtor?.due || null,
        itemsCount: 2,
        items: [
          { name: "Kente Weave Fabric", quantity: 2, price: 150 },
          { name: "Beaded Necklace", quantity: 1, price: 150 },
        ],
      },
      {
        id: "demo-sale-2",
        date: new Date(Date.now() - 86400000 * 14).toISOString(),
        total: 280,
        amountPaid: 280,
        paymentMethod: "momo",
        dueDate: null,
        itemsCount: 1,
        items: [{ name: "African Print Shirt", quantity: 2, price: 140 }],
      },
    ];

    const totalOrders = mockPurchases.length;
    const lifetimeSpend = mockPurchases.reduce((sum, p) => sum + p.total, 0);

    return {
      customer: {
        id: customerId,
        businessId: "demo",
        name: debtor ? debtor.name : "Customer Profile",
        phone: debtor?.phone || "0240000000",
        email: "customer@example.com",
        notes: "Regular SME client",
        debt: activeDebt,
      },
      metrics: {
        totalOrders,
        lifetimeSpend,
        activeDebt,
      },
      purchases: mockPurchases,
    };
  },

  async payCustomerDebt(_businessId, customerId, amount) {
    const debtor = initialDebtors.find((d) => String(d.id) === String(customerId));
    const previousDebt = debtor ? debtor.amount : 0;
    const appliedAmount = Math.min(previousDebt || Number(amount), Number(amount));
    if (debtor) {
      debtor.amount = Math.max(0, debtor.amount - appliedAmount);
    }
    return {
      appliedAmount,
      previousDebt,
      remainingDebt: debtor ? debtor.amount : 0,
    };
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

  async getProductStockTimeline(_businessId, productId) {
    const product = initialProducts.find((p) => String(p.id) === String(productId)) || {
      id: productId,
      name: "Demo Product",
      category: "General",
      costPrice: 50,
      sellingPrice: 100,
      quantity: 10,
      lowStockLimit: 2,
    };

    const restocks = demoRestockLogs.get(String(productId)) || [
      {
        id: "demo-r1",
        productId,
        quantityAdded: 20,
        previousQuantity: 5,
        newQuantity: 25,
        oldCostPrice: product.costPrice,
        newCostPrice: product.costPrice,
        oldSellingPrice: product.sellingPrice,
        newSellingPrice: product.sellingPrice,
        supplierName: "Makola Wholesalers",
        notes: "Initial Batch Restock",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const sales = [
      {
        id: "demo-s1",
        quantity: 3,
        unitPrice: product.sellingPrice,
        lineTotal: product.sellingPrice * 3,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const totalSold = sales.reduce((sum, s) => sum + s.quantity, 0);
    const totalRevenue = sales.reduce((sum, s) => sum + s.lineTotal, 0);
    const totalRestockedUnits = restocks.reduce((sum, r) => sum + r.quantityAdded, 0);

    return {
      product: {
        ...product,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      metrics: {
        totalSold,
        totalRevenue,
        totalRestockedUnits,
        currentValuationAtCost: (product.costPrice || 0) * (product.quantity || 0),
        currentValuationAtRetail: (product.sellingPrice || 0) * (product.quantity || 0),
        profitMarginPerUnit: (product.sellingPrice || 0) - (product.costPrice || 0),
      },
      restocks,
      sales,
    };
  },

  async completeSale({ customer, lines, currentProducts, paymentType, amountPaid, dueDate }) {
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

    const reference = `BT-${Math.floor(1000 + Math.random() * 9000)}`;
    const total = lines.reduce((sum, line) => sum + (line.total || 0), 0);
    const parsedAmountPaid =
      amountPaid !== undefined && amountPaid !== null
        ? Number(amountPaid)
        : paymentType === "Credit"
        ? 0
        : total;

    return {
      reference,
      updatedProducts,
      newCustomer,
      sale: {
        reference,
        paymentMethod: paymentType || "Cash",
        total,
        amountPaid: parsedAmountPaid,
        dueDate: dueDate || null,
      },
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

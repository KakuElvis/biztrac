import { listProducts, createProduct, updateProduct, deleteProduct } from "../productService.js";
import { listCategories, createCategory } from "../categoryService.js";
import { listCustomers, createCustomer, payCustomerDebt } from "../customerService.js";
import { listExpenses, createExpense } from "../expenseService.js";
import { getDashboardSummary } from "../dashboardService.js";
import { getReportSummary } from "../reportService.js";
import { createSale } from "../saleService.js";
import { updateBusiness } from "../businessService.js";
import {
  cacheLocalProducts,
  getLocalProducts,
  cacheLocalCategories,
  getLocalCategories,
  cacheLocalCustomers,
  getLocalCustomers,
} from "../offlineQueueService.js";

export const supabaseRepository = {
  isDemo: false,

  async listProducts(businessId) {
    try {
      const products = await listProducts(businessId);
      cacheLocalProducts(products);
      return products;
    } catch (error) {
      console.warn("[supabaseRepository] Fetching products failed, attempting local cache", error);
      const cached = await getLocalProducts();
      if (cached.length) return cached;
      throw error;
    }
  },

  async createProduct(businessId, product) {
    return createProduct(businessId, product);
  },

  async updateProduct(businessId, productId, product) {
    return updateProduct(businessId, productId, product);
  },

  async deleteProduct(businessId, productId) {
    return deleteProduct(businessId, productId);
  },

  async listCategories(businessId) {
    try {
      const categories = await listCategories(businessId);
      cacheLocalCategories(categories);
      return categories;
    } catch (error) {
      console.warn("[supabaseRepository] Fetching categories failed, attempting local cache", error);
      const cached = await getLocalCategories();
      if (cached.length) return cached;
      throw error;
    }
  },

  async createCategory(businessId, name) {
    return createCategory(businessId, name);
  },

  async listCustomers(businessId) {
    try {
      const customers = await listCustomers(businessId);
      cacheLocalCustomers(customers);
      return customers;
    } catch (error) {
      console.warn("[supabaseRepository] Fetching customers failed, attempting local cache", error);
      const cached = await getLocalCustomers();
      if (cached.length) return cached;
      throw error;
    }
  },

  async createCustomer(businessId, customer) {
    return createCustomer(businessId, customer);
  },

  async payCustomerDebt(businessId, customerId, amount, paymentMethod) {
    return payCustomerDebt(businessId, customerId, amount, paymentMethod);
  },

  async listExpenses(businessId) {
    return listExpenses(businessId);
  },

  async createExpense(businessId, userId, expense) {
    return createExpense(businessId, userId, expense);
  },

  async getDashboardSummary(businessId) {
    return getDashboardSummary(businessId);
  },

  async getReportSummary(businessId, options) {
    return getReportSummary(businessId, options);
  },

  async completeSale(businessId, { customer, lines, paymentType, amountPaid }) {
    return createSale(businessId, { customer, lines, paymentType, amountPaid });
  },

  async updateBusiness(businessId, nextBusiness) {
    return updateBusiness(businessId, nextBusiness);
  },
};

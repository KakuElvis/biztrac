import { listProducts, createProduct, updateProduct, deleteProduct, restockProduct, listProductRestocks } from "../productService.js";
import { listCategories, createCategory } from "../categoryService.js";
import { listCustomers, createCustomer, updateCustomer, getCustomerDetails, payCustomerDebt, forgiveCustomerDebt } from "../customerService.js";
import { listExpenses, createExpense } from "../expenseService.js";
import { getDashboardSummary } from "../dashboardService.js";
import { getReportSummary, getProductStockTimeline } from "../reportService.js";
import { createSale } from "../saleService.js";
import { updateBusiness } from "../businessService.js";
import { getActiveStaffSession } from "../staffService.js";
import {
  cacheLocalProducts,
  getLocalProducts,
  cacheLocalCategories,
  getLocalCategories,
  cacheLocalCustomers,
  getLocalCustomers,
} from "../offlineQueueService.js";

function cachedProductPage(cached, options) {
  if (!options?.page || !options?.pageSize) return cached;
  const start = (options.page - 1) * options.pageSize;
  return { data: cached.slice(start, start + options.pageSize), totalCount: cached.length };
}

export const supabaseRepository = {
  async listProducts(businessId, options) {
    const cacheScope = options?.omitCostPrice || getActiveStaffSession()?.user?.isStaff ? "counter" : "manager";
    try {
      const result = await listProducts(businessId, options);
      if (Array.isArray(result)) {
        if (result.length > 0) {
          cacheLocalProducts(businessId, result, cacheScope, { replace: !options?.page });
          return result;
        }
        // If remote returned 0 items (e.g. initial offline sync or RLS catchup), check local cache
        const cached = await getLocalProducts(businessId, cacheScope);
        if (cached && cached.length > 0) {
          return cachedProductPage(cached, options);
        }
        return result;
      } else if (result?.data) {
        if (result.data.length > 0) {
          cacheLocalProducts(businessId, result.data, cacheScope, {
            replace: !options?.page || result.totalCount === result.data.length,
          });
          return result;
        }
        const cached = await getLocalProducts(businessId, cacheScope);
        if (cached && cached.length > 0) {
          return cachedProductPage(cached, options);
        }
        return result;
      }
      return result;
    } catch (error) {
      console.warn("[supabaseRepository] Fetching products failed, attempting local cache", error);
      const cached = await getLocalProducts(businessId, cacheScope);
      if (cached.length) {
        return cachedProductPage(cached, options);
      }
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

  async restockProduct(businessId, productId, restockData) {
    return restockProduct(businessId, productId, restockData);
  },

  async listProductRestocks(businessId, productId) {
    return listProductRestocks(businessId, productId);
  },

  async listCategories(businessId) {
    try {
      const categories = await listCategories(businessId);
      if (Array.isArray(categories) && categories.length > 0) {
        cacheLocalCategories(businessId, categories);
        return categories;
      }
      const cached = await getLocalCategories(businessId);
      if (cached && cached.length > 0) return cached;
      return categories || [];
    } catch (error) {
      console.warn("[supabaseRepository] Fetching categories failed, attempting local cache", error);
      const cached = await getLocalCategories(businessId);
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
      if (Array.isArray(customers) && customers.length > 0) {
        cacheLocalCustomers(businessId, customers);
        return customers;
      }
      const cached = await getLocalCustomers(businessId);
      if (cached && cached.length > 0) return cached;
      return customers || [];
    } catch (error) {
      console.warn("[supabaseRepository] Fetching customers failed, attempting local cache", error);
      const cached = await getLocalCustomers(businessId);
      if (cached.length) return cached;
      throw error;
    }
  },

  async createCustomer(businessId, customer) {
    return createCustomer(businessId, customer);
  },

  async updateCustomer(businessId, customerId, updates) {
    return updateCustomer(businessId, customerId, updates);
  },

  async getCustomerDetails(businessId, customerId, options) {
    return getCustomerDetails(businessId, customerId, options);
  },

  async payCustomerDebt(businessId, customerId, amount, paymentMethod, staffAccountId) {
    return payCustomerDebt(businessId, customerId, amount, paymentMethod, staffAccountId);
  },

  async forgiveCustomerDebt(businessId, customerId, options) {
    return forgiveCustomerDebt(businessId, customerId, options);
  },

  async listExpenses(businessId) {
    return listExpenses(businessId);
  },

  async createExpense(businessId, userId, expense) {
    return createExpense(businessId, userId, expense);
  },

  async getDashboardSummary(businessId, options) {
    return getDashboardSummary(businessId, options);
  },

  async getReportSummary(businessId, options) {
    return getReportSummary(businessId, options);
  },

  async getProductStockTimeline(businessId, productId) {
    return getProductStockTimeline(businessId, productId);
  },

  async completeSale(businessId, { customer, lines, paymentType, amountPaid, dueDate, notes, clientSaleId }) {
    return createSale(businessId, { customer, lines, paymentType, amountPaid, dueDate, notes, clientSaleId });
  },

  async updateBusiness(businessId, nextBusiness) {
    return updateBusiness(businessId, nextBusiness);
  },
};

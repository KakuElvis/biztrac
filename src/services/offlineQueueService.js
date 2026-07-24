import { STORES, putItem, getItem, getAllItems, removeItem } from "../lib/offlineStore.js";
import { showToast } from "../lib/toast.js";

export async function enqueueOfflineSale(businessId, payload) {
  const queuedSale = {
    id: crypto.randomUUID(),
    businessId,
    payload,
    createdAt: new Date().toISOString(),
  };

  await putItem(STORES.QUEUED_SALES, queuedSale);
  return queuedSale;
}

export async function getQueuedSales() {
  const items = await getAllItems(STORES.QUEUED_SALES);
  return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function removeQueuedSale(id) {
  return removeItem(STORES.QUEUED_SALES, id);
}

export async function syncOfflineQueue(completeSaleFn) {
  if (!completeSaleFn) return 0;
  const queued = await getQueuedSales();
  if (!queued.length) return 0;

  let syncedCount = 0;
  for (const item of queued) {
    try {
      await completeSaleFn(item.businessId, item.payload);
      await removeQueuedSale(item.id);
      syncedCount += 1;
      showToast("Saved offline sale synced successfully.", { type: "success" });
    } catch (error) {
      console.warn("[offlineQueueService] Failed to sync queued sale item", item.id, error);
      // Stop on first failure to prevent infinite loop or wrong ordering
      break;
    }
  }

  return syncedCount;
}

export async function cacheLocalProducts(products) {
  if (!Array.isArray(products) || !products.length) return;
  await putItem(STORES.CACHED_CATALOG, { id: "products", data: products, updatedAt: Date.now() });
}

export async function getLocalProducts() {
  const record = await getItem(STORES.CACHED_CATALOG, "products");
  return record?.data || [];
}

export async function cacheLocalCategories(categories) {
  if (!Array.isArray(categories) || !categories.length) return;
  await putItem(STORES.CACHED_CATALOG, { id: "categories", data: categories, updatedAt: Date.now() });
}

export async function getLocalCategories() {
  const record = await getItem(STORES.CACHED_CATALOG, "categories");
  return record?.data || [];
}

export async function cacheLocalCustomers(customers) {
  if (!Array.isArray(customers) || !customers.length) return;
  await putItem(STORES.CACHED_CUSTOMERS, { id: "customers", data: customers, updatedAt: Date.now() });
}

export async function getLocalCustomers() {
  const record = await getItem(STORES.CACHED_CUSTOMERS, "customers");
  return record?.data || [];
}

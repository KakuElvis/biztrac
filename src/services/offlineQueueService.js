import { STORES, putItem, getItem, getAllItems, removeItem, clearStore } from "../lib/offlineStore.js";
import { showToast } from "../lib/toast.js";

export const MAX_SYNC_RETRIES = 3;

function isPermanentBusinessError(errorMessage = "") {
  const msg = String(errorMessage || "").toLowerCase();
  return (
    msg.includes("only has") ||
    msg.includes("in stock") ||
    msg.includes("out of stock") ||
    msg.includes("not found") ||
    msg.includes("greater than zero") ||
    msg.includes("invalid") ||
    msg.includes("unsupported") ||
    msg.includes("require a customer") ||
    msg.includes("cart product was not found")
  );
}

function isNetworkError(errorMessage = "") {
  const msg = String(errorMessage || "").toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("timeout") ||
    msg.includes("offline") ||
    msg.includes("load failed")
  );
}

export async function enqueueOfflineSale(businessId, payload) {
  const queuedSale = {
    id: crypto.randomUUID(),
    businessId,
    payload,
    retryCount: 0,
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

export async function getConflictedSales() {
  const items = await getAllItems(STORES.CONFLICTED_SALES);
  return items.sort((a, b) => new Date(b.conflictedAt || 0) - new Date(a.conflictedAt || 0));
}

export async function removeConflictedSale(id) {
  return removeItem(STORES.CONFLICTED_SALES, id);
}

export async function clearConflictedSales() {
  return clearStore(STORES.CONFLICTED_SALES);
}

export async function retryConflictedSale(id) {
  const item = await getItem(STORES.CONFLICTED_SALES, id);
  if (!item) return null;

  const requeued = {
    ...item,
    retryCount: 0,
    lastError: null,
  };
  delete requeued.conflictError;
  delete requeued.conflictedAt;

  await putItem(STORES.QUEUED_SALES, requeued);
  await removeItem(STORES.CONFLICTED_SALES, id);
  return requeued;
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
      const errorMsg = error?.message || String(error);
      const currentRetries = Number(item.retryCount || 0) + 1;
      console.warn("[offlineQueueService] Failed to sync queued sale item", item.id, errorMsg);

      const isPermanent = isPermanentBusinessError(errorMsg);
      const hasExceededRetries = currentRetries >= MAX_SYNC_RETRIES;

      if (isPermanent || hasExceededRetries) {
        // Move to conflicted_sales dead-letter store to prevent queue deadlock
        const conflictedSale = {
          ...item,
          retryCount: currentRetries,
          conflictError: errorMsg,
          conflictedAt: new Date().toISOString(),
        };

        await putItem(STORES.CONFLICTED_SALES, conflictedSale);
        await removeQueuedSale(item.id);

        showToast(
          `Offline sale sync conflict: ${errorMsg}. Moved to review.`,
          { type: "error", duration: 8000 }
        );

        // Continue processing remaining items in queue
        continue;
      }

      // If it's a network error or transient failure within retry limits, update retry count
      await putItem(STORES.QUEUED_SALES, {
        ...item,
        retryCount: currentRetries,
        lastError: errorMsg,
        lastAttemptAt: new Date().toISOString(),
      });

      if (isNetworkError(errorMsg)) {
        // Stop on network failure to avoid hammering a dropped connection
        break;
      }
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

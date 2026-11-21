import { STORES, putItem, getItem, getAllItems, removeItem, clearStore } from "../lib/offlineStore.js";
import { showToast } from "../lib/toast.js";

export const MAX_SYNC_RETRIES = 3;

function isPermanentBusinessError(errorMessage = "") {
  const msg = String(errorMessage || "").toLowerCase();
  return (
    msg.includes("only has") ||
    msg.includes("in stock") ||
    msg.includes("out of stock") ||
    msg.includes("greater than zero") ||
    msg.includes("require a customer") ||
    msg.includes("cart product was not found") ||
    msg.includes("selected customer was not found") ||
    msg.includes("unsupported payment method")
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

function isAuthorizationError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || error || "").toLowerCase();
  return code === "42501" || error?.status === 401 || error?.status === 403 ||
    message.includes("counter session is invalid") || message.includes("session is required") ||
    message.includes("not authorized") || message.includes("permission denied");
}

export async function enqueueOfflineSale(businessId, payload) {
  const queuedSale = {
    id: payload?.clientSaleId || crypto.randomUUID(),
    businessId,
    payload,
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };

  await putItem(STORES.QUEUED_SALES, queuedSale);
  return queuedSale;
}

export async function getQueuedSales(businessId = null) {
  const items = await getAllItems(STORES.QUEUED_SALES);
  return items.filter((item) => !businessId || item.businessId === businessId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function removeQueuedSale(id) {
  return removeItem(STORES.QUEUED_SALES, id);
}

export async function getConflictedSales(businessId = null) {
  const items = await getAllItems(STORES.CONFLICTED_SALES);
  return items.filter((item) => !businessId || item.businessId === businessId).sort((a, b) => new Date(b.conflictedAt || 0) - new Date(a.conflictedAt || 0));
}

export async function removeConflictedSale(id) {
  return removeItem(STORES.CONFLICTED_SALES, id);
}

export async function clearConflictedSales(businessId = null) {
  if (businessId) {
    const items = await getConflictedSales(businessId);
    await Promise.all(items.map((item) => removeItem(STORES.CONFLICTED_SALES, item.id)));
    return true;
  }
  return clearStore(STORES.CONFLICTED_SALES);
}

export async function retryConflictedSale(id, businessId = null) {
  const item = await getItem(STORES.CONFLICTED_SALES, id);
  if (!item || (businessId && item.businessId !== businessId)) return null;

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

export async function syncOfflineQueue(completeSaleFn, businessId = null) {
  if (!completeSaleFn) return 0;
  const queued = await getQueuedSales(businessId);
  if (!queued.length) return 0;

  let syncedCount = 0;
  for (const item of queued) {
    try {
      await completeSaleFn(item.businessId, { ...item.payload, clientSaleId: item.id });
      await removeQueuedSale(item.id);
      syncedCount += 1;
      showToast("Saved offline sale synced successfully.", { type: "success" });
    } catch (error) {
      const errorMsg = error?.message || String(error);
      if (isAuthorizationError(error)) {
        // Keep queued sales intact until the cashier signs in again.
        await putItem(STORES.QUEUED_SALES, {
          ...item,
          lastError: errorMsg,
          lastAttemptAt: new Date().toISOString(),
        });
        break;
      }
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

function cacheKey(businessId, entity, scope = "shared") {
  return `${businessId}:${entity}:${scope}`;
}

function withoutProductCost(product) {
  const safeProduct = { ...(product || {}) };
  delete safeProduct.costPrice;
  delete safeProduct.cost_price;
  return safeProduct;
}

export async function cacheLocalProducts(businessId, products, scope = "manager", { replace = false } = {}) {
  if (!Array.isArray(products) || (!products.length && !replace)) return;
  const existingRecord = await getItem(STORES.CACHED_CATALOG, cacheKey(businessId, "products", scope));
  const existingData = !replace && Array.isArray(existingRecord?.data) ? existingRecord.data : [];

  const map = new Map(existingData.map((item) => [item.id, withoutProductCost(item)]));
  products.forEach((p) => {
    if (p && p.id) {
      map.set(p.id, withoutProductCost(p));
    }
  });

  const merged = Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  await putItem(STORES.CACHED_CATALOG, {
    id: cacheKey(businessId, "products", scope),
    businessId,
    scope,
    data: merged,
    updatedAt: Date.now(),
  });
}

export async function getLocalProducts(businessId, scope = "manager") {
  if (!businessId) return [];
  const record = await getItem(STORES.CACHED_CATALOG, cacheKey(businessId, "products", scope));
  return record?.businessId === businessId && record?.scope === scope
    ? (record.data || []).map(withoutProductCost)
    : [];
}

export async function cacheLocalCategories(businessId, categories) {
  if (!Array.isArray(categories) || !categories.length) return;
  const existingRecord = await getItem(STORES.CACHED_CATALOG, cacheKey(businessId, "categories"));
  const existingData = Array.isArray(existingRecord?.data) ? existingRecord.data : [];

  const set = new Set([...existingData, ...categories]);
  await putItem(STORES.CACHED_CATALOG, {
    id: cacheKey(businessId, "categories"),
    businessId,
    data: Array.from(set).sort(),
    updatedAt: Date.now(),
  });
}

export async function getLocalCategories(businessId) {
  if (!businessId) return [];
  const record = await getItem(STORES.CACHED_CATALOG, cacheKey(businessId, "categories"));
  return record?.businessId === businessId ? record.data || [] : [];
}

export async function cacheLocalCustomers(businessId, customers) {
  if (!Array.isArray(customers) || !customers.length) return;
  const existingRecord = await getItem(STORES.CACHED_CUSTOMERS, cacheKey(businessId, "customers"));
  const existingData = Array.isArray(existingRecord?.data) ? existingRecord.data : [];

  const map = new Map(existingData.map((item) => [item.id, item]));
  customers.forEach((c) => {
    if (c && c.id) {
      map.set(c.id, c);
    }
  });

  const merged = Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  await putItem(STORES.CACHED_CUSTOMERS, {
    id: cacheKey(businessId, "customers"),
    businessId,
    data: merged,
    updatedAt: Date.now(),
  });
}

export async function getLocalCustomers(businessId) {
  if (!businessId) return [];
  const record = await getItem(STORES.CACHED_CUSTOMERS, cacheKey(businessId, "customers"));
  return record?.businessId === businessId ? record.data || [] : [];
}

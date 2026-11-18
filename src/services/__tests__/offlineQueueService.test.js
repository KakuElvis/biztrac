import { describe, it, expect, vi, beforeEach } from "vitest";

const memoryStore = new Map();

vi.mock("../../lib/offlineStore.js", () => {
  return {
    STORES: {
      QUEUED_SALES: "queued_sales",
      CONFLICTED_SALES: "conflicted_sales",
      CACHED_CATALOG: "cached_catalog",
      CACHED_CUSTOMERS: "cached_customers",
    },
    putItem: vi.fn(async (storeName, item) => {
      if (!memoryStore.has(storeName)) memoryStore.set(storeName, new Map());
      memoryStore.get(storeName).set(item.id, item);
      return item;
    }),
    getItem: vi.fn(async (storeName, key) => {
      return memoryStore.get(storeName)?.get(key) || null;
    }),
    getAllItems: vi.fn(async (storeName) => {
      return Array.from(memoryStore.get(storeName)?.values() || []);
    }),
    removeItem: vi.fn(async (storeName, key) => {
      const deleted = memoryStore.get(storeName)?.delete(key);
      return Boolean(deleted);
    }),
    clearStore: vi.fn(async (storeName) => {
      memoryStore.get(storeName)?.clear();
      return true;
    }),
  };
});

vi.mock("../../lib/toast.js", () => ({
  showToast: vi.fn(),
}));

import {
  enqueueOfflineSale,
  getQueuedSales,
  getConflictedSales,
  removeConflictedSale,
  clearConflictedSales,
  retryConflictedSale,
  syncOfflineQueue,
  MAX_SYNC_RETRIES,
} from "../offlineQueueService.js";
import { showToast } from "../../lib/toast.js";

describe("offlineQueueService - Deadlock Protection & Conflict Isolation", () => {
  beforeEach(() => {
    memoryStore.clear();
    vi.clearAllMocks();
  });

  it("enqueues sales with zero retryCount", async () => {
    const sale = await enqueueOfflineSale("biz-1", { total: 100 });
    expect(sale).toHaveProperty("id");
    expect(sale.retryCount).toBe(0);

    const queued = await getQueuedSales();
    expect(queued.length).toBe(1);
    expect(queued[0].payload.total).toBe(100);
  });

  it("successfully syncs sales and removes them from the queue", async () => {
    await enqueueOfflineSale("biz-1", { total: 50 });
    await enqueueOfflineSale("biz-1", { total: 120 });

    const completeMock = vi.fn().mockResolvedValue({ reference: "BT-1" });
    const count = await syncOfflineQueue(completeMock);

    expect(count).toBe(2);
    expect(completeMock).toHaveBeenCalledTimes(2);

    const remaining = await getQueuedSales();
    expect(remaining.length).toBe(0);
    expect(showToast).toHaveBeenCalledWith(
      "Saved offline sale synced successfully.",
      { type: "success" }
    );
  });

  it("isolates permanently failing sales to conflicted_sales and does NOT deadlock the queue", async () => {
    // Sale 1: Fails due to stock depletion on server
    await enqueueOfflineSale("biz-1", { id: "item-1", name: "Dress", quantity: 5 });
    // Sale 2: Valid sale that should still succeed
    await enqueueOfflineSale("biz-1", { id: "item-2", name: "Shirt", quantity: 1 });

    const completeMock = vi.fn().mockImplementation(async (_bizId, payload) => {
      if (payload.name === "Dress") {
        throw new Error("Dress only has 0 in stock.");
      }
      return { reference: "BT-SUCCESS" };
    });

    const syncedCount = await syncOfflineQueue(completeMock);

    // Sale 2 synced successfully despite Sale 1 failing!
    expect(syncedCount).toBe(1);

    // Sale 1 was moved to conflicted_sales
    const queued = await getQueuedSales();
    expect(queued.length).toBe(0);

    const conflicted = await getConflictedSales();
    expect(conflicted.length).toBe(1);
    expect(conflicted[0].payload.name).toBe("Dress");
    expect(conflicted[0].conflictError).toContain("only has 0 in stock");

    // UI was notified with error toast
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("Offline sale sync conflict"),
      expect.objectContaining({ type: "error" })
    );
  });

  it("moves sale to conflicted queue after exceeding MAX_SYNC_RETRIES", async () => {
    await enqueueOfflineSale("biz-1", { name: "Bag", quantity: 1 });

    const completeMock = vi.fn().mockRejectedValue(new Error("Database connection refused"));

    // Attempt 1
    await syncOfflineQueue(completeMock);
    let queued = await getQueuedSales();
    expect(queued.length).toBe(1);
    expect(queued[0].retryCount).toBe(1);

    // Attempt 2
    await syncOfflineQueue(completeMock);
    queued = await getQueuedSales();
    expect(queued.length).toBe(1);
    expect(queued[0].retryCount).toBe(2);

    // Attempt 3: Exceeds MAX_SYNC_RETRIES (3) -> moves to conflicted_sales
    await syncOfflineQueue(completeMock);
    queued = await getQueuedSales();
    expect(queued.length).toBe(0);

    const conflicted = await getConflictedSales();
    expect(conflicted.length).toBe(1);
    expect(conflicted[0].retryCount).toBe(MAX_SYNC_RETRIES);
  });

  it("allows retrying and dismissing conflicted sales", async () => {
    await enqueueOfflineSale("biz-1", { name: "Shoes" });

    const completeMock = vi.fn().mockRejectedValue(new Error("Shoes only has 0 in stock."));
    await syncOfflineQueue(completeMock);

    const conflicted = await getConflictedSales();
    expect(conflicted.length).toBe(1);
    const conflictedId = conflicted[0].id;

    // Retry conflicted sale -> requeues it with retryCount 0
    const requeued = await retryConflictedSale(conflictedId);
    expect(requeued).not.toBeNull();
    expect(requeued.retryCount).toBe(0);

    expect((await getConflictedSales()).length).toBe(0);
    expect((await getQueuedSales()).length).toBe(1);

    // Clean up
    await removeConflictedSale(conflictedId);
    await clearConflictedSales();
    expect((await getConflictedSales()).length).toBe(0);
  });
});

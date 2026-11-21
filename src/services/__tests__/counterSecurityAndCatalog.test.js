import { describe, it, expect, vi, beforeEach } from "vitest";

// Memory storage for IndexedDB mock
const memoryStore = new Map();

vi.mock("../../lib/offlineStore.js", () => ({
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
    return Boolean(memoryStore.get(storeName)?.delete(key));
  }),
  clearStore: vi.fn(async (storeName) => {
    memoryStore.get(storeName)?.clear();
    return true;
  }),
}));

const mockLocalStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => mockLocalStorage.get(k) || null,
  setItem: (k, v) => mockLocalStorage.set(k, String(v)),
  removeItem: (k) => mockLocalStorage.delete(k),
  clear: () => mockLocalStorage.clear(),
};
globalThis.window = globalThis;

import {
  setActiveStaffSession,
  getStaffSessionToken,
  clearActiveStaffSession,
} from "../staffService.js";
import {
  cacheLocalProducts,
  getLocalProducts,
} from "../offlineQueueService.js";

describe("Counter Security & Session Authentication", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    memoryStore.clear();
    vi.clearAllMocks();
  });

  it("extracts cryptographic session token from active staff session", () => {
    expect(getStaffSessionToken()).toBeNull();

    const mockSession = {
      user: { id: "staff-uuid-1", staffId: "AB102", fullName: "Cashier Alice" },
      sessionToken: "sec_tok_f4e19028a38c82119bb9e88d011234",
      expiresAt: Date.now() + 1000 * 60 * 60 * 14,
    };

    setActiveStaffSession(mockSession);
    expect(getStaffSessionToken()).toBe("sec_tok_f4e19028a38c82119bb9e88d011234");

    clearActiveStaffSession();
    expect(getStaffSessionToken()).toBeNull();
  });

  it("merges paged products in offline cache instead of overwriting", async () => {
    const bizId = "biz-merge-test";

    // Page 1 products
    const page1 = [
      { id: "prod-1", name: "Apple Juice", sellingPrice: 15 },
      { id: "prod-2", name: "Bread", sellingPrice: 20 },
    ];
    await cacheLocalProducts(bizId, page1, "counter");

    let cached = await getLocalProducts(bizId, "counter");
    expect(cached.length).toBe(2);
    expect(cached.map((p) => p.name)).toEqual(["Apple Juice", "Bread"]);

    // Page 2 products
    const page2 = [
      { id: "prod-3", name: "Corn Flakes", sellingPrice: 35 },
      { id: "prod-1", name: "Apple Juice", sellingPrice: 16 }, // Updated price
    ];
    await cacheLocalProducts(bizId, page2, "counter");

    cached = await getLocalProducts(bizId, "counter");
    // Should have all 3 products merged without duplicates!
    expect(cached.length).toBe(3);
    const apple = cached.find((p) => p.id === "prod-1");
    expect(apple.sellingPrice).toBe(16);
    expect(cached.some((p) => p.id === "prod-2")).toBe(true);
    expect(cached.some((p) => p.id === "prod-3")).toBe(true);
  });
});

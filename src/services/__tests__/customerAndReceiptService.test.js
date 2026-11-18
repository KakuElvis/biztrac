import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getLocalReceiptSettings,
  saveLocalReceiptSettings,
  toBusiness,
} from "../businessService.js";
import { forgiveCustomerDebt } from "../customerService.js";

// Mock localStorage for node test environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};
globalThis.window = globalThis;

// Mock Supabase
vi.mock("../../lib/supabase.js", () => {
  const rpcMock = vi.fn();
  return {
    isSupabaseConfigured: true,
    supabase: {
      rpc: rpcMock,
    },
  };
});

describe("Receipt Settings & Thermal Formatting", () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it("stores and retrieves local receipt settings", () => {
    const bId = "biz-test-123";
    const settings = {
      slogan: "Excellence in Every Thread",
      momo_details: "0244000111 (Biz Boutique)",
      return_policy: "No returns after 48 hours",
      receipt_width: "80mm",
      receipt_footer: "Come back soon!",
    };

    saveLocalReceiptSettings(bId, settings);
    const retrieved = getLocalReceiptSettings(bId);

    expect(retrieved).toEqual(settings);
  });

  it("merges remote business row with local settings and sensible defaults", () => {
    const bId = "biz-defaults-456";
    const remoteRow = {
      id: bId,
      name: "Accra Super Provisions",
      phone: "0244123456",
      email: "shop@example.com",
      location: "Makola Market, Accra",
      currency: "GHS",
    };

    const business = toBusiness(remoteRow);

    expect(business.name).toBe("Accra Super Provisions");
    expect(business.receipt_width).toBe("58mm");
    expect(business.return_policy).toBe("Goods sold in good condition are not returnable after 3 days.");
    expect(business.receipt_footer).toBe("Thank you for your patronage! Visit again.");
  });
});

describe("forgiveCustomerDebt RPC service", () => {
  it("invokes forgive_customer_debt RPC with expected parameters", async () => {
    const { supabase } = await import("../../lib/supabase.js");
    supabase.rpc.mockResolvedValueOnce({ data: 150.0, error: null });

    const result = await forgiveCustomerDebt("biz-99", "cust-77", {
      saleId: "sale-11",
      reason: "Owner approved discount",
      status: "forgiven",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("forgive_customer_debt", {
      p_business_id: "biz-99",
      p_customer_id: "cust-77",
      p_sale_id: "sale-11",
      p_reason: "Owner approved discount",
      p_status: "forgiven",
    });
    expect(result).toBe(150.0);
  });

  it("throws error when Supabase RPC returns an error", async () => {
    const { supabase } = await import("../../lib/supabase.js");
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error("Only business managers and owners can forgive or write off customer debt."),
    });

    await expect(
      forgiveCustomerDebt("biz-99", "cust-77", {
        reason: "Test",
        status: "written_off",
      })
    ).rejects.toThrow("Only business managers and owners can forgive or write off customer debt.");
  });
});

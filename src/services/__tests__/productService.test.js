import { describe, it, expect, vi } from "vitest";

vi.mock("../../lib/supabase.js", () => {
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn(),
    },
  };
});

import { supabase } from "../../lib/supabase.js";
import { restockProduct } from "../productService.js";

describe("productService restockProduct", () => {
  it("uses RPC when available", async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: {
        product_id: "prod-1",
        previous_quantity: 10,
        new_quantity: 15,
        cost_price: 20,
        selling_price: 30,
      },
      error: null,
    });

    const res = await restockProduct("biz-1", "prod-1", {
      quantityAdded: 5,
      newCostPrice: 20,
      newSellingPrice: 30,
    });

    expect(res.new_quantity).toBe(15);
    expect(supabase.rpc).toHaveBeenCalledWith("restock_product", expect.any(Object));
  });

  it("falls back to direct table update when RPC function is missing from schema cache", async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.restock_product in the schema cache",
      },
    });

    const mockSelectChain = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { quantity: 10, cost_price: 15, selling_price: 25 },
        error: null,
      }),
    };

    const mockUpdateChain = {
      eq: vi.fn().mockReturnThis(),
    };

    const mockInsertChain = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    supabase.from.mockImplementation((tableName) => {
      if (tableName === "products") {
        return {
          select: () => mockSelectChain,
          update: () => mockUpdateChain,
        };
      }
      if (tableName === "product_restocks") {
        return mockInsertChain;
      }
      return {};
    });

    const res = await restockProduct("biz-1", "prod-1", {
      quantityAdded: 5,
      newCostPrice: 20,
      newSellingPrice: 30,
    });

    expect(res.previous_quantity).toBe(10);
    expect(res.new_quantity).toBe(15);
    expect(res.cost_price).toBe(20);
    expect(res.selling_price).toBe(30);
  });
});

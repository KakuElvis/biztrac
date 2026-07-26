import { describe, it, expect } from "vitest";
import { createSale } from "../saleService.js";

describe("Sale Service Validation", () => {
  it("rejects sales with empty cart lines", async () => {
    await expect(
      createSale("biz-1", { customer: null, lines: [], paymentType: "cash" })
    ).rejects.toThrow("Add at least one product to the cart.");
  });

  it("rejects sales with missing product id", async () => {
    const invalidLines = [{ product: {}, quantity: 1 }];
    await expect(
      createSale("biz-1", { customer: null, lines: invalidLines, paymentType: "cash" })
    ).rejects.toThrow("A cart item is missing its product.");
  });

  it("rejects sales with quantity exceeding available stock", async () => {
    const overStockLines = [
      { product: { id: "p-1", name: "Sample Item", quantity: 2 }, quantity: 5 },
    ];
    await expect(
      createSale("biz-1", { customer: null, lines: overStockLines, paymentType: "cash" })
    ).rejects.toThrow("Sample Item only has 2 in stock.");
  });

  it("rejects credit sales without customer selection or name", async () => {
    const validLines = [
      { product: { id: "p-1", name: "Sample Item", quantity: 10 }, quantity: 1 },
    ];
    await expect(
      createSale("biz-1", { customer: null, lines: validLines, paymentType: "credit" })
    ).rejects.toThrow("Credit sales require a customer.");
  });
});

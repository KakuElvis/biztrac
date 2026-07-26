import { describe, it, expect } from "vitest";
import { demoRepository } from "../demoRepository.js";

describe("Demo Repository Logic", () => {
  it("fetches list of initial products", async () => {
    const products = await demoRepository.listProducts("demo");
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });

  it("supports category filtering in listProducts", async () => {
    const allProducts = await demoRepository.listProducts("demo");
    const categoryName = allProducts[0].category;

    const filtered = await demoRepository.listProducts("demo", { category: categoryName });
    expect(filtered.every((p) => p.category === categoryName)).toBe(true);
  });

  it("supports pagination in listProducts", async () => {
    const result = await demoRepository.listProducts("demo", { page: 1, pageSize: 2 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("totalCount");
    expect(result.data.length).toBeLessThanOrEqual(2);
  });

  it("creates a new product with random id", async () => {
    const newProd = await demoRepository.createProduct("demo", {
      name: "Test Dress",
      category: "Women",
      costPrice: 50,
      sellingPrice: 100,
      quantity: 10,
      lowStockLimit: 2,
    });

    expect(newProd).toHaveProperty("id");
    expect(newProd.name).toBe("Test Dress");
  });

  it("completes a sale in demo mode and updates inventory", async () => {
    const currentProducts = [
      { id: "p1", name: "Kente Cloth", costPrice: 40, sellingPrice: 80, quantity: 10 },
    ];
    const lines = [{ productId: "p1", product: currentProducts[0], quantity: 2, total: 160 }];

    const result = await demoRepository.completeSale({
      customer: { mode: "walk-in" },
      lines,
      currentProducts,
    });

    expect(result).toHaveProperty("reference");
    expect(result.updatedProducts[0].quantity).toBe(8);
  });

  it("handles credit sale with down payment and due date", async () => {
    const currentProducts = [
      { id: "p1", name: "Kente Cloth", costPrice: 40, sellingPrice: 100, quantity: 5 },
    ];
    const lines = [{ productId: "p1", product: currentProducts[0], quantity: 2, total: 200 }];

    const result = await demoRepository.completeSale({
      customer: { mode: "existing", id: "c-1" },
      lines,
      currentProducts,
      paymentType: "Credit",
      amountPaid: 50,
      dueDate: "2026-08-15",
    });

    expect(result.sale.amountPaid).toBe(50);
    expect(result.sale.dueDate).toBe("2026-08-15");
    expect(result.sale.total).toBe(200);
  });
});

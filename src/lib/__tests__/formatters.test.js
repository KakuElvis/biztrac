import { describe, it, expect } from "vitest";
import { formatCurrency } from "../formatters.js";
import { shortReference, formatPaymentMethod } from "../../services/serviceUtils.js";

describe("Service Utils & Formatters", () => {
  it("formats numbers to currency string and preserves 2 decimal places for VAT and pesewas", () => {
    const formatted = formatCurrency(1500.5);
    expect(formatted).toMatch(/1,500\.50/);
    expect(formatted).toMatch(/GHS|GH₵/);

    const vatFormatted = formatCurrency(2.25);
    expect(vatFormatted).toMatch(/2\.25/);
  });

  it("extracts short reference from row object", () => {
    const ref = shortReference({ reference: "BT-20260725-123456-ABCDEF" });
    expect(ref).toBe("BT-20260725-123456-ABCDEF");
  });

  it("truncates ID when reference is missing", () => {
    const ref = shortReference({ id: "12345678-90ab-cdef-1234-567890abcdef" });
    expect(ref).toBe("BT-12345678");
  });

  it("formats payment method names cleanly", () => {
    expect(formatPaymentMethod("momo")).toBe("MoMo");
    expect(formatPaymentMethod("cash")).toBe("Cash");
    expect(formatPaymentMethod("credit")).toBe("Credit");
    expect(formatPaymentMethod("bank")).toBe("Bank");
  });
});

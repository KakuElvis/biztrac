import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getLocalReceiptSettings,
  saveLocalReceiptSettings,
  toBusiness,
} from "../businessService.js";
import { forgiveCustomerDebt } from "../customerService.js";
import { buildReceiptHtml, sampleTestReceipt } from "../../lib/receiptHtml.js";
import { formatCurrency } from "../../lib/formatters.js";

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
    expect(business.auto_print_receipt).toBe(false);
  });

  it("persists auto_print_receipt setting and renders test receipt html correctly", () => {
    const bId = "biz-auto-789";
    const settings = {
      auto_print_receipt: true,
      receipt_width: "80mm",
      momo_details: "0244112233",
    };
    saveLocalReceiptSettings(bId, settings);
    expect(getLocalReceiptSettings(bId).auto_print_receipt).toBe(true);

    const business = toBusiness({ id: bId, name: "Kaneshie Ventures" });
    expect(business.auto_print_receipt).toBe(true);
    expect(business.receipt_width).toBe("80mm");

    const html = buildReceiptHtml(sampleTestReceipt, business);
    expect(html).toContain("Kaneshie Ventures");
    expect(html).toContain("TEST-RECEIPT-001");
    expect(html).toContain("Store Cashier");
    expect(html).toContain("MoMo: 0244112233");
    expect(html).toContain("72mm"); // 80mm printable width
  });

  it("renders cashier name on receipt HTML when provided", () => {
    const business = { name: "Accra Mart", receipt_width: "58mm" };
    const receiptWithCashier = {
      reference: "REC-CASHIER-01",
      cashierName: "Abena Mensah (YL166)",
      customerName: "Kojo Antwi",
      paymentType: "Cash",
      lines: [{ name: "Sugar 1kg", quantity: 2, unitPrice: 20, total: 40 }],
      total: 40,
    };

    const html = buildReceiptHtml(receiptWithCashier, business);
    expect(html).toContain("<span>Cashier:</span>");
    expect(html).toContain("<strong>Abena Mensah (YL166)</strong>");
  });

  it("formats MoMo and Bank payment account and amount paid into receipt HTML", () => {
    const momoReceipt = {
      reference: "REC-MOMO-001",
      customerName: "Kofi Mensah",
      paymentType: "MoMo",
      paymentAccount: "0244123456 (MTN)",
      lines: [{ name: "Rice 5kg", quantity: 1, unitPrice: 150, total: 150 }],
      total: 150,
      amountPaid: 150,
    };
    const business = { name: "Accra Mart", receipt_width: "58mm" };
    const html = buildReceiptHtml(momoReceipt, business);

    expect(html).toContain("Account / Ref:");
    expect(html).toContain("0244123456 (MTN)");
    expect(html).toContain("Amount Paid (MoMo):");
    expect(html).toContain(formatCurrency(150));

    const bankReceipt = {
      reference: "REC-BANK-002",
      customerName: "Ama Serwaa",
      paymentType: "Bank",
      paymentAccount: "GCB Transfer Ref #99281",
      lines: [{ name: "Cooking Oil 25L", quantity: 1, unitPrice: 500, total: 500 }],
      total: 500,
      amountPaid: 350,
    };
    const bankHtml = buildReceiptHtml(bankReceipt, business);
    expect(bankHtml).toContain("<span>Payment:</span><strong>Bank</strong>");
    expect(bankHtml).toContain("Account / Ref:");
    expect(bankHtml).toContain("GCB Transfer Ref #99281");
    expect(bankHtml).toContain("Amount Paid (Bank):");
    expect(bankHtml).toContain(formatCurrency(350));
    expect(bankHtml).toContain("BALANCE DUE:");
    expect(bankHtml).toContain(formatCurrency(150));
  });

  it("handles receipt with missing total safely without producing NaN", () => {
    const emptyReceipt = {
      reference: "REC-EMPTY",
      customerName: "Walk-in",
      paymentType: "Cash",
      lines: [],
    };
    const business = { name: "Accra Mart" };
    const html = buildReceiptHtml(emptyReceipt, business);

    expect(html).not.toContain("NaN");
    expect(html).toContain("TOTAL:");
  });

  it("renders Ghana VAT (Act 1151) tax breakdown and TIN when VAT is enabled", () => {
    const business = {
      name: "Accra Super Mart",
      tin_number: "C0012345678",
      vat_enabled: true,
      receipt_width: "80mm",
    };
    const vatReceipt = {
      reference: "REC-VAT-001",
      cashierName: "Kofi Owusu (YL101)",
      customerName: "Kwame Kwarteng",
      paymentType: "Cash",
      lines: [{ name: "Standard Supply A", quantity: 1, unitPrice: 100, total: 120 }],
      subtotalExTax: 100.0,
      totalNhil: 2.5,
      totalGetfund: 2.5,
      totalVat: 15.0,
      totalTax: 20.0,
      total: 120.0,
    };

    const html = buildReceiptHtml(vatReceipt, business);

    expect(html).toContain("TIN:");
    expect(html).toContain("C0012345678");
    expect(html).toContain("Net Subtotal:");
    expect(html).toContain("NHIL (2.5%):");
    expect(html).toContain("GETFund (2.5%):");
    expect(html).toContain("VAT (15%):");
    expect(html).toContain("Total Tax (Act 1151):");
    expect(html).toContain(formatCurrency(20));
    expect(html).toContain(formatCurrency(120));
  });

  it("omits tax breakdown and TIN when VAT is disabled on the receipt and business", () => {
    const business = {
      name: "Makola Local Mart",
      vat_enabled: false,
      receipt_width: "58mm",
    };
    const nonVatReceipt = {
      reference: "REC-NONVAT-002",
      customerName: "Walk-in",
      paymentType: "Cash",
      lines: [{ name: "Plain Bread", quantity: 1, unitPrice: 15, total: 15 }],
      totalTax: 0,
      total: 15.0,
    };

    const html = buildReceiptHtml(nonVatReceipt, business);

    expect(html).not.toContain("TIN:");
    expect(html).not.toContain("NHIL (2.5%):");
    expect(html).not.toContain("GETFund (2.5%):");
    expect(html).not.toContain("VAT (15%):");
    expect(html).not.toContain("Total Tax (Act 1151):");
    expect(html).toContain("TOTAL:");
    expect(html).toContain(formatCurrency(15));
  });

  it("renders custom tax rate percentages on receipt HTML when modified by business owner", () => {
    const business = {
      name: "Tema Port Wholesale",
      tin_number: "C9988776655",
      vat_enabled: true,
      vat_rate: 12.5,
      nhil_rate: 3.0,
      getfund_rate: 2.5,
      receipt_width: "80mm",
    };
    const customVatReceipt = {
      reference: "REC-CUSTOM-VAT-01",
      customerName: "Amidu & Sons Ltd",
      paymentType: "Cash",
      lines: [{ name: "Import Goods Batch", quantity: 1, unitPrice: 200, total: 236 }],
      subtotalExTax: 200.0,
      totalNhil: 6.0,
      totalGetfund: 5.0,
      totalVat: 25.0,
      totalTax: 36.0,
      vatRate: 12.5,
      nhilRate: 3.0,
      getfundRate: 2.5,
      total: 236.0,
    };

    const html = buildReceiptHtml(customVatReceipt, business);

    expect(html).toContain("TIN:");
    expect(html).toContain("C9988776655");
    expect(html).toContain("NHIL (3%):");
    expect(html).toContain("GETFund (2.5%):");
    expect(html).toContain("VAT (12.5%):");
    expect(html).toContain("Total Tax (Act 1151):");
    expect(html).toContain(formatCurrency(36));
    expect(html).toContain(formatCurrency(236));
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

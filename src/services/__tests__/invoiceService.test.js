import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateDocNumber,
  getInitialInvoice,
  listInvoices,
  saveInvoiceRecord,
  deleteInvoiceRecord,
  updateInvoiceStatus,
} from "../invoiceService.js";

// Mock localStorage for node test environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};
globalThis.window = globalThis;

vi.mock("../../lib/supabase.js", () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

describe("Invoice Service", () => {
  const businessId = "biz-test-123";

  beforeEach(() => {
    mockStorage.clear();
  });

  it("generates formatted document numbers with proper prefixes", () => {
    const invNum = generateDocNumber("invoice");
    expect(invNum).toMatch(/^BT-INV-\d{4}-\d{4}$/);

    const qtNum = generateDocNumber("quotation");
    expect(qtNum).toMatch(/^BT-QT-\d{4}-\d{4}$/);

    const recNum = generateDocNumber("receipt");
    expect(recNum).toMatch(/^BT-REC-\d{4}-\d{4}$/);

    const piNum = generateDocNumber("proforma");
    expect(piNum).toMatch(/^BT-PI-\d{4}-\d{4}$/);
  });

  it("creates initial invoice document with VAT defaults when business has VAT enabled", () => {
    const businessWithVat = {
      id: businessId,
      name: "Accra Superstore",
      vat_enabled: true,
      vat_rate: 15,
      nhil_rate: 2.5,
      getfund_rate: 2.5,
      momo_details: "MTN 0244123456",
    };

    const initial = getInitialInvoice(businessWithVat);
    expect(initial.tax_rate).toBe(20);
    expect(initial.bank_momo_details).toBe("MTN 0244123456");
    expect(initial.status).toBe("draft");
    expect(initial.items.length).toBe(1);
  });

  it("creates initial invoice with 0% tax when business VAT is disabled", () => {
    const businessNoVat = {
      id: businessId,
      name: "Simple Shop",
      vat_enabled: false,
    };

    const initial = getInitialInvoice(businessNoVat);
    expect(initial.tax_rate).toBe(0);
  });

  it("saves, lists, updates status, and deletes an invoice in local cache", async () => {
    const doc = {
      doc_number: "BT-INV-2026-1001",
      doc_type: "invoice",
      status: "draft",
      customer_name: "Ama Mensah",
      customer_phone: "0244123456",
      subtotal: 500,
      discount_amount: 50,
      tax_rate: 20,
      tax_amount: 90,
      total_amount: 540,
      items: [
        {
          id: "item-1",
          description: "Office Chair",
          quantity: 1,
          unit_price: 500,
          line_total: 500,
        },
      ],
    };

    const saved = await saveInvoiceRecord(businessId, doc);
    expect(saved.id).toBeDefined();
    expect(saved.customer_name).toBe("Ama Mensah");

    const list = await listInvoices(businessId);
    expect(list.length).toBe(1);
    expect(list[0].doc_number).toBe("BT-INV-2026-1001");

    await updateInvoiceStatus(businessId, saved.id, "paid");
    const updatedList = await listInvoices(businessId);
    expect(updatedList[0].status).toBe("paid");

    await deleteInvoiceRecord(businessId, saved.id);
    const emptyList = await listInvoices(businessId);
    expect(emptyList.length).toBe(0);
  });
});

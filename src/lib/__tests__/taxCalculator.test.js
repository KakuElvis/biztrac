import { describe, it, expect } from "vitest";
import {
  calculateLineTax,
  calculateSaleTaxes,
  TAX_TREATMENTS,
  DEFAULT_GHANA_RATES,
} from "../taxCalculator.js";

describe("taxCalculator - Ghana Act 1151 (2026)", () => {
  const ghanaConfigExclusive = {
    vat_enabled: true,
    tin_number: "P0012345678",
    tax_pricing_mode: "exclusive",
    vat_rate: 15.0,
    nhil_rate: 2.5,
    getfund_rate: 2.5,
  };

  const ghanaConfigInclusive = {
    vat_enabled: true,
    tin_number: "P0012345678",
    tax_pricing_mode: "inclusive",
    vat_rate: 15.0,
    nhil_rate: 2.5,
    getfund_rate: 2.5,
  };

  const disabledConfig = {
    vat_enabled: false,
    tax_pricing_mode: "exclusive",
  };

  it("calculates standard 20% Ghana tax in exclusive mode correctly", () => {
    // 1 item @ GHS 100
    const line = {
      quantity: 1,
      unitPrice: 100,
      product: { taxTreatment: TAX_TREATMENTS.STANDARD },
    };

    const tax = calculateLineTax(line, ghanaConfigExclusive);
    expect(tax.isTaxable).toBe(true);
    expect(tax.taxableAmount).toBe(100.0);
    expect(tax.nhilAmount).toBe(2.5);
    expect(tax.getfundAmount).toBe(2.5);
    expect(tax.vatAmount).toBe(15.0);
    expect(tax.totalTax).toBe(20.0);
    expect(tax.lineTotal).toBe(120.0);
  });

  it("calculates standard 20% Ghana tax in inclusive mode correctly", () => {
    // Tagged shelf price is GHS 120 (including 20% tax)
    const line = {
      quantity: 1,
      unitPrice: 120,
      product: { taxTreatment: TAX_TREATMENTS.STANDARD },
    };

    const tax = calculateLineTax(line, ghanaConfigInclusive);
    expect(tax.isTaxable).toBe(true);
    expect(tax.taxableAmount).toBe(100.0); // 120 / 1.20 = 100.00
    expect(tax.nhilAmount).toBe(2.5);
    expect(tax.getfundAmount).toBe(2.5);
    expect(tax.vatAmount).toBe(15.0);
    expect(tax.totalTax).toBe(20.0);
    expect(tax.lineTotal).toBe(120.0);
  });

  it("handles zero-rated and exempt items with 0 tax even when VAT is enabled", () => {
    const zeroRatedLine = {
      quantity: 2,
      unitPrice: 50,
      product: { taxTreatment: TAX_TREATMENTS.ZERO_RATED },
    };
    const zeroTax = calculateLineTax(zeroRatedLine, ghanaConfigExclusive);
    expect(zeroTax.totalTax).toBe(0);
    expect(zeroTax.lineTotal).toBe(100.0);

    const exemptLine = {
      quantity: 3,
      unitPrice: 10,
      product: { taxTreatment: TAX_TREATMENTS.EXEMPT },
    };
    const exemptTax = calculateLineTax(exemptLine, ghanaConfigExclusive);
    expect(exemptTax.totalTax).toBe(0);
    expect(exemptTax.lineTotal).toBe(30.0);
  });

  it("bypasses tax calculation entirely when VAT is disabled", () => {
    const line = {
      quantity: 2,
      unitPrice: 75,
      product: { taxTreatment: TAX_TREATMENTS.STANDARD },
    };
    const tax = calculateLineTax(line, disabledConfig);
    expect(tax.isTaxable).toBe(false);
    expect(tax.totalTax).toBe(0);
    expect(tax.lineTotal).toBe(150.0);
  });

  it("calculates aggregate sale taxes with mixed product treatments", () => {
    const lines = [
      {
        quantity: 1,
        unitPrice: 100,
        product: { taxTreatment: TAX_TREATMENTS.STANDARD }, // Tax: 20
      },
      {
        quantity: 2,
        unitPrice: 40,
        product: { taxTreatment: TAX_TREATMENTS.EXEMPT }, // Tax: 0, Total: 80
      },
    ];

    const saleTax = calculateSaleTaxes(lines, ghanaConfigExclusive);
    expect(saleTax.isVatEnabled).toBe(true);
    expect(saleTax.totalNhil).toBe(2.5);
    expect(saleTax.totalGetfund).toBe(2.5);
    expect(saleTax.totalVat).toBe(15.0);
    expect(saleTax.totalTax).toBe(20.0);
    expect(saleTax.grandTotal).toBe(200.0); // 120 + 80 = 200
  });

  it("calculates taxes with owner-customized rates when legislation changes", () => {
    // e.g. If owner sets VAT to 12.5%, NHIL to 3.0%, GETFund to 2.5% (Total 18%)
    const amendedRateConfig = {
      vat_enabled: true,
      tin_number: "P0012345678",
      tax_pricing_mode: "exclusive",
      vat_rate: 12.5,
      nhil_rate: 3.0,
      getfund_rate: 2.5,
    };

    const line = {
      quantity: 1,
      unitPrice: 200,
      product: { taxTreatment: TAX_TREATMENTS.STANDARD },
    };

    const tax = calculateLineTax(line, amendedRateConfig);
    expect(tax.isTaxable).toBe(true);
    expect(tax.taxableAmount).toBe(200.0);
    expect(tax.nhilAmount).toBe(6.0); // 200 * 3% = 6.00
    expect(tax.getfundAmount).toBe(5.0); // 200 * 2.5% = 5.00
    expect(tax.vatAmount).toBe(25.0); // 200 * 12.5% = 25.00
    expect(tax.totalTax).toBe(36.0); // 6 + 5 + 25 = 36.00
    expect(tax.lineTotal).toBe(236.0);

    const summary = calculateSaleTaxes([line], amendedRateConfig);
    expect(summary.vatRate).toBe(12.5);
    expect(summary.nhilRate).toBe(3.0);
    expect(summary.getfundRate).toBe(2.5);
    expect(summary.combinedRate).toBe(18.0);
    expect(summary.totalTax).toBe(36.0);
    expect(summary.grandTotal).toBe(236.0);
  });
});

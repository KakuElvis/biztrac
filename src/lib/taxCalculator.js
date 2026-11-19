/**
 * Ghana VAT Act 2025 (Act 1151) Tax Calculation Engine
 *
 * Implements Ghana's standard consumption tax structure:
 * - VAT: 15.0%
 * - NHIL: 2.5%
 * - GETFund Levy: 2.5%
 * Combined Standard Rate: 20.0%
 *
 * Supports Tax-Exclusive (Price + Tax) and Tax-Inclusive (Price includes Tax),
 * as well as Standard-Rated, Zero-Rated (0%), and Exempt classifications.
 */

export const TAX_TREATMENTS = Object.freeze({
  STANDARD: "standard",
  ZERO_RATED: "zero_rated",
  EXEMPT: "exempt",
});

export const TAX_TREATMENT_LABELS = Object.freeze({
  [TAX_TREATMENTS.STANDARD]: "Standard-Rated (20% Act 1151)",
  [TAX_TREATMENTS.ZERO_RATED]: "Zero-Rated (0%)",
  [TAX_TREATMENTS.EXEMPT]: "Exempt (No Tax)",
});

export const DEFAULT_GHANA_RATES = Object.freeze({
  vatRate: 15.0,
  nhilRate: 2.5,
  getfundRate: 2.5,
  combinedRate: 20.0,
});

function round2(val) {
  return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates tax breakdown for an individual cart line
 */
export function calculateLineTax(line, businessConfig = {}) {
  const isVatEnabled = Boolean(businessConfig.vat_enabled);
  const pricingMode = businessConfig.tax_pricing_mode || "exclusive"; // 'exclusive' | 'inclusive'

  const vatRate = Number(businessConfig.vat_rate ?? DEFAULT_GHANA_RATES.vatRate) / 100;
  const nhilRate = Number(businessConfig.nhil_rate ?? DEFAULT_GHANA_RATES.nhilRate) / 100;
  const getfundRate = Number(businessConfig.getfund_rate ?? DEFAULT_GHANA_RATES.getfundRate) / 100;
  const combinedRate = vatRate + nhilRate + getfundRate;

  const qty = Number(line.quantityNum ?? line.quantity) || 0;
  const unitPrice = Number(line.product?.sellingPrice ?? line.unitPrice ?? 0);
  const treatment = line.product?.taxTreatment || line.taxTreatment || TAX_TREATMENTS.STANDARD;

  // Base raw amount (quantity * unit price)
  const rawSubtotal = round2(qty * unitPrice);

  if (!isVatEnabled || treatment === TAX_TREATMENTS.EXEMPT || treatment === TAX_TREATMENTS.ZERO_RATED) {
    return {
      treatment,
      isTaxable: false,
      taxableAmount: rawSubtotal,
      nhilAmount: 0,
      getfundAmount: 0,
      vatAmount: 0,
      totalTax: 0,
      lineTotal: rawSubtotal,
    };
  }

  // Standard-Rated calculations
  if (pricingMode === "inclusive") {
    // Tag price already includes the 20% combined tax
    const taxableAmount = round2(rawSubtotal / (1 + combinedRate));
    const nhilAmount = round2(taxableAmount * nhilRate);
    const getfundAmount = round2(taxableAmount * getfundRate);
    const vatAmount = round2(taxableAmount * vatRate);
    const totalTax = round2(nhilAmount + getfundAmount + vatAmount);

    return {
      treatment,
      isTaxable: true,
      taxableAmount,
      nhilAmount,
      getfundAmount,
      vatAmount,
      totalTax,
      lineTotal: rawSubtotal, // Customer pays the tagged price
    };
  }

  // Exclusive pricing: add tax on top of listed unit price
  const taxableAmount = rawSubtotal;
  const nhilAmount = round2(taxableAmount * nhilRate);
  const getfundAmount = round2(taxableAmount * getfundRate);
  const vatAmount = round2(taxableAmount * vatRate);
  const totalTax = round2(nhilAmount + getfundAmount + vatAmount);
  const lineTotal = round2(taxableAmount + totalTax);

  return {
    treatment,
    isTaxable: true,
    taxableAmount,
    nhilAmount,
    getfundAmount,
    vatAmount,
    totalTax,
    lineTotal,
  };
}

/**
 * Calculates complete tax summary across all cart lines
 */
export function calculateSaleTaxes(lines = [], businessConfig = {}) {
  const isVatEnabled = Boolean(businessConfig.vat_enabled);
  const pricingMode = businessConfig.tax_pricing_mode || "exclusive";
  const vatRate = Number(businessConfig.vat_rate ?? DEFAULT_GHANA_RATES.vatRate);
  const nhilRate = Number(businessConfig.nhil_rate ?? DEFAULT_GHANA_RATES.nhilRate);
  const getfundRate = Number(businessConfig.getfund_rate ?? DEFAULT_GHANA_RATES.getfundRate);
  const combinedRate = round2(vatRate + nhilRate + getfundRate);

  let subtotalExTax = 0;
  let totalNhil = 0;
  let totalGetfund = 0;
  let totalVat = 0;
  let totalTax = 0;
  let grandTotal = 0;

  const lineBreakdowns = lines.map((line) => {
    const breakdown = calculateLineTax(line, businessConfig);
    subtotalExTax += breakdown.taxableAmount;
    totalNhil += breakdown.nhilAmount;
    totalGetfund += breakdown.getfundAmount;
    totalVat += breakdown.vatAmount;
    totalTax += breakdown.totalTax;
    grandTotal += breakdown.lineTotal;
    return { ...line, ...breakdown };
  });

  return {
    isVatEnabled,
    pricingMode,
    vatRate,
    nhilRate,
    getfundRate,
    combinedRate,
    tinNumber: businessConfig.tin_number || "",
    subtotalExTax: round2(subtotalExTax),
    totalNhil: round2(totalNhil),
    totalGetfund: round2(totalGetfund),
    totalVat: round2(totalVat),
    totalTax: round2(totalTax),
    grandTotal: round2(grandTotal),
    lines: lineBreakdowns,
  };
}

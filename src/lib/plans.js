/**
 * BizTrac Subscription & Plan Configuration Module
 *
 * Defines the available plans (Free vs. Pro), the gated feature identifiers,
 * resource quota limits, and pricing tiers.
 */

export const PLANS = Object.freeze({
  FREE: "free",
  PRO: "pro",
  ENTERPRISE: "enterprise",
});

export const PRO_FEATURES = Object.freeze({
  UNLIMITED_PRODUCTS: "unlimited_products",
  MULTI_STAFF: "multi_staff",
  INVOICING: "invoicing",
  PROFIT_ANALYTICS: "profit_analytics",
  TAX_REPORTS: "tax_reports",
  DATA_EXPORT: "data_export",
  WHATSAPP_STATEMENTS: "whatsapp_statements",
  BARCODE_WEDGE: "barcode_wedge",
});

export const PLAN_LIMITS = Object.freeze({
  [PLANS.FREE]: {
    maxProducts: 50,
    maxStaff: 1, // Only store owner
    canViewProfit: false,
    canUseInvoices: false,
    canExportReports: false,
    canUseTaxReports: false,
    canUseWhatsAppStatements: false,
  },
  [PLANS.PRO]: {
    maxProducts: Infinity,
    maxStaff: Infinity,
    canViewProfit: true,
    canUseInvoices: true,
    canExportReports: true,
    canUseTaxReports: true,
    canUseWhatsAppStatements: true,
  },
  [PLANS.ENTERPRISE]: {
    maxProducts: Infinity,
    maxStaff: Infinity,
    canViewProfit: true,
    canUseInvoices: true,
    canExportReports: true,
    canUseTaxReports: true,
    canUseWhatsAppStatements: true,
  },
});

export const PLAN_PRICING = Object.freeze({
  monthly: {
    id: "monthly",
    label: "Monthly",
    amount: 60,
    currency: "GHS",
    period: "month",
    durationDays: 30,
    description: "Full Pro features billed monthly.",
  },
  annual: {
    id: "annual",
    label: "Annual",
    amount: 600,
    currency: "GHS",
    period: "year",
    durationDays: 365,
    description: "Save 17% (2 months free) with annual billing.",
    savingsBadge: "Save 17%",
  },
});

export const PRO_PERKS = Object.freeze([
  {
    feature: PRO_FEATURES.UNLIMITED_PRODUCTS,
    title: "Unlimited Products & Barcodes",
    description: "Stock thousands of products with instant hardware barcode scanning.",
  },
  {
    feature: PRO_FEATURES.MULTI_STAFF,
    title: "Multi-Staff & Cashier PINs",
    description: "Add cashiers with private PINs, automatic lockout, and cashier mode simulation.",
  },
  {
    feature: PRO_FEATURES.INVOICING,
    title: "Commercial Invoices & Estimates",
    description: "Generate professional branded PDF invoices, quotations, and proforma bills.",
  },
  {
    feature: PRO_FEATURES.PROFIT_ANALYTICS,
    title: "Gross & Net Profit Tracking",
    description: "Track true margins with weighted average cost (AVCO) stock restock history.",
  },
  {
    feature: PRO_FEATURES.TAX_REPORTS,
    title: "Ghana VAT Act 1151 Tax Reports",
    description: "Detailed breakdown of VAT (15%), NHIL (2.5%), and GETFund (2.5%) for GRA filings.",
  },
  {
    feature: PRO_FEATURES.WHATSAPP_STATEMENTS,
    title: "WhatsApp Debt Reminders",
    description: "Send automated account statements and debt reminder messages directly on WhatsApp.",
  },
  {
    feature: PRO_FEATURES.DATA_EXPORT,
    title: "Excel & CSV Accountant Exports",
    description: "Export sales, expenses, and customer ledgers directly into spreadsheets.",
  },
]);

/**
 * Checks whether a given business holds an active Pro or Enterprise subscription.
 */
export function isProBusiness(business) {
  if (!business) return false;
  const tier = (business.plan_tier || "").toLowerCase();
  if (tier !== PLANS.PRO && tier !== PLANS.ENTERPRISE) return false;

  // If no expiration date is recorded, treat as lifetime or perpetual
  if (!business.plan_expires_at) return true;

  const expiry = new Date(business.plan_expires_at).getTime();
  return !isNaN(expiry) && expiry > Date.now();
}

/**
 * Returns how many days remain on an active subscription.
 */
export function getDaysRemaining(business) {
  if (!isProBusiness(business)) return 0;
  if (!business.plan_expires_at) return 999; // Perpetual
  const diffMs = new Date(business.plan_expires_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Checks if a business has access to a specific gated feature.
 */
export function canAccessFeature(business, featureKey) {
  if (isProBusiness(business)) return true;

  const limits = PLAN_LIMITS[PLANS.FREE];
  switch (featureKey) {
    case PRO_FEATURES.MULTI_STAFF:
      return limits.maxStaff > 1;
    case PRO_FEATURES.INVOICING:
      return limits.canUseInvoices;
    case PRO_FEATURES.PROFIT_ANALYTICS:
      return limits.canViewProfit;
    case PRO_FEATURES.TAX_REPORTS:
      return limits.canUseTaxReports;
    case PRO_FEATURES.DATA_EXPORT:
      return limits.canExportReports;
    case PRO_FEATURES.WHATSAPP_STATEMENTS:
      return limits.canUseWhatsAppStatements;
    case PRO_FEATURES.UNLIMITED_PRODUCTS:
      return false;
    default:
      return true;
  }
}

/**
 * Returns numeric limit for a business (e.g. maxProducts, maxStaff).
 */
export function getFeatureLimit(business, limitKey) {
  const isPro = isProBusiness(business);
  const tier = isPro ? PLANS.PRO : PLANS.FREE;
  return PLAN_LIMITS[tier]?.[limitKey] ?? 0;
}

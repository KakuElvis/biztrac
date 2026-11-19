/**
 * Staff & Role-Based Permissions Module for BizTrac
 *
 * Defines the core roles and granular capability checks to protect sensitive
 * financial margins (cost prices, gross/net profits, financial reports)
 * while empowering counter cashiers to ring up sales and print receipts.
 */

export const ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  STAFF: "staff",
  CASHIER: "cashier", // UI alias for staff
});

/**
 * Normalizes any role string to internal standard ('owner' | 'admin' | 'staff')
 */
export function normalizeRole(role) {
  if (!role || typeof role !== "string") return ROLES.STAFF;
  const lower = role.trim().toLowerCase();
  if (lower === "owner") return ROLES.OWNER;
  if (lower === "admin" || lower === "manager") return ROLES.ADMIN;
  return ROLES.STAFF;
}

export const ROLE_METADATA = Object.freeze({
  [ROLES.OWNER]: {
    id: ROLES.OWNER,
    label: "Store Owner",
    shortLabel: "Owner",
    tone: "purple",
    badgeBg: "bg-purple-100 text-purple-800 border-purple-200",
    description: "Full control over business settings, staff members, pricing, profits, and reports.",
  },
  [ROLES.ADMIN]: {
    id: ROLES.ADMIN,
    label: "Manager / Admin",
    shortLabel: "Manager",
    tone: "blue",
    badgeBg: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Can manage inventory, restock items, view profit margins, and manage cashiers.",
  },
  [ROLES.STAFF]: {
    id: ROLES.STAFF,
    label: "Cashier / Counter Staff",
    shortLabel: "Cashier",
    tone: "emerald",
    badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
    description: "Rings up sales, prints receipts, and records debt payments. Sensitive cost prices and store profits are hidden.",
  },
});

// Granular Capability Checkers

export function isOwner(role) {
  return normalizeRole(role) === ROLES.OWNER;
}

export function isAdmin(role) {
  return normalizeRole(role) === ROLES.ADMIN;
}

export function isOwnerOrAdmin(role) {
  const norm = normalizeRole(role);
  return norm === ROLES.OWNER || norm === ROLES.ADMIN;
}

export function isCashier(role) {
  return !isOwnerOrAdmin(role);
}

/**
 * Sensitive financial metrics: Cost price per item
 * Restricted to Owner and Admin/Manager
 */
export function canViewCostPrice(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Sensitive financial metrics: Estimated profit, gross profit, net profit margin
 * Restricted to Owner and Admin/Manager
 */
export function canViewProfit(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Financial Reports: Sales vs Costs, Valuation at Cost, P&L
 * Restricted to Owner and Admin/Manager
 */
export function canViewFinancialReports(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Reports screen access
 * Restricted to Owner and Admin/Manager
 */
export function canViewReports(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Expenses screen access & logging
 * Restricted to Owner and Admin/Manager
 */
export function canViewExpenses(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Stock / Inventory screen & catalog management
 * Restricted to Owner and Admin/Manager
 */
export function canViewStock(role) {
  return isOwnerOrAdmin(role);
}

/**
 * More screen access (Business settings, staff, printer, data)
 * Restricted to Owner and Admin/Manager
 */
export function canAccessMore(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Business Configuration: Name, phone, logo, thermal printer width, return policy
 * Restricted to Owner and Admin/Manager
 */
export function canManageSettings(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Staff & Team: Adding, updating roles, or removing staff members
 * Restricted to Owner (and Admin)
 */
export function canManageStaff(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Destructive action: Deleting catalog products or categories
 * Restricted to Owner and Admin
 */
export function canDeleteProducts(role) {
  return isOwnerOrAdmin(role);
}

export function canManageCategories(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Customer debt forgiveness / write-off (also enforced in Postgres RPC)
 * Restricted to Owner and Admin
 */
export function canForgiveDebt(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Restocking catalog items with new supplier batches and costs
 * Restricted to Owner and Admin
 */
export function canRestock(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Adding or editing product catalog details
 */
export function canEditProduct(role) {
  return isOwnerOrAdmin(role);
}

export function canCreateProduct(role) {
  return isOwnerOrAdmin(role);
}

/**
 * Core Cashier Capabilities (granted to all authenticated roles)
 */
export function canPerformSales() {
  return true;
}

export function canPrintReceipts() {
  return true;
}

export function canManageCustomers() {
  return true;
}

export function canRecordDebtPayment() {
  return true;
}

/**
 * Matrix of capabilities for display in UI tables
 */
export const PERMISSION_MATRIX = [
  {
    capability: "Ring up POS Sales & Checkout",
    category: "Sales",
    owner: true,
    admin: true,
    cashier: true,
    description: "Add items to cart, select MoMo/Bank/Cash, and complete sales.",
  },
  {
    capability: "Thermal & Digital Receipts",
    category: "Sales",
    owner: true,
    admin: true,
    cashier: true,
    description: "Print 58mm/80mm thermal receipts, share WhatsApp receipts, and download PDF receipts.",
  },
  {
    capability: "Customer Debt Payments",
    category: "Customers",
    owner: true,
    admin: true,
    cashier: true,
    description: "Record customer debt repayments and print repayment receipts.",
  },
  {
    capability: "View Selling Prices at Counter POS",
    category: "Sales",
    owner: true,
    admin: true,
    cashier: true,
    description: "Check stock availability and current retail prices at the sales counter.",
  },
  {
    capability: "Stock & Inventory Screen",
    category: "Inventory",
    owner: true,
    admin: true,
    cashier: false,
    description: "Access stock inventory screen, edit quantities, and track stock valuation.",
  },
  {
    capability: "Shop Expenses Screen",
    category: "Expenses",
    owner: true,
    admin: true,
    cashier: false,
    description: "View and log store operating expenses.",
  },
  {
    capability: "More & Business Configuration",
    category: "Settings",
    owner: true,
    admin: true,
    cashier: false,
    description: "Access More screen for business profiles, thermal printers, and system settings.",
  },
  {
    capability: "View Product Cost Prices",
    category: "Confidential",
    owner: true,
    admin: true,
    cashier: false,
    description: "Confidential wholesale/supplier cost price paid for inventory items.",
  },
  {
    capability: "View Store Profit Margins",
    category: "Confidential",
    owner: true,
    admin: true,
    cashier: false,
    description: "Real-time estimated profit on sales, daily gross margin, and net profit.",
  },
  {
    capability: "Financial & Profit Reports",
    category: "Reports",
    owner: true,
    admin: true,
    cashier: false,
    description: "P&L statements, COGS breakdown, inventory valuation, and monthly trends.",
  },
  {
    capability: "Product Restocking & Cost Edits",
    category: "Inventory",
    owner: true,
    admin: true,
    cashier: false,
    description: "Receive supplier stock batches and update unit cost prices.",
  },
  {
    capability: "Business Profile & Printer Settings",
    category: "Settings",
    owner: true,
    admin: true,
    cashier: false,
    description: "Update store name, return policy, and thermal printer hardware templates.",
  },
  {
    capability: "Manage Staff & Cashier Accounts",
    category: "Settings",
    owner: true,
    admin: true,
    cashier: false,
    description: "Add, invite, change roles, or deactivate team members.",
  },
  {
    capability: "Forgive / Write-off Customer Debt",
    category: "Customers",
    owner: true,
    admin: true,
    cashier: false,
    description: "Authorize management relief of uncollectible customer debt.",
  },
];

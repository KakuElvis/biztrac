import { useMemo } from "react";
import {
  ROLES,
  ROLE_METADATA,
  normalizeRole,
  isOwner,
  isAdmin,
  isOwnerOrAdmin,
  isCashier,
  canViewCostPrice,
  canViewProfit,
  canViewFinancialReports,
  canViewReports,
  canViewExpenses,
  canViewStock,
  canAccessMore,
  canManageSettings,
  canManageStaff,
  canDeleteProducts,
  canManageCategories,
  canForgiveDebt,
  canRestock,
  canEditProduct,
  canCreateProduct,
  canPerformSales,
  canPrintReceipts,
  canManageCustomers,
  canRecordDebtPayment,
} from "./permissions.js";

/**
 * Hook providing memoized permission flags and role state.
 * Supports role preview/simulation so Store Owners can test the app
 * exactly as their cashiers see it.
 *
 * @param {string} actualRole The authentic role from database workspace
 * @param {string|null} previewRole Optional temporary preview override (e.g. "staff")
 */
export function usePermissions(actualRole, previewRole = null) {
  const normActual = normalizeRole(actualRole);
  const effectiveRole = previewRole ? normalizeRole(previewRole) : normActual;
  const isSimulating = Boolean(previewRole && previewRole !== actualRole);

  return useMemo(() => {
    const meta = ROLE_METADATA[effectiveRole] || ROLE_METADATA[ROLES.STAFF];
    const actualMeta = ROLE_METADATA[normActual] || ROLE_METADATA[ROLES.STAFF];

    return {
      // Role identifiers
      actualRole: normActual,
      effectiveRole,
      isSimulating,
      roleMeta: meta,
      actualRoleMeta: actualMeta,

      // High-level role checks
      isOwner: isOwner(effectiveRole),
      isAdmin: isAdmin(effectiveRole),
      isOwnerOrAdmin: isOwnerOrAdmin(effectiveRole),
      isCashier: isCashier(effectiveRole),

      // Granular permissions
      canViewCostPrice: canViewCostPrice(effectiveRole),
      canViewProfit: canViewProfit(effectiveRole),
      canViewFinancialReports: canViewFinancialReports(effectiveRole),
      canViewReports: canViewReports(effectiveRole),
      canViewExpenses: canViewExpenses(effectiveRole),
      canViewStock: canViewStock(effectiveRole),
      canAccessMore: canAccessMore(effectiveRole),
      canManageSettings: canManageSettings(effectiveRole),
      canManageStaff: canManageStaff(effectiveRole),
      canDeleteProducts: canDeleteProducts(effectiveRole),
      canManageCategories: canManageCategories(effectiveRole),
      canForgiveDebt: canForgiveDebt(effectiveRole),
      canRestock: canRestock(effectiveRole),
      canEditProduct: canEditProduct(effectiveRole),
      canCreateProduct: canCreateProduct(effectiveRole),
      canPerformSales: canPerformSales(),
      canPrintReceipts: canPrintReceipts(),
      canManageCustomers: canManageCustomers(),
      canRecordDebtPayment: canRecordDebtPayment(),
    };
  }, [normActual, effectiveRole, isSimulating]);
}

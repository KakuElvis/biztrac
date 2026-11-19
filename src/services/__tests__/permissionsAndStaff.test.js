import { describe, it, expect, vi } from "vitest";

vi.mock("../../lib/supabase.js", () => {
  return {
    isSupabaseConfigured: false,
    supabase: {
      from: vi.fn(),
    },
  };
});

import {
  ROLES,
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
  canRestock,
  canPerformSales,
  canPrintReceipts,
  PERMISSION_MATRIX,
} from "../../features/staff/permissions.js";
import {
  listStaffMembers,
  updateStaffRole,
  removeStaffMember,
  addStaffMember,
  generateStaffId,
  isValidStaffId,
  generateStaffPassword,
  loginWithStaffId,
  updateStaffPassword,
  getActiveStaffSession,
  clearActiveStaffSession,
} from "../staffService.js";

// Mock localStorage for node test environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};
globalThis.window = globalThis;

describe("Role Normalization & Classification", () => {
  it("normalizes owner role accurately", () => {
    expect(normalizeRole("owner")).toBe(ROLES.OWNER);
    expect(normalizeRole("OWNER")).toBe(ROLES.OWNER);
    expect(isOwner("owner")).toBe(true);
    expect(isOwnerOrAdmin("owner")).toBe(true);
    expect(isCashier("owner")).toBe(false);
  });

  it("normalizes admin and manager to admin role", () => {
    expect(normalizeRole("admin")).toBe(ROLES.ADMIN);
    expect(normalizeRole("manager")).toBe(ROLES.ADMIN);
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("manager")).toBe(true);
    expect(isOwnerOrAdmin("admin")).toBe(true);
    expect(isCashier("admin")).toBe(false);
  });

  it("normalizes cashier and staff to staff role", () => {
    expect(normalizeRole("staff")).toBe(ROLES.STAFF);
    expect(normalizeRole("cashier")).toBe(ROLES.STAFF);
    expect(normalizeRole("")).toBe(ROLES.STAFF);
    expect(normalizeRole(null)).toBe(ROLES.STAFF);
    expect(isCashier("staff")).toBe(true);
    expect(isCashier("cashier")).toBe(true);
    expect(isOwnerOrAdmin("cashier")).toBe(false);
  });
});

describe("Granular Capability Checks", () => {
  it("restricts sensitive cost prices and profits from cashier", () => {
    // Cashier
    expect(canViewCostPrice("cashier")).toBe(false);
    expect(canViewProfit("cashier")).toBe(false);
    expect(canViewFinancialReports("cashier")).toBe(false);
    expect(canManageSettings("cashier")).toBe(false);
    expect(canManageStaff("cashier")).toBe(false);
    expect(canDeleteProducts("cashier")).toBe(false);
    expect(canRestock("cashier")).toBe(false);

    // Owner
    expect(canViewCostPrice("owner")).toBe(true);
    expect(canViewProfit("owner")).toBe(true);
    expect(canViewFinancialReports("owner")).toBe(true);
    expect(canManageSettings("owner")).toBe(true);
    expect(canManageStaff("owner")).toBe(true);
    expect(canDeleteProducts("owner")).toBe(true);
    expect(canRestock("owner")).toBe(true);

    // Manager / Admin
    expect(canViewCostPrice("admin")).toBe(true);
    expect(canViewProfit("admin")).toBe(true);
    expect(canViewFinancialReports("admin")).toBe(true);
    expect(canRestock("admin")).toBe(true);
  });

  it("permits counter sales and receipts for all roles including cashier", () => {
    expect(canPerformSales("cashier")).toBe(true);
    expect(canPerformSales("staff")).toBe(true);
    expect(canPerformSales("owner")).toBe(true);

    expect(canPrintReceipts("cashier")).toBe(true);
    expect(canPrintReceipts("owner")).toBe(true);
  });

  it("restricts reports, expenses, stock, and more from cashiers", () => {
    // Cashier cannot access reports, expenses, stock, or more
    expect(canViewReports("cashier")).toBe(false);
    expect(canViewExpenses("cashier")).toBe(false);
    expect(canViewStock("cashier")).toBe(false);
    expect(canAccessMore("cashier")).toBe(false);

    expect(canViewReports("staff")).toBe(false);
    expect(canViewExpenses("staff")).toBe(false);
    expect(canViewStock("staff")).toBe(false);
    expect(canAccessMore("staff")).toBe(false);

    // Owner has full access
    expect(canViewReports("owner")).toBe(true);
    expect(canViewExpenses("owner")).toBe(true);
    expect(canViewStock("owner")).toBe(true);
    expect(canAccessMore("owner")).toBe(true);

    // Admin has full access
    expect(canViewReports("admin")).toBe(true);
    expect(canViewExpenses("admin")).toBe(true);
    expect(canViewStock("admin")).toBe(true);
    expect(canAccessMore("admin")).toBe(true);
  });

  it("includes valid capabilities in the permission matrix", () => {
    expect(PERMISSION_MATRIX.length).toBeGreaterThanOrEqual(10);
    const costCap = PERMISSION_MATRIX.find((p) => p.capability.includes("Cost Prices"));
    expect(costCap?.cashier).toBe(false);
    expect(costCap?.owner).toBe(true);

    const posCap = PERMISSION_MATRIX.find((p) => p.capability.includes("POS Sales"));
    expect(posCap?.cashier).toBe(true);
  });
});

describe("Staff Management Service", () => {
  const businessId = "biz-perm-test-101";
  const currentUser = {
    id: "user-owner-001",
    email: "owner@accrashop.com",
    user_metadata: { full_name: "Kwame Owner" },
  };

  it("returns fallback owner member when starting fresh", async () => {
    const list = await listStaffMembers(businessId, currentUser);
    expect(list.length).toBe(1);
    expect(list[0].role).toBe(ROLES.OWNER);
    expect(list[0].fullName).toBe("Kwame Owner");
    expect(list[0].isCurrent).toBe(true);
  });

  it("adds a new cashier and saves to storage", async () => {
    const newStaff = await addStaffMember(businessId, {
      fullName: "Esi Cashier",
      email: "esi@accrashop.com",
      phone: "0244111222",
      role: ROLES.STAFF,
    });

    expect(newStaff.fullName).toBe("Esi Cashier");
    expect(newStaff.role).toBe(ROLES.STAFF);

    const updatedList = await listStaffMembers(businessId, currentUser);
    expect(updatedList.some((m) => m.fullName === "Esi Cashier")).toBe(true);
  });

  it("updates a staff member role", async () => {
    const staff = await addStaffMember(businessId, {
      fullName: "Kofi Clerk",
      role: ROLES.STAFF,
    });

    const result = await updateStaffRole(businessId, staff.id, ROLES.ADMIN);
    expect(result.role).toBe(ROLES.ADMIN);

    const list = await listStaffMembers(businessId, currentUser);
    const updated = list.find((m) => m.id === staff.id);
    expect(updated?.role).toBe(ROLES.ADMIN);
  });

  it("removes a staff member", async () => {
    const staff = await addStaffMember(businessId, {
      fullName: "Temp Staff",
      role: ROLES.STAFF,
    });

    await removeStaffMember(businessId, staff.id);
    const list = await listStaffMembers(businessId, currentUser);
    expect(list.some((m) => m.id === staff.id)).toBe(false);
  });
});

describe("Staff ID Auto-Creation & Format Validation", () => {
  it("generates an alphanumeric ID of 2 capital letters and 3 random numbers", () => {
    for (let i = 0; i < 20; i++) {
      const id = generateStaffId();
      expect(id).toMatch(/^[A-Z]{2}[0-9]{3}$/);
      expect(id.length).toBe(5);
      expect(isValidStaffId(id)).toBe(true);
    }
  });

  it("validates alphanumeric staff IDs including 3-digit and 4-digit presets", () => {
    // 2 capital letters and 3 numbers (standard format)
    expect(isValidStaffId("AF190")).toBe(true);
    expect(isValidStaffId("GH482")).toBe(true);
    expect(isValidStaffId("af190")).toBe(true);

    // 2 capital letters and 4 numbers (e.g. AF1900 example format)
    expect(isValidStaffId("AF1900")).toBe(true);
    expect(isValidStaffId("tm2024")).toBe(true);

    // Invalid formats
    expect(isValidStaffId("A190")).toBe(false); // only 1 letter
    expect(isValidStaffId("ABC190")).toBe(false); // 3 letters
    expect(isValidStaffId("1900")).toBe(false); // no letters
    expect(isValidStaffId("")).toBe(false);
    expect(isValidStaffId(null)).toBe(false);
  });

  it("generates default 6-digit staff password/PIN", () => {
    const pin = generateStaffPassword();
    expect(pin).toMatch(/^[0-9]{6}$/);
  });
});

describe("Staff Authentication with Staff ID & Password", () => {
  const businessId = "biz-auth-test-202";

  it("authenticates staff member using Staff ID and password", async () => {
    const staff = await addStaffMember(businessId, {
      fullName: "Ama Cashier",
      role: ROLES.STAFF,
      staffId: "AF190",
      password: "pass1234",
      businessName: "Ama Store",
    });

    expect(staff.staffId).toBe("AF190");
    expect(staff.password).toBe("pass1234");

    // Login with exact case
    const session = await loginWithStaffId({
      staffId: "AF190",
      password: "pass1234",
    });

    expect(session.isStaffSession).toBe(true);
    expect(session.user.fullName).toBe("Ama Cashier");
    expect(session.user.staffId).toBe("AF190");
    expect(session.user.role).toBe(ROLES.STAFF);
    expect(session.workspace.role).toBe(ROLES.STAFF);

    // Active session stored in storage
    const active = getActiveStaffSession();
    expect(active?.user?.staffId).toBe("AF190");

    clearActiveStaffSession();
    expect(getActiveStaffSession()).toBe(null);
  });

  it("supports case-insensitive Staff ID login", async () => {
    await addStaffMember(businessId, {
      fullName: "Kwesi Clerk",
      role: ROLES.STAFF,
      staffId: "GH789",
      password: "secret99",
      businessName: "Kwesi Store",
    });

    // Login with lowercase 'gh789'
    const session = await loginWithStaffId({
      staffId: "gh789",
      password: "secret99",
    });

    expect(session.user.staffId).toBe("GH789");
    expect(session.user.fullName).toBe("Kwesi Clerk");
    clearActiveStaffSession();
  });

  it("fails login with incorrect password", async () => {
    await addStaffMember(businessId, {
      fullName: "Yaw Guard",
      role: ROLES.STAFF,
      staffId: "YG404",
      password: "correctpassword",
    });

    await expect(
      loginWithStaffId({
        staffId: "YG404",
        password: "wrongpassword",
      })
    ).rejects.toThrow("Incorrect password");
  });

  it("fails login with non-existent Staff ID", async () => {
    await expect(
      loginWithStaffId({
        staffId: "ZZ999",
        password: "any",
      })
    ).rejects.toThrow('Staff ID "ZZ999" not found');
  });

  it("allows updating a staff member password", async () => {
    const member = await addStaffMember(businessId, {
      fullName: "Ebo Support",
      role: ROLES.STAFF,
      staffId: "EB101",
      password: "oldpassword",
    });

    await updateStaffPassword(businessId, member.id, "newpassword");

    // Old password fails
    await expect(
      loginWithStaffId({ staffId: "EB101", password: "oldpassword" })
    ).rejects.toThrow("Incorrect password");

    // New password succeeds
    const session = await loginWithStaffId({ staffId: "EB101", password: "newpassword" });
    expect(session.user.staffId).toBe("EB101");
    clearActiveStaffSession();
  });
});

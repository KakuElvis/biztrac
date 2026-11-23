import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkIsSuperAdmin,
  getAdminDashboardStats,
  listAdminBusinesses,
  overrideBusinessPlan,
  toggleBusinessSuspension,
  getAdminAuditLogs,
  exportBusinessesCsv,
  exportAuditLogsCsv,
  getAdminRole,
  impersonateBusiness,
  listAdminAnnouncements,
  createAdminAnnouncement,
  toggleAnnouncementActive,
} from "../adminService.js";

vi.mock("../../lib/supabase.js", () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

describe("BizPurse Super Admin Portal Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkIsSuperAdmin()", () => {
    it("returns false gracefully when Supabase is not configured", async () => {
      const isSuper = await checkIsSuperAdmin();
      expect(isSuper).toBe(false);
    });
  });

  describe("getAdminDashboardStats()", () => {
    it("returns fallback KPI summary when offline or Supabase not configured", async () => {
      const stats = await getAdminDashboardStats();
      expect(stats).toBeDefined();
      expect(stats.total_businesses).toBeGreaterThanOrEqual(1);
      expect(stats.total_revenue_ghs).toBeDefined();
      expect(stats.platform_gmv_ghs).toBeDefined();
    });
  });

  describe("listAdminBusinesses()", () => {
    it("returns directory of businesses with owner and plan info", async () => {
      const list = await listAdminBusinesses({ search: "retail" });
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      expect(list.totalCount).toBeDefined();
      expect(list[0]).toHaveProperty("name");
      expect(list[0]).toHaveProperty("plan_tier");
      expect(list[0]).toHaveProperty("owner_name");
      expect(list[0]).toHaveProperty("is_suspended");
    });

    it("accepts sorting and pagination parameters without throwing", async () => {
      const list = await listAdminBusinesses({
        sortBy: "total_sales_volume",
        sortDir: "asc",
        limit: 10,
        offset: 0,
      });
      expect(Array.isArray(list)).toBe(true);
      expect(list.totalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("overrideBusinessPlan()", () => {
    it("validates required businessId", async () => {
      await expect(overrideBusinessPlan(null)).rejects.toThrow("Business ID is required");
    });

    it("returns updated plan, new expiration date, and records payment amount", async () => {
      const res = await overrideBusinessPlan("biz-123", {
        planTier: "pro",
        daysValid: 60,
        reason: "Direct MoMo paid",
        amountPaid: 70,
      });
      expect(res.success).toBe(true);
      expect(res.plan_tier).toBe("pro");
      expect(res.is_pro).toBe(true);
      expect(res.amount_paid).toBe(70);
      expect(new Date(res.plan_expires_at).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("toggleBusinessSuspension()", () => {
    it("validates required businessId", async () => {
      await expect(toggleBusinessSuspension(null)).rejects.toThrow("Business ID is required");
    });

    it("suspends a business with reason", async () => {
      const res = await toggleBusinessSuspension("biz-123", {
        suspend: true,
        reason: "Investigation",
      });
      expect(res.success).toBe(true);
      expect(res.is_suspended).toBe(true);
      expect(res.suspension_reason).toBe("Investigation");
      expect(res.suspended_at).toBeDefined();
    });

    it("reactivates a business", async () => {
      const res = await toggleBusinessSuspension("biz-123", {
        suspend: false,
      });
      expect(res.success).toBe(true);
      expect(res.is_suspended).toBe(false);
      expect(res.suspended_at).toBeNull();
    });
  });

  describe("getAdminAuditLogs()", () => {
    it("returns array of immutable audit events with totalCount", async () => {
      const logs = await getAdminAuditLogs();
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.totalCount).toBeDefined();
      expect(logs[0]).toHaveProperty("action");
      expect(logs[0]).toHaveProperty("metadata");
    });

    it("accepts action filtering and pagination parameters without throwing", async () => {
      const logs = await getAdminAuditLogs({
        actionFilter: "overrides",
        limit: 10,
        offset: 0,
      });
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.totalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("exportBusinessesCsv()", () => {
    it("throws when list is empty", () => {
      expect(() => exportBusinessesCsv([])).toThrow("No businesses available to export");
    });

    it("generates formatted CSV content for export", () => {
      const csv = exportBusinessesCsv([
        {
          name: "Test Store",
          owner_name: "Owner 1",
          phone: "0240000000",
          email: "test@example.com",
          location: "Accra",
          plan_tier: "pro",
          plan_expires_at: "2026-12-31T00:00:00.000Z",
          is_pro: true,
          is_suspended: false,
          products_count: 10,
          total_sales_volume: 500,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ]);

      expect(typeof csv).toBe("string");
      expect(csv).toContain("Test Store");
      expect(csv).toContain("Store Name,Owner Name");
      expect(csv).toContain("PRO");
    });
  });

  describe("getAdminRole()", () => {
    it("fails closed when offline or Supabase is unconfigured", async () => {
      const role = await getAdminRole();
      expect(role).toBe("none");
    });
  });

  describe("impersonateBusiness()", () => {
    it("validates required businessId", async () => {
      await expect(impersonateBusiness(null)).rejects.toThrow("Business ID is required");
    });

    it("returns inspection session for target store", async () => {
      const res = await impersonateBusiness("test-biz-id");
      expect(res.success).toBe(true);
      expect(res.business).toBeDefined();
      expect(res.business.id).toBe("test-biz-id");
    });
  });

  describe("Announcements Management", () => {
    it("lists system announcements", async () => {
      const list = await listAdminAnnouncements();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toHaveProperty("title");
      expect(list[0]).toHaveProperty("is_active");
    });

    it("creates an announcement with validation", async () => {
      await expect(createAdminAnnouncement({ title: "" })).rejects.toThrow();

      const created = await createAdminAnnouncement({
        title: "Test Notice",
        message: "System maintenance tonight",
        level: "warning",
      });
      expect(created.success).toBe(true);
      expect(created.id).toBeDefined();
    });

    it("toggles active state of an announcement", async () => {
      await expect(toggleAnnouncementActive(null, false)).rejects.toThrow();

      const toggled = await toggleAnnouncementActive("ann-123", false);
      expect(toggled.success).toBe(true);
      expect(toggled.is_active).toBe(false);
    });
  });

  describe("exportAuditLogsCsv()", () => {
    it("throws when logs list is empty", () => {
      expect(() => exportAuditLogsCsv([])).toThrow("No audit logs available to export");
    });

    it("generates formatted CSV string for audit events", () => {
      const csv = exportAuditLogsCsv([
        {
          id: "audit-1",
          action: "MANUAL_PLAN_OVERRIDE",
          target_business_id: "biz-1",
          target_business_name: "Demo Store",
          admin_id: "admin-1",
          created_at: "2026-11-23T10:00:00.000Z",
          metadata: {
            plan_tier: "pro",
            days_valid: 30,
            amount_paid: 70,
            reason: "Cash paid",
          },
        },
      ]);

      expect(typeof csv).toBe("string");
      expect(csv).toContain("Event ID,Action");
      expect(csv).toContain("MANUAL_PLAN_OVERRIDE");
      expect(csv).toContain("Demo Store");
      expect(csv).toContain("70.00");
    });
  });
});

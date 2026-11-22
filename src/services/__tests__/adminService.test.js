import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkIsSuperAdmin,
  getAdminDashboardStats,
  listAdminBusinesses,
  overrideBusinessPlan,
  getAdminAuditLogs,
} from "../adminService.js";

vi.mock("../../lib/supabase.js", () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

describe("BizTrac Super Admin Portal Service", () => {
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
      expect(list[0]).toHaveProperty("name");
      expect(list[0]).toHaveProperty("plan_tier");
      expect(list[0]).toHaveProperty("owner_name");
    });
  });

  describe("overrideBusinessPlan()", () => {
    it("validates required businessId", async () => {
      await expect(overrideBusinessPlan(null)).rejects.toThrow("Business ID is required");
    });

    it("returns updated plan and new expiration date for valid inputs", async () => {
      const res = await overrideBusinessPlan("biz-123", {
        planTier: "pro",
        daysValid: 60,
        reason: "Direct MoMo paid",
      });
      expect(res.success).toBe(true);
      expect(res.plan_tier).toBe("pro");
      expect(res.is_pro).toBe(true);
      expect(new Date(res.plan_expires_at).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("getAdminAuditLogs()", () => {
    it("returns array of immutable audit events", async () => {
      const logs = await getAdminAuditLogs();
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toHaveProperty("action");
      expect(logs[0]).toHaveProperty("metadata");
    });
  });
});

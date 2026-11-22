import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PLANS,
  PRO_FEATURES,
  PLAN_LIMITS,
  isProBusiness,
  getDaysRemaining,
  canAccessFeature,
  getFeatureLimit,
} from "../../lib/plans.js";
import { toBusiness, upgradeBusinessPlan } from "../businessService.js";

const mockLocalStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => mockLocalStorage.get(k) || null,
  setItem: (k, v) => mockLocalStorage.set(k, String(v)),
  removeItem: (k) => mockLocalStorage.delete(k),
  clear: () => mockLocalStorage.clear(),
};
globalThis.window = globalThis;

vi.mock("../../lib/supabase.js", () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

describe("BizTrac Subscription & Pro Feature Gating", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe("isProBusiness()", () => {
    it("returns false for undefined or null business", () => {
      expect(isProBusiness(null)).toBe(false);
      expect(isProBusiness(undefined)).toBe(false);
    });

    it("returns false for free plan", () => {
      const freeBiz = { id: "b1", name: "Shop", plan_tier: PLANS.FREE };
      expect(isProBusiness(freeBiz)).toBe(false);
    });

    it("returns true for pro plan without expiration date (perpetual)", () => {
      const proBiz = { id: "b2", name: "Shop Pro", plan_tier: PLANS.PRO, plan_expires_at: null };
      expect(isProBusiness(proBiz)).toBe(true);
    });

    it("returns true for pro plan with future expiration date", () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
      const proBiz = { id: "b3", name: "Shop Pro", plan_tier: PLANS.PRO, plan_expires_at: future };
      expect(isProBusiness(proBiz)).toBe(true);
    });

    it("returns false for pro plan with past expiration date", () => {
      const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
      const expiredBiz = { id: "b4", name: "Shop Expired", plan_tier: PLANS.PRO, plan_expires_at: past };
      expect(isProBusiness(expiredBiz)).toBe(false);
    });
  });

  describe("canAccessFeature()", () => {
    const freeBiz = { id: "b1", name: "Shop Free", plan_tier: PLANS.FREE };
    const proBiz = {
      id: "b2",
      name: "Shop Pro",
      plan_tier: PLANS.PRO,
      plan_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    };

    it("denies pro features to free tier businesses", () => {
      expect(canAccessFeature(freeBiz, PRO_FEATURES.INVOICING)).toBe(false);
      expect(canAccessFeature(freeBiz, PRO_FEATURES.MULTI_STAFF)).toBe(false);
      expect(canAccessFeature(freeBiz, PRO_FEATURES.PROFIT_ANALYTICS)).toBe(false);
      expect(canAccessFeature(freeBiz, PRO_FEATURES.DATA_EXPORT)).toBe(false);
      expect(canAccessFeature(freeBiz, PRO_FEATURES.UNLIMITED_PRODUCTS)).toBe(false);
    });

    it("grants all pro features to active pro tier businesses", () => {
      expect(canAccessFeature(proBiz, PRO_FEATURES.INVOICING)).toBe(true);
      expect(canAccessFeature(proBiz, PRO_FEATURES.MULTI_STAFF)).toBe(true);
      expect(canAccessFeature(proBiz, PRO_FEATURES.PROFIT_ANALYTICS)).toBe(true);
      expect(canAccessFeature(proBiz, PRO_FEATURES.DATA_EXPORT)).toBe(true);
      expect(canAccessFeature(proBiz, PRO_FEATURES.UNLIMITED_PRODUCTS)).toBe(true);
    });
  });

  describe("getFeatureLimit() & getDaysRemaining()", () => {
    it("returns correct product and staff limits per plan", () => {
      const freeBiz = { id: "b1", plan_tier: PLANS.FREE };
      const proBiz = { id: "b2", plan_tier: PLANS.PRO, plan_expires_at: null };

      expect(getFeatureLimit(freeBiz, "maxProducts")).toBe(50);
      expect(getFeatureLimit(freeBiz, "maxStaff")).toBe(1);

      expect(getFeatureLimit(proBiz, "maxProducts")).toBe(Infinity);
      expect(getFeatureLimit(proBiz, "maxStaff")).toBe(Infinity);
    });

    it("calculates remaining days accurately", () => {
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
      const proBiz = {
        id: "b3",
        plan_tier: PLANS.PRO,
        plan_expires_at: new Date(Date.now() + tenDaysMs).toISOString(),
      };
      expect(getDaysRemaining(proBiz)).toBe(10);
    });
  });

  describe("toBusiness() and upgradeBusinessPlan()", () => {
    it("parses plan_tier and plan_expires_at from row", () => {
      const row = {
        id: "biz-123",
        name: "Accra Fabrics",
        plan_tier: "pro",
        plan_expires_at: "2026-12-31T23:59:59Z",
      };
      const business = toBusiness(row);
      expect(business.plan_tier).toBe("pro");
      expect(business.plan_expires_at).toBe("2026-12-31T23:59:59Z");
    });

    it("upgrades plan locally and returns active pro status", async () => {
      const res = await upgradeBusinessPlan("biz-123", {
        planTier: "pro",
        durationDays: 30,
        amount: 60,
      });

      expect(res.plan_tier).toBe("pro");
      expect(res.is_pro).toBe(true);
      expect(res.plan_expires_at).toBeDefined();

      const savedBusiness = toBusiness({ id: "biz-123", name: "Accra Fabrics" });
      expect(savedBusiness.plan_tier).toBe("pro");
      expect(isProBusiness(savedBusiness)).toBe(true);
    });
  });
});

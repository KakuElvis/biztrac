import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

/**
 * Checks whether the current authenticated user has super-admin privileges.
 */
export async function checkIsSuperAdmin() {
  if (!isSupabaseConfigured || !supabase) {
    return false;
  }

  try {
    const { data, error } = await supabase.rpc("is_super_admin");
    if (error) {
      console.warn("[adminService] is_super_admin RPC check returned error:", error.message);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.warn("[adminService] Exception checking super admin:", err?.message || err);
    return false;
  }
}

/**
 * Fetches high-level executive KPI metrics across all shops.
 */
export async function getAdminDashboardStats() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      total_businesses: 1,
      active_pro: 1,
      free_tier: 0,
      total_revenue_ghs: 350.0,
      platform_gmv_ghs: 4890.5,
      current_month_sales_count: 42,
      total_products_tracked: 120,
      total_cashiers: 2,
    };
  }

  const { data, error } = await supabase.rpc("admin_get_dashboard_stats");
  if (error) throw error;
  return data;
}

/**
 * Searches and lists registered businesses with owner, plan, and sales volume.
 */
export async function listAdminBusinesses({
  search = "",
  planFilter = "all",
  limit = 25,
  offset = 0,
} = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return [
      {
        id: "demo-biz-1",
        name: "Demo Retail Hub",
        phone: "+233 24 000 0001",
        email: "retail@biztrac.demo",
        location: "Accra, Central",
        currency: "GHS",
        plan_tier: "pro",
        plan_expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        is_pro: true,
        created_at: new Date().toISOString(),
        owner_name: "Kwame Mensah",
        owner_email: "kwame@biztrac.demo",
        products_count: 84,
        total_sales_volume: 12500.0,
        sales_count: 145,
      },
    ];
  }

  const { data, error } = await supabase.rpc("admin_list_businesses", {
    p_search: search.trim() || null,
    p_plan_filter: planFilter || "all",
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  return data || [];
}

/**
 * Manually overrides or extends a business's subscription plan.
 */
export async function overrideBusinessPlan(
  businessId,
  { planTier = "pro", daysValid = 30, reason = "" } = {}
) {
  if (!businessId) throw new Error("Business ID is required.");

  if (!isSupabaseConfigured || !supabase) {
    return {
      success: true,
      business_id: businessId,
      plan_tier: planTier,
      plan_expires_at: new Date(Date.now() + daysValid * 86400000).toISOString(),
      is_pro: planTier !== "free",
    };
  }

  const { data, error } = await supabase.rpc("admin_override_business_plan", {
    p_business_id: businessId,
    p_plan_tier: planTier,
    p_days_valid: Number(daysValid) || 30,
    p_reason: reason.trim() || "Manual Admin Override",
  });

  if (error) throw error;
  return data;
}

/**
 * Retrieves the immutable audit log timeline of admin actions.
 */
export async function getAdminAuditLogs({ limit = 50, offset = 0 } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return [
      {
        id: "demo-audit-1",
        admin_id: "demo-admin-id",
        target_business_id: "demo-biz-1",
        target_business_name: "Demo Retail Hub",
        action: "MANUAL_PLAN_OVERRIDE",
        metadata: {
          plan_tier: "pro",
          days_valid: 30,
          reason: "Cash payment confirmed at office",
        },
        created_at: new Date().toISOString(),
      },
    ];
  }

  const { data, error } = await supabase.rpc("admin_get_audit_logs", {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  return data || [];
}

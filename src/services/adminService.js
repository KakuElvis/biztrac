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
 * Searches and lists registered businesses with owner, plan, sales volume, and pagination.
 */
export async function listAdminBusinesses({
  search = "",
  planFilter = "all",
  sortBy = "created_at",
  sortDir = "desc",
  limit = 25,
  offset = 0,
} = {}) {
  if (!isSupabaseConfigured || !supabase) {
    const mockList = [
      {
        id: "demo-biz-1",
        name: "Demo Retail Hub",
        phone: "+233 24 000 0001",
        email: "retail@bizpurse.demo",
        location: "Accra, Central",
        currency: "GHS",
        plan_tier: "pro",
        plan_expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        is_pro: true,
        is_suspended: false,
        suspended_at: null,
        suspension_reason: null,
        created_at: new Date().toISOString(),
        owner_name: "Kwame Mensah",
        owner_email: "kwame@bizpurse.demo",
        products_count: 84,
        total_sales_volume: 12500.0,
        sales_count: 145,
        total_count: 1,
      },
    ];
    mockList.totalCount = 1;
    return mockList;
  }

  const { data, error } = await supabase.rpc("admin_list_businesses", {
    p_search: search.trim() || null,
    p_plan_filter: planFilter || "all",
    p_sort_by: sortBy || "created_at",
    p_sort_dir: sortDir || "desc",
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;

  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.businesses)
    ? data.businesses
    : [];

  const totalCount =
    typeof data?.total_count === "number"
      ? data.total_count
      : items[0]?.total_count ?? items.length;

  items.totalCount = totalCount;
  return items;
}

/**
 * Manually overrides or extends a business's subscription plan, optionally recording direct MoMo revenue.
 */
export async function overrideBusinessPlan(
  businessId,
  { planTier = "pro", daysValid = 30, reason = "", amountPaid = 0 } = {}
) {
  if (!businessId) throw new Error("Business ID is required.");

  const cleanAmount = Math.max(0, Number(amountPaid) || 0);

  if (!isSupabaseConfigured || !supabase) {
    return {
      success: true,
      business_id: businessId,
      plan_tier: planTier,
      plan_expires_at: new Date(Date.now() + daysValid * 86400000).toISOString(),
      amount_paid: cleanAmount,
      is_pro: planTier !== "free",
    };
  }

  const { data, error } = await supabase.rpc("admin_override_business_plan", {
    p_business_id: businessId,
    p_plan_tier: planTier,
    p_days_valid: Number(daysValid) || 30,
    p_reason: reason.trim() || "Manual Admin Override",
    p_amount_paid: cleanAmount,
  });

  if (error) throw error;
  return data;
}

/**
 * Suspends or reactivates a business tenant store.
 */
export async function toggleBusinessSuspension(
  businessId,
  { suspend = true, reason = "" } = {}
) {
  if (!businessId) throw new Error("Business ID is required.");

  if (!isSupabaseConfigured || !supabase) {
    return {
      success: true,
      business_id: businessId,
      is_suspended: Boolean(suspend),
      suspended_at: suspend ? new Date().toISOString() : null,
      suspension_reason: suspend ? reason.trim() || "Administrative Suspension" : null,
    };
  }

  const { data, error } = await supabase.rpc("admin_toggle_business_suspension", {
    p_business_id: businessId,
    p_suspend: Boolean(suspend),
    p_reason: reason.trim() || (suspend ? "Suspended by Super Admin" : "Reactivated by Super Admin"),
  });

  if (error) throw error;
  return data;
}

/**
 * Retrieves the immutable audit log timeline of admin actions with filtering and pagination.
 */
export async function getAdminAuditLogs({
  actionFilter = "all",
  limit = 25,
  offset = 0,
} = {}) {
  if (!isSupabaseConfigured || !supabase) {
    const mockLogs = [
      {
        id: "demo-audit-1",
        admin_id: "demo-admin-id",
        target_business_id: "demo-biz-1",
        target_business_name: "Demo Retail Hub",
        action: "MANUAL_PLAN_OVERRIDE",
        metadata: {
          plan_tier: "pro",
          days_valid: 30,
          amount_paid: 70,
          reason: "Cash payment confirmed at office",
        },
        created_at: new Date().toISOString(),
      },
    ];
    mockLogs.totalCount = 1;
    return mockLogs;
  }

  const { data, error } = await supabase.rpc("admin_get_audit_logs", {
    p_action_filter: actionFilter || "all",
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;

  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.logs)
    ? data.logs
    : [];

  const totalCount =
    typeof data?.total_count === "number"
      ? data.total_count
      : items[0]?.total_count ?? items.length;

  items.totalCount = totalCount;
  return items;
}

/**
 * Generates and downloads a clean CSV export of tenant stores.
 */
export function exportBusinessesCsv(businesses = []) {
  if (!businesses || !businesses.length) {
    throw new Error("No businesses available to export.");
  }

  const headers = [
    "Store Name",
    "Owner Name",
    "Phone",
    "Email",
    "Location",
    "Plan Tier",
    "Plan Expiry",
    "Status",
    "Suspension Reason",
    "Products Tracked",
    "Platform GMV (GHS)",
    "Registered Date",
  ];

  const escapeCsv = (val) => {
    let str = String(val ?? "");
    // eslint-disable-next-line no-control-regex
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(str)) str = `'${str}`;
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = businesses.map((biz) => [
    escapeCsv(biz.name),
    escapeCsv(biz.owner_name),
    escapeCsv(biz.phone),
    escapeCsv(biz.email || biz.owner_email),
    escapeCsv(biz.location),
    escapeCsv((biz.plan_tier || "free").toUpperCase()),
    escapeCsv(biz.plan_expires_at ? new Date(biz.plan_expires_at).toLocaleDateString() : (biz.is_pro ? "Perpetual" : "None")),
    escapeCsv(biz.is_suspended ? "Suspended" : "Active"),
    escapeCsv(biz.suspension_reason || ""),
    escapeCsv(biz.products_count ?? 0),
    escapeCsv(Number(biz.total_sales_volume ?? 0).toFixed(2)),
    escapeCsv(biz.created_at ? new Date(biz.created_at).toLocaleDateString() : ""),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  if (typeof window === "undefined" || typeof document === "undefined") {
    return csvContent;
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `bizpurse-tenants-${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return csvContent;
}

/**
 * Retrieves the specific admin role ('super_admin', 'billing', 'support').
 */
export async function getAdminRole() {
  if (!isSupabaseConfigured || !supabase) {
    return "none";
  }

  try {
    const { data, error } = await supabase.rpc("get_admin_role");
    if (error) {
      console.warn("[adminService] get_admin_role RPC returned error:", error.message);
      return "none";
    }
    return data || "none";
  } catch (err) {
    console.warn("[adminService] Exception checking admin role:", err?.message || err);
    return "none";
  }
}

/**
 * Fetches a read-only store snapshot and records the inspection in the audit log.
 */
export async function impersonateBusiness(businessId) {
  if (!businessId) throw new Error("Business ID is required.");

  if (!isSupabaseConfigured || !supabase) {
    return {
      success: true,
      business: {
        id: businessId,
        name: "Demo Retail Hub (Inspection)",
        currency: "GHS",
        plan_tier: "pro",
        is_suspended: false,
      },
    };
  }

  const { data, error } = await supabase.rpc("admin_impersonate_business", {
    p_business_id: businessId,
  });

  if (error) throw error;
  return data;
}

/**
 * Lists system announcements for admin management.
 */
export async function listAdminAnnouncements() {
  if (!isSupabaseConfigured || !supabase) {
    return [
      {
        id: "demo-ann-1",
        title: "Welcome to BizPurse",
        message: "Platform operations running normally.",
        level: "info",
        is_active: true,
        created_at: new Date().toISOString(),
        expires_at: null,
      },
    ];
  }

  const { data, error } = await supabase.rpc("admin_list_announcements");
  if (error) throw error;
  return data || [];
}

/**
 * Broadcasts a new system announcement.
 */
export async function createAdminAnnouncement({
  title,
  message,
  level = "info",
  expiresAt = null,
}) {
  if (!title || !message) {
    throw new Error("Announcement title and message are required.");
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      success: true,
      id: "demo-ann-" + Date.now(),
    };
  }

  const { data, error } = await supabase.rpc("admin_create_announcement", {
    p_title: title.trim(),
    p_message: message.trim(),
    p_level: level,
    p_expires_at: expiresAt,
  });

  if (error) throw error;
  return data;
}

/**
 * Toggles an announcement's active status.
 */
export async function toggleAnnouncementActive(id, isActive) {
  if (!id) throw new Error("Announcement ID is required.");

  if (!isSupabaseConfigured || !supabase) {
    return { success: true, id, is_active: Boolean(isActive) };
  }

  const { data, error } = await supabase.rpc("admin_toggle_announcement", {
    p_id: id,
    p_is_active: Boolean(isActive),
  });

  if (error) throw error;
  return data;
}

/**
 * Generates and downloads a clean CSV export of platform audit logs.
 */
export function exportAuditLogsCsv(logs = []) {
  if (!logs || !logs.length) {
    throw new Error("No audit logs available to export.");
  }

  const headers = [
    "Event ID",
    "Action",
    "Target Store ID",
    "Target Store Name",
    "Admin ID",
    "Timestamp",
    "Plan Tier",
    "Days Added",
    "Amount Paid (GHS)",
    "Reason / Notes",
  ];

  const escapeCsv = (val) => {
    let str = String(val ?? "");
    // eslint-disable-next-line no-control-regex
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(str)) str = `'${str}`;
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = logs.map((log) => {
    const meta = log.metadata || {};
    return [
      escapeCsv(log.id),
      escapeCsv(log.action),
      escapeCsv(log.target_business_id || ""),
      escapeCsv(log.target_business_name || ""),
      escapeCsv(log.admin_id || ""),
      escapeCsv(log.created_at ? new Date(log.created_at).toLocaleString() : ""),
      escapeCsv(meta.plan_tier || meta.new_tier || ""),
      escapeCsv(meta.days_valid || meta.days_added || ""),
      escapeCsv(meta.amount_paid != null ? Number(meta.amount_paid).toFixed(2) : ""),
      escapeCsv(meta.reason || meta.suspension_reason || meta.note || ""),
    ];
  });

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  if (typeof window === "undefined" || typeof document === "undefined") {
    return csvContent;
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `bizpurse-audit-logs-${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return csvContent;
}

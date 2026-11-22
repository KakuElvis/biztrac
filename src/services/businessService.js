import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
  }

  return supabase;
}

export function getLocalReceiptSettings(businessId) {
  if (typeof window === "undefined" || !businessId) return {};
  try {
    const raw = localStorage.getItem(`biztrac_receipt_${businessId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalReceiptSettings(businessId, settings) {
  if (typeof window === "undefined" || !businessId) return;
  try {
    localStorage.setItem(`biztrac_receipt_${businessId}`, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function toBusiness(row) {
  if (!row) return null;
  const local = getLocalReceiptSettings(row.id);

  return {
    id: row.id,
    name: row.name,
    phone: row.phone || "",
    email: row.email || "",
    location: row.location || "",
    logo_url: row.logo_url || "",
    currency: row.currency || "GHS",
    slogan: row.slogan ?? local.slogan ?? "",
    momo_details: row.momo_details ?? local.momo_details ?? "",
    return_policy:
      row.return_policy ??
      local.return_policy ??
      "Goods sold in good condition are not returnable after 3 days.",
    receipt_width: row.receipt_width ?? local.receipt_width ?? "58mm",
    receipt_footer:
      row.receipt_footer ??
      local.receipt_footer ??
      "Thank you for your patronage! Visit again.",
    auto_print_receipt: Boolean(
      row.auto_print_receipt ?? local.auto_print_receipt ?? false
    ),
    vat_enabled: Boolean(row.vat_enabled ?? local.vat_enabled ?? false),
    tin_number: row.tin_number ?? local.tin_number ?? "",
    tax_pricing_mode: row.tax_pricing_mode ?? local.tax_pricing_mode ?? "exclusive",
    vat_rate: Number(row.vat_rate ?? local.vat_rate ?? 15.0),
    nhil_rate: Number(row.nhil_rate ?? local.nhil_rate ?? 2.5),
    getfund_rate: Number(row.getfund_rate ?? local.getfund_rate ?? 2.5),
    plan_tier: row.plan_tier || local.plan_tier || "free",
    plan_expires_at: row.plan_expires_at || local.plan_expires_at || null,
  };
}

export async function updateBusiness(businessId, business) {
  if (!business.name?.trim()) throw new Error("Business name is required.");

  const receiptSettings = {
    slogan: business.slogan !== undefined ? business.slogan.trim() : undefined,
    momo_details: business.momo_details !== undefined ? business.momo_details.trim() : undefined,
    return_policy: business.return_policy !== undefined ? business.return_policy.trim() : undefined,
    receipt_width: business.receipt_width || undefined,
    receipt_footer: business.receipt_footer !== undefined ? business.receipt_footer.trim() : undefined,
    auto_print_receipt:
      business.auto_print_receipt !== undefined ? Boolean(business.auto_print_receipt) : undefined,
    vat_enabled: business.vat_enabled !== undefined ? Boolean(business.vat_enabled) : undefined,
    tin_number: business.tin_number !== undefined ? String(business.tin_number).trim() : undefined,
    tax_pricing_mode: business.tax_pricing_mode || undefined,
    vat_rate: business.vat_rate !== undefined ? Number(business.vat_rate) : undefined,
    nhil_rate: business.nhil_rate !== undefined ? Number(business.nhil_rate) : undefined,
    getfund_rate: business.getfund_rate !== undefined ? Number(business.getfund_rate) : undefined,
  };

  // Clean undefined properties
  const cleanReceiptSettings = Object.fromEntries(
    Object.entries(receiptSettings).filter(([, v]) => v !== undefined)
  );

  // Persist locally for immediate availability and offline resilience
  const existingLocal = getLocalReceiptSettings(businessId);
  const updatedLocal = { ...existingLocal, ...cleanReceiptSettings };
  saveLocalReceiptSettings(businessId, updatedLocal);

  const baseRow = {
    name: business.name.trim(),
    phone: business.phone?.trim() || null,
    email: business.email?.trim() || null,
    location: business.location?.trim() || null,
  };

  const fullRow = {
    ...baseRow,
    ...cleanReceiptSettings,
  };

  try {
    // Attempt full update including receipt customization columns
    const { data, error } = await requireSupabase()
      .from("businesses")
      .update(fullRow)
      .eq("id", businessId)
      .select("*")
      .single();

    if (!error && data) {
      return toBusiness(data);
    }
  } catch (err) {
    console.warn("Full business update with receipt fields failed, falling back to base columns:", err);
  }

  // Graceful fallback to standard columns if table columns not yet migrated
  const { data, error } = await requireSupabase()
    .from("businesses")
    .update(baseRow)
    .eq("id", businessId)
    .select("id, name, phone, email, location, logo_url, currency")
    .single();

  if (error) throw error;
  return toBusiness({ ...data, ...updatedLocal });
}

export async function upgradeBusinessPlan(businessId, { planTier = "pro", durationDays = 30, reference = null, amount = 0, paymentMethod = "momo" } = {}) {
  if (!businessId) throw new Error("Business ID is required to upgrade plan.");

  const local = getLocalReceiptSettings(businessId);
  const now = Date.now();
  const newExpiry = new Date(now + durationDays * 24 * 60 * 60 * 1000).toISOString();

  // 1. Call remote RPC upgrade_business_plan if Supabase is configured
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("upgrade_business_plan", {
      p_business_id: businessId,
      p_plan_tier: planTier,
      p_duration_days: durationDays,
      p_reference: reference || `UPG-${Date.now()}`,
      p_amount: amount,
      p_payment_method: paymentMethod,
    });

    if (error) throw error;

    if (data?.success) {
      saveLocalReceiptSettings(businessId, {
        ...local,
        plan_tier: data.plan_tier,
        plan_expires_at: data.plan_expires_at,
      });
      return {
        plan_tier: data.plan_tier,
        plan_expires_at: data.plan_expires_at,
        is_pro: data.is_pro,
      };
    }
  }

  // 2. Offline / local fallback when Supabase is not configured
  saveLocalReceiptSettings(businessId, {
    ...local,
    plan_tier: planTier,
    plan_expires_at: newExpiry,
  });

  return {
    plan_tier: planTier,
    plan_expires_at: newExpiry,
    is_pro: true,
  };
}

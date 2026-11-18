import { supabase } from "../lib/supabase.js";

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

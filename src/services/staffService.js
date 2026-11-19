import { isSupabaseConfigured } from "../lib/supabase.js";
import { requireSupabase } from "./serviceUtils.js";
import { normalizeRole, ROLES } from "../features/staff/permissions.js";

const LOCAL_STAFF_STORAGE_KEY = "biztrac_local_staff_v1";
const GLOBAL_STAFF_REGISTRY_KEY = "biztrac_staff_registry_v1";
const ACTIVE_STAFF_SESSION_KEY = "biztrac_active_staff_session_v1";
const CACHED_BUSINESS_KEY = "biztrac_cached_business_v1";

/**
 * Generates an alphanumeric Staff ID in the format:
 * 2 random capital letters followed by 3 random digits (e.g. AF190).
 */
export function generateStaffId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const char1 = letters[Math.floor(Math.random() * letters.length)];
  const char2 = letters[Math.floor(Math.random() * letters.length)];
  // Exactly 3 random digits between 100 and 999
  const num = Math.floor(100 + Math.random() * 900);
  return `${char1}${char2}${num}`;
}

/**
 * Validates whether a string matches the alphanumeric Staff ID format:
 * 2 capital letters followed by 3 to 4 digits (e.g. AF190 or AF1900).
 */
export function isValidStaffId(staffId) {
  if (!staffId || typeof staffId !== "string") return false;
  return /^[A-Z]{2}[0-9]{3,4}$/i.test(staffId.trim());
}

/**
 * Generates a default 6-digit counter password/PIN.
 */
export function generateStaffPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function readLocalStaff(businessId) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STAFF_STORAGE_KEY}_${businessId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalStaff(businessId, list) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${LOCAL_STAFF_STORAGE_KEY}_${businessId}`, JSON.stringify(list));
  } catch (err) {
    console.warn("[staffService] Failed to cache local staff:", err);
  }
}

export function readGlobalStaffRegistry() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GLOBAL_STAFF_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeGlobalStaffRegistry(list) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GLOBAL_STAFF_REGISTRY_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("[staffService] Failed to cache global staff registry:", err);
  }
}

export function cacheCurrentBusiness(business) {
  if (typeof window === "undefined" || !business) return;
  try {
    localStorage.setItem(CACHED_BUSINESS_KEY, JSON.stringify(business));
    if (business.id) {
      localStorage.setItem(`${CACHED_BUSINESS_KEY}_${business.id}`, JSON.stringify(business));
    }
  } catch {
    // Ignore error
  }
}

export function getCachedBusiness(businessId) {
  if (typeof window === "undefined") return null;
  try {
    if (businessId) {
      const specific = localStorage.getItem(`${CACHED_BUSINESS_KEY}_${businessId}`);
      if (specific) return JSON.parse(specific);
    }
    const generic = localStorage.getItem(CACHED_BUSINESS_KEY);
    return generic ? JSON.parse(generic) : null;
  } catch {
    return null;
  }
}

/**
 * Lists all registered staff members and cashiers for a business.
 */
export async function listStaffMembers(businessId, currentUser = null) {
  if (!businessId) return [];

  if (!isSupabaseConfigured) {
    const cached = readLocalStaff(businessId);
    if (cached.length) {
      // Ensure each member has a staffId
      const normalized = cached.map((m) => ({
        ...m,
        staffId: m.staffId || (m.role === ROLES.OWNER ? "OWNER" : generateStaffId()),
      }));
      return normalized;
    }
    const fallback = getFallbackStaff(businessId, currentUser);
    writeLocalStaff(businessId, fallback);
    return fallback;
  }

  try {
    const client = requireSupabase();

    // 1. Fetch memberships
    const { data: members, error: mError } = await client
      .from("business_members")
      .select("business_id, user_id, role, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    if (mError) throw mError;
    if (!members || members.length === 0) {
      return getFallbackStaff(businessId, currentUser);
    }

    // 2. Fetch corresponding user profiles
    const userIds = members.map((m) => m.user_id);
    let profileMap = new Map();

    try {
      const { data: profiles, error: pError } = await client
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", userIds);

      if (!pError && profiles) {
        profiles.forEach((p) => profileMap.set(p.id, p));
      }
    } catch (pErr) {
      console.warn("[staffService] Could not load member profiles:", pErr?.message || pErr);
    }

    const cached = readLocalStaff(businessId);
    const cachedMap = new Map(cached.map((c) => [c.id, c]));

    const result = members.map((m) => {
      const profile = profileMap.get(m.user_id);
      const cachedItem = cachedMap.get(m.user_id);
      const isCurrent = currentUser?.id === m.user_id;
      const currentName = currentUser?.user_metadata?.full_name || currentUser?.email || "Store User";

      return {
        id: m.user_id,
        businessId: m.business_id,
        role: normalizeRole(m.role),
        createdAt: m.created_at,
        fullName: profile?.full_name || (isCurrent ? currentName : "Team Member"),
        phone: profile?.phone || "",
        email: isCurrent ? currentUser?.email : "",
        staffId: cachedItem?.staffId || (isCurrent ? "OWNER" : generateStaffId()),
        password: cachedItem?.password || "",
        isCurrent,
      };
    });

    // 3. Also fetch cloud staff accounts from staff_accounts table if present
    try {
      const { data: cloudStaff, error: csError } = await client
        .from("staff_accounts")
        .select("id, business_id, staff_id, password_hash, full_name, phone, email, role, created_at")
        .eq("business_id", businessId);

      if (!csError && Array.isArray(cloudStaff)) {
        cloudStaff.forEach((cs) => {
          if (!result.some((r) => r.staffId === cs.staff_id || r.id === cs.id)) {
            result.push({
              id: cs.id,
              businessId: cs.business_id,
              role: normalizeRole(cs.role),
              createdAt: cs.created_at,
              fullName: cs.full_name,
              phone: cs.phone || "",
              email: cs.email || "",
              staffId: cs.staff_id,
              password: cs.password_hash || "",
              isCurrent: false,
            });
          }
        });
      }
    } catch (csErr) {
      console.warn("[staffService] Remote staff_accounts check skipped:", csErr?.message || csErr);
    }

    writeLocalStaff(businessId, result);
    return result;
  } catch (error) {
    console.warn("[staffService] Error querying business_members, using cached:", error?.message || error);
    const cached = readLocalStaff(businessId);
    if (cached.length) return cached;
    return getFallbackStaff(businessId, currentUser);
  }
}

/**
 * Updates a staff member's role (e.g. promote cashier to manager, or vice versa)
 */
export async function updateStaffRole(businessId, userId, newRole) {
  const normRole = normalizeRole(newRole);

  if (isSupabaseConfigured) {
    try {
      const client = requireSupabase();
      await client
        .from("business_members")
        .update({ role: normRole })
        .eq("business_id", businessId)
        .eq("user_id", userId);

      await client
        .from("staff_accounts")
        .update({ role: normRole })
        .eq("business_id", businessId)
        .eq("staff_id", userId);
    } catch (err) {
      console.warn("[staffService] Supabase error in updateStaffRole, falling back locally:", err?.message || err);
    }
  }

  // Update local cache
  const cached = readLocalStaff(businessId);
  const updated = cached.map((member) =>
    member.id === userId ? { ...member, role: normRole } : member
  );
  writeLocalStaff(businessId, updated);

  // Update global staff registry
  const registry = readGlobalStaffRegistry();
  const updatedReg = registry.map((member) =>
    member.id === userId || member.staffId === userId
      ? { ...member, role: normRole }
      : member
  );
  writeGlobalStaffRegistry(updatedReg);

  return { success: true, role: normRole };
}

/**
 * Updates a staff member's password
 */
export async function updateStaffPassword(businessId, userId, newPassword) {
  const cleanPass = (newPassword || "").trim();
  if (!cleanPass) throw new Error("Password cannot be empty.");

  if (isSupabaseConfigured) {
    try {
      const client = requireSupabase();
      await client
        .from("staff_accounts")
        .update({ password_hash: cleanPass })
        .eq("business_id", businessId)
        .eq("staff_id", userId);
    } catch (err) {
      console.warn("[staffService] Failed remote password update:", err?.message || err);
    }
  }

  const cached = readLocalStaff(businessId);
  const updated = cached.map((m) =>
    m.id === userId || m.staffId === userId ? { ...m, password: cleanPass } : m
  );
  writeLocalStaff(businessId, updated);

  const registry = readGlobalStaffRegistry();
  const updatedReg = registry.map((m) =>
    (m.businessId === businessId && (m.id === userId || m.staffId === userId))
      ? { ...m, password: cleanPass }
      : m
  );
  writeGlobalStaffRegistry(updatedReg);

  return { success: true };
}

/**
 * Removes a staff member from the business
 */
export async function removeStaffMember(businessId, userId) {
  if (isSupabaseConfigured) {
    try {
      const client = requireSupabase();
      await client
        .from("business_members")
        .delete()
        .eq("business_id", businessId)
        .eq("user_id", userId);

      await client
        .from("staff_accounts")
        .delete()
        .eq("business_id", businessId)
        .eq("staff_id", userId);
    } catch (err) {
      console.warn("[staffService] Supabase error in removeStaffMember, falling back locally:", err?.message || err);
    }
  }

  // Update local cache
  const cached = readLocalStaff(businessId);
  const filtered = cached.filter((member) => member.id !== userId);
  writeLocalStaff(businessId, filtered);

  // Update global registry
  const registry = readGlobalStaffRegistry();
  const filteredReg = registry.filter(
    (member) => member.id !== userId && member.staffId !== userId
  );
  writeGlobalStaffRegistry(filteredReg);

  return { success: true };
}

/**
 * Adds or records a new staff member with auto-generated Staff ID and password.
 */
export async function addStaffMember(
  businessId,
  { fullName, email, phone, role, staffId, password, businessName }
) {
  const normRole = normalizeRole(role || ROLES.STAFF);
  const tempId = `staff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Auto-generate Staff ID if not supplied (2 uppercase letters + 3 digits, e.g. AF190)
  let cleanStaffId = (staffId || "").trim().toUpperCase();
  if (!cleanStaffId) {
    cleanStaffId = generateStaffId();
  }

  // Auto-generate password if not supplied
  let cleanPassword = (password || "").trim();
  if (!cleanPassword) {
    cleanPassword = generateStaffPassword();
  }

  const newMember = {
    id: tempId,
    businessId,
    role: normRole,
    staffId: cleanStaffId,
    password: cleanPassword,
    fullName: (fullName || "").trim() || "New Staff",
    email: (email || "").trim(),
    phone: (phone || "").trim(),
    createdAt: new Date().toISOString(),
    isCurrent: false,
  };

  // 1. Update business local staff cache
  const cached = readLocalStaff(businessId);
  const updated = [...cached, newMember];
  writeLocalStaff(businessId, updated);

  // 2. Register in global staff registry for login
  const registry = readGlobalStaffRegistry();
  const existingIdx = registry.findIndex(
    (r) => r.staffId.toUpperCase() === cleanStaffId && r.businessId === businessId
  );
  const regEntry = {
    id: tempId,
    staffId: cleanStaffId,
    password: cleanPassword,
    fullName: newMember.fullName,
    role: normRole,
    phone: newMember.phone,
    email: newMember.email,
    businessId,
    businessName: businessName || "BizTrac Store",
    createdAt: newMember.createdAt,
  };

  if (existingIdx >= 0) {
    registry[existingIdx] = regEntry;
  } else {
    registry.push(regEntry);
  }
  writeGlobalStaffRegistry(registry);

  // 3. Sync to Supabase staff_accounts table if online & configured
  if (isSupabaseConfigured) {
    try {
      const client = requireSupabase();
      await client.from("staff_accounts").upsert(
        {
          business_id: businessId,
          staff_id: cleanStaffId,
          password_hash: cleanPassword,
          full_name: newMember.fullName,
          phone: newMember.phone || null,
          email: newMember.email || null,
          role: normRole,
        },
        { onConflict: "business_id, staff_id" }
      );
    } catch (err) {
      console.warn("[staffService] Supabase sync to staff_accounts skipped:", err?.message || err);
    }
  }

  return newMember;
}

/**
 * Authenticates a counter staff member or cashier using Staff ID and password.
 */
export async function loginWithStaffId({ staffId, password }) {
  const cleanId = (staffId || "").trim().toUpperCase();
  const cleanPass = (password || "").trim();

  if (!cleanId) {
    throw new Error("Please enter your Staff ID.");
  }
  if (!cleanPass) {
    throw new Error("Please enter your password.");
  }

  // 1. Search in global staff registry
  let registry = readGlobalStaffRegistry();
  let foundMember = registry.find(
    (m) => (m.staffId || "").toUpperCase() === cleanId
  );

  // 2. If not found in registry, search across any cached local staff keys
  if (!foundMember && typeof window !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LOCAL_STAFF_STORAGE_KEY)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw);
            const m = list.find((item) => (item.staffId || "").toUpperCase() === cleanId);
            if (m) {
              foundMember = m;
              break;
            }
          }
        }
      }
    } catch {
      // Ignore search error
    }
  }

  // 3. If not found locally and Supabase is configured, search remote Supabase
  if (!foundMember && isSupabaseConfigured) {
    try {
      const client = requireSupabase();

      // 3A. Try secure RPC authenticate_staff if available
      try {
        const { data: rpcResult, error: rpcError } = await client.rpc("authenticate_staff", {
          p_staff_id: cleanId,
          p_password: cleanPass,
        });

        if (!rpcError && rpcResult) {
          if (rpcResult.success === false) {
            throw new Error(rpcResult.error || "Staff login failed.");
          }
          if (rpcResult.success && rpcResult.staff) {
            const staff = rpcResult.staff;
            const biz = rpcResult.business;

            const session = {
              user: {
                id: staff.id,
                staffId: staff.staff_id,
                fullName: staff.full_name,
                role: normalizeRole(staff.role),
                phone: staff.phone || "",
                email: staff.email || `${staff.staff_id.toLowerCase()}@biztrac.staff`,
                isStaff: true,
                user_metadata: {
                  full_name: staff.full_name,
                  staff_id: staff.staff_id,
                  role: normalizeRole(staff.role),
                  is_staff_login: true,
                },
              },
              workspace: {
                role: normalizeRole(staff.role),
                business: biz || {
                  id: staff.business_id,
                  name: "BizTrac Store",
                  currency: "GHS",
                  location: "",
                  phone: "",
                },
              },
              isStaffSession: true,
              expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
            };

            setActiveStaffSession(session);
            if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
              try {
                window.dispatchEvent(new CustomEvent("biztrac:auth-change", { detail: session }));
              } catch {
                // Ignore
              }
            }

            return session;
          }
        }
      } catch (rpcErr) {
        if (rpcErr.message && (rpcErr.message.includes("password") || rpcErr.message.includes("found"))) {
          throw rpcErr;
        }
      }

      // 3B. Fallback: Query staff_accounts table directly
      const { data: remoteUser, error: rError } = await client
        .from("staff_accounts")
        .select("id, business_id, staff_id, password_hash, full_name, phone, email, role")
        .ilike("staff_id", cleanId)
        .maybeSingle();

      if (!rError && remoteUser) {
        foundMember = {
          id: remoteUser.id,
          businessId: remoteUser.business_id,
          staffId: remoteUser.staff_id,
          password: remoteUser.password_hash,
          fullName: remoteUser.full_name,
          phone: remoteUser.phone || "",
          email: remoteUser.email || "",
          role: remoteUser.role,
        };
      }
    } catch (rErr) {
      if (rErr.message && (rErr.message.includes("password") || rErr.message.includes("found"))) {
        throw rErr;
      }
      console.warn("[staffService] Failed remote query for staff_id:", rErr?.message || rErr);
    }
  }

  if (!foundMember) {
    throw new Error(`Staff ID "${cleanId}" not found. Please verify with your store owner.`);
  }

  if (foundMember.password && foundMember.password !== cleanPass) {
    throw new Error("Incorrect password. Please try again.");
  }

  // 3. Resolve business details
  const cachedBusiness = getCachedBusiness(foundMember.businessId);

  const session = {
    user: {
      id: foundMember.id,
      staffId: foundMember.staffId,
      fullName: foundMember.fullName,
      role: normalizeRole(foundMember.role),
      phone: foundMember.phone || "",
      email: foundMember.email || `${foundMember.staffId.toLowerCase()}@biztrac.staff`,
      isStaff: true,
      user_metadata: {
        full_name: foundMember.fullName,
        staff_id: foundMember.staffId,
        role: normalizeRole(foundMember.role),
        is_staff_login: true,
      },
    },
    workspace: {
      role: normalizeRole(foundMember.role),
      business: cachedBusiness || {
        id: foundMember.businessId,
        name: foundMember.businessName || "BizTrac Store",
        currency: "GHS",
        location: "",
        phone: "",
      },
    },
    isStaffSession: true,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };

  setActiveStaffSession(session);

  // Dispatch auth event for reactive listeners
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent("biztrac:auth-change", { detail: session }));
    } catch {
      // Ignore event error
    }
  }

  return session;
}

export function getActiveStaffSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_STAFF_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.expiresAt && Date.now() > session.expiresAt) {
      clearActiveStaffSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setActiveStaffSession(session) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_STAFF_SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn("[staffService] Failed to save staff session:", err);
  }
}

export function clearActiveStaffSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVE_STAFF_SESSION_KEY);
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("biztrac:auth-change", { detail: null }));
    }
  } catch {
    // Ignore error
  }
}

function getFallbackStaff(businessId, currentUser) {
  const ownerName = currentUser?.user_metadata?.full_name || currentUser?.email || "Store Owner";
  const defaultList = [
    {
      id: currentUser?.id || "default-owner",
      businessId,
      role: ROLES.OWNER,
      staffId: "OWNER",
      fullName: ownerName,
      email: currentUser?.email || "",
      phone: "",
      createdAt: new Date().toISOString(),
      isCurrent: true,
    },
  ];
  return defaultList;
}

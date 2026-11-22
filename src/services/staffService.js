import { isSupabaseConfigured } from "../lib/supabase.js";
import { requireSupabase } from "./serviceUtils.js";
import { normalizeRole, ROLES } from "../features/staff/permissions.js";
import { toBusiness } from "./businessService.js";

const LOCAL_STAFF_STORAGE_KEY = "biztrac_local_staff_v1";
const GLOBAL_STAFF_REGISTRY_KEY = "biztrac_staff_registry_v1";
const ACTIVE_STAFF_SESSION_KEY = "biztrac_active_staff_session_v1";
const CACHED_BUSINESS_KEY = "biztrac_cached_business_v1";

async function deriveLocalPin(password, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: 210000, hash: "SHA-256" }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createLocalPinVerifier(password) {
  const salt = crypto.randomUUID();
  return { pinSalt: salt, pinHash: await deriveLocalPin(password, salt) };
}

async function verifyLocalPin(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const actual = await deriveLocalPin(password, salt);
  return actual === expectedHash;
}

function withoutPlainPin(member) {
  const safe = { ...member };
  delete safe.password;
  return safe;
}

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
      // Ensure each member has a staffId and current lock status
      const normalized = cached.map((m) => {
        const isLocked = Boolean(m.lockedUntil && new Date(m.lockedUntil).getTime() > Date.now());
        const remainingMinutes = isLocked
          ? Math.max(1, Math.ceil((new Date(m.lockedUntil).getTime() - Date.now()) / 60000))
          : 0;
        return {
          ...m,
          staffId: m.staffId || (m.role === ROLES.OWNER ? "OWNER" : generateStaffId()),
          isLocked,
          remainingMinutes,
        };
      });
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
        password: "",
        pinSalt: cachedItem?.pinSalt,
        pinHash: cachedItem?.pinHash,
        isCurrent,
      };
    });

    // 3. Also fetch cloud staff accounts from staff_accounts table if present
    try {
      const { data: cloudStaff, error: csError } = await client
        .rpc("list_manager_staff_accounts", { p_business_id: businessId });

      if (!csError && Array.isArray(cloudStaff)) {
        cloudStaff.forEach((cs) => {
          if (!result.some((r) => r.staffId === cs.staff_id || r.id === cs.id)) {
            const isLocked = Boolean(cs.locked_until && new Date(cs.locked_until).getTime() > Date.now());
            const remainingMinutes = isLocked
              ? Math.max(1, Math.ceil((new Date(cs.locked_until).getTime() - Date.now()) / 60000))
              : 0;
            result.push({
              id: cs.id,
              businessId: cs.business_id,
              role: normalizeRole(cs.role),
              createdAt: cs.created_at,
              fullName: cs.full_name,
              phone: cs.phone || "",
              email: cs.email || "",
              staffId: cs.staff_id,
              password: "",
              failedAttempts: cs.failed_login_attempts || 0,
              lockedUntil: cs.locked_until || null,
              isLocked,
              remainingMinutes,
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
    if (cached.length) {
      return cached.map((m) => {
        const isLocked = Boolean(m.lockedUntil && new Date(m.lockedUntil).getTime() > Date.now());
        const remainingMinutes = isLocked
          ? Math.max(1, Math.ceil((new Date(m.lockedUntil).getTime() - Date.now()) / 60000))
          : 0;
        return { ...m, isLocked, remainingMinutes };
      });
    }
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
      const memberUpdate = await client
        .from("business_members")
        .update({ role: normRole })
        .eq("business_id", businessId)
        .eq("user_id", userId);
      if (memberUpdate.error) throw memberUpdate.error;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      let staffUpdate = client
        .from("staff_accounts")
        .update({ role: normRole })
        .eq("business_id", businessId);
      staffUpdate = isUuid
        ? staffUpdate.or(`id.eq.${userId},staff_id.eq.${userId}`)
        : staffUpdate.eq("staff_id", userId);
      const { error: staffUpdateError } = await staffUpdate;
      if (staffUpdateError) throw staffUpdateError;
    } catch (err) {
      throw new Error(`Role change was not saved to the server: ${err?.message || err}`, { cause: err });
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
 * Updates a staff member's password using pgcrypto hashing RPC or table trigger
 */
export async function updateStaffPassword(businessId, userId, newPassword) {
  const cleanPass = (newPassword || "").trim();
  if (!cleanPass) throw new Error("Password cannot be empty.");

  if (isSupabaseConfigured) {
    try {
      const client = requireSupabase();
      let updatedRemotely = false;
      try {
        const { data: rpcRes, error: rpcErr } = await client.rpc("set_staff_password", {
          p_business_id: businessId,
          p_staff_id: userId,
          p_new_password: cleanPass,
        });
        if (!rpcErr && rpcRes && rpcRes.success) {
          updatedRemotely = true;
        }
      } catch (rpcErr) {
        console.warn("[staffService] set_staff_password RPC failed, trying fallback:", rpcErr?.message || rpcErr);
      }

      if (!updatedRemotely) {
        // Fallback: direct table update (the trg_hash_staff_password trigger hashes the password in PostgreSQL)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
        let query = client
          .from("staff_accounts")
          .update({
            password_hash: cleanPass,
            failed_login_attempts: 0,
            locked_until: null,
            updated_at: new Date().toISOString(),
          })
          .eq("business_id", businessId);

        if (isUuid) {
          query = query.or(`id.eq.${userId},staff_id.eq.${userId}`);
        } else {
          query = query.eq("staff_id", userId);
        }
        const { error: updateError } = await query;
        if (updateError) throw updateError;
      }
    } catch (err) {
      throw new Error(`Password change was not saved to the server: ${err?.message || err}`, { cause: err });
    }
  }

  const pinVerifier = await createLocalPinVerifier(cleanPass);
  const cached = readLocalStaff(businessId);
  const updated = cached.map((m) =>
    m.id === userId || m.staffId === userId
      ? { ...withoutPlainPin(m), ...pinVerifier, failedAttempts: 0, lockedUntil: null, isLocked: false }
      : m
  );
  writeLocalStaff(businessId, updated);

  const registry = readGlobalStaffRegistry();
  const updatedReg = registry.map((m) =>
    (m.businessId === businessId && (m.id === userId || m.staffId === userId))
      ? { ...withoutPlainPin(m), ...pinVerifier, failedAttempts: 0, lockedUntil: null }
      : m
  );
  writeGlobalStaffRegistry(updatedReg);

  return { success: true };
}

/**
 * Unlocks a locked staff account and resets failed login attempts.
 */
export async function unlockStaffAccount(businessId, userId) {
  if (!businessId || !userId) throw new Error("Business ID and Staff ID are required.");

  if (isSupabaseConfigured) {
    try {
      const client = requireSupabase();
      let unlockedRemotely = false;
      try {
        const { data: rpcRes, error: rpcErr } = await client.rpc("unlock_staff_account", {
          p_business_id: businessId,
          p_staff_id: userId,
        });
        if (!rpcErr && rpcRes && rpcRes.success) {
          unlockedRemotely = true;
        }
      } catch (rpcErr) {
        console.warn("[staffService] unlock_staff_account RPC failed, trying fallback:", rpcErr?.message || rpcErr);
      }

      if (!unlockedRemotely) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
        let query = client
          .from("staff_accounts")
          .update({
            failed_login_attempts: 0,
            locked_until: null,
            updated_at: new Date().toISOString(),
          })
          .eq("business_id", businessId);

        if (isUuid) {
          query = query.or(`id.eq.${userId},staff_id.eq.${userId}`);
        } else {
          query = query.eq("staff_id", userId);
        }
        const { error: updateError } = await query;
        if (updateError) throw updateError;
      }
    } catch (err) {
      throw new Error(`Staff account was not unlocked on the server: ${err?.message || err}`, { cause: err });
    }
  }

  const cached = readLocalStaff(businessId);
  const updated = cached.map((m) =>
    m.id === userId || m.staffId === userId
      ? { ...m, failedAttempts: 0, lockedUntil: null, isLocked: false }
      : m
  );
  writeLocalStaff(businessId, updated);

  const registry = readGlobalStaffRegistry();
  const updatedReg = registry.map((m) =>
    (m.businessId === businessId && (m.id === userId || m.staffId === userId))
      ? { ...m, failedAttempts: 0, lockedUntil: null }
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
      const { error: memberDeleteError } = await client
        .from("business_members")
        .delete()
        .eq("business_id", businessId)
        .eq("user_id", userId);
      if (memberDeleteError) throw memberDeleteError;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      let staffDelete = client
        .from("staff_accounts")
        .delete()
        .eq("business_id", businessId);
      staffDelete = isUuid
        ? staffDelete.or(`id.eq.${userId},staff_id.eq.${userId}`)
        : staffDelete.eq("staff_id", userId);
      const { error: staffDeleteError } = await staffDelete;
      if (staffDeleteError) throw staffDeleteError;
    } catch (err) {
      throw new Error(`Staff removal was not saved to the server: ${err?.message || err}`, { cause: err });
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

  const pinVerifier = await createLocalPinVerifier(cleanPassword);

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
  writeLocalStaff(businessId, updated.map((member) => member.id === tempId ? { ...withoutPlainPin(member), ...pinVerifier } : withoutPlainPin(member)));

  // 2. Register in global staff registry for login
  const registry = readGlobalStaffRegistry();
  const existingIdx = registry.findIndex(
    (r) => r.staffId.toUpperCase() === cleanStaffId && r.businessId === businessId
  );
  const regEntry = {
    id: tempId,
    staffId: cleanStaffId,
    ...pinVerifier,
    fullName: newMember.fullName,
    role: normRole,
    phone: newMember.phone,
    email: newMember.email,
    businessId,
    businessName: businessName || "BizPurse Store",
    createdAt: newMember.createdAt,
  };

  if (existingIdx >= 0) {
    registry[existingIdx] = regEntry;
  } else {
    registry.push(regEntry);
  }
  writeGlobalStaffRegistry(registry.map(withoutPlainPin));

  // 3. Sync to Supabase staff_accounts table if online & configured
  if (isSupabaseConfigured) {
    try {
      const client = requireSupabase();
      const { data, error } = await client.rpc("save_staff_account", {
        p_business_id: businessId,
        p_staff_id: cleanStaffId,
        p_password: cleanPassword,
        p_full_name: newMember.fullName,
        p_phone: newMember.phone || null,
        p_email: newMember.email || null,
        p_role: normRole,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Staff account could not be saved.");
    } catch (err) {
      console.warn("[staffService] Supabase sync to staff_accounts skipped:", err?.message || err);
      newMember.syncStatus = "needs_sync";
      writeLocalStaff(businessId, readLocalStaff(businessId).map((member) =>
        member.id === tempId ? { ...member, syncStatus: "needs_sync" } : member
      ));
      writeGlobalStaffRegistry(readGlobalStaffRegistry().map((member) =>
        member.id === tempId ? { ...member, syncStatus: "needs_sync" } : member
      ));
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

  // 1. If online and Supabase is configured, authenticate via cryptographically secure authenticate_staff RPC
  if (isSupabaseConfigured) {
    try {
      const client = requireSupabase();
      // Never let a previous owner/admin Supabase token authorize a local staff session.
      const { error: signOutError } = await client.auth.signOut({ scope: "local" });
      if (signOutError) throw new Error("Could not safely switch to the staff account. Please sign out and try again.");
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
              email: staff.email || `${staff.staff_id.toLowerCase()}@bizpurse.staff`,
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
              business: toBusiness(biz) || {
                id: staff.business_id,
                name: "BizPurse Store",
                currency: "GHS",
                location: "",
                phone: "",
                vat_enabled: false,
              },
            },
            isStaffSession: true,
            sessionToken: rpcResult.session_token || null,
            expiresAt: rpcResult.expires_at ? new Date(rpcResult.expires_at).getTime() : Date.now() + 1000 * 60 * 60 * 14,
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
      if (rpcErr.message?.includes("Could not safely switch")) throw rpcErr;
      if (
        rpcErr.message &&
        (rpcErr.message.includes("password") ||
          rpcErr.message.includes("found") ||
          rpcErr.message.includes("Staff ID") ||
          rpcErr.message.includes("locked") ||
          rpcErr.message.includes("attempt"))
      ) {
        throw rpcErr;
      }
      console.warn("[staffService] Remote authenticate_staff check failed, attempting local fallback:", rpcErr?.message || rpcErr);
    }
  }

  // 2. Offline / Local fallback: Search in global staff registry
  let registry = readGlobalStaffRegistry();
  let foundMember = registry.find(
    (m) => (m.staffId || "").toUpperCase() === cleanId
  );

  // 3. If not found in registry, search across any cached local staff keys
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

  if (!foundMember) {
    throw new Error(`Staff ID "${cleanId}" not found. Please verify with your store owner.`);
  }

  // Check if account is locked locally
  if (foundMember.lockedUntil && new Date(foundMember.lockedUntil).getTime() > Date.now()) {
    const remainingMin = Math.max(1, Math.ceil((new Date(foundMember.lockedUntil).getTime() - Date.now()) / 60000));
    throw new Error(`Account is temporarily locked due to 5 consecutive failed PIN attempts. Try again in ${remainingMin} minute(s), or ask your store owner to unlock your account.`);
  }

  const pinMatches = foundMember.pinHash
    ? await verifyLocalPin(cleanPass, foundMember.pinSalt, foundMember.pinHash)
    : Boolean(foundMember.password && foundMember.password === cleanPass);
  if (!pinMatches) {
    const failed = (foundMember.failedAttempts || 0) + 1;
    if (failed >= 5) {
      foundMember.failedAttempts = failed;
      foundMember.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      writeGlobalStaffRegistry(registry);
      throw new Error("Account locked: 5 consecutive failed PIN attempts. Try again in 15 minutes, or ask your store owner to unlock your account.");
    } else {
      foundMember.failedAttempts = failed;
      writeGlobalStaffRegistry(registry);
      throw new Error(`Incorrect password. ${5 - failed} attempt(s) remaining before temporary lockout.`);
    }
  }

  if (foundMember.password && pinMatches) {
    const pinVerifier = await createLocalPinVerifier(cleanPass);
    Object.assign(foundMember, pinVerifier);
    delete foundMember.password;
    writeGlobalStaffRegistry(registry.map(withoutPlainPin));
    const local = readLocalStaff(foundMember.businessId).map((member) =>
      member.staffId === foundMember.staffId ? { ...withoutPlainPin(member), ...pinVerifier } : withoutPlainPin(member)
    );
    writeLocalStaff(foundMember.businessId, local);
  }

  // Password valid: reset failed attempts
  if (foundMember.failedAttempts || foundMember.lockedUntil) {
    foundMember.failedAttempts = 0;
    foundMember.lockedUntil = null;
    writeGlobalStaffRegistry(registry);
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
      email: foundMember.email || `${foundMember.staffId.toLowerCase()}@bizpurse.staff`,
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
        name: foundMember.businessName || "BizPurse Store",
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

export function getStaffSessionToken() {
  const session = getActiveStaffSession();
  return session?.sessionToken || null;
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

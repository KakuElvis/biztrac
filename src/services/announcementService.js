import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

const DISMISSED_KEY = "bizpurse_dismissed_announcements";

export function getDismissedAnnouncementIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function dismissAnnouncement(announcementId) {
  if (typeof window === "undefined" || !announcementId) return;
  try {
    const current = getDismissedAnnouncementIds();
    if (!current.includes(announcementId)) {
      current.push(announcementId);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(current));
    }
  } catch (err) {
    console.warn("[announcementService] Failed to record dismissed announcement:", err);
  }
}

export async function getActiveAnnouncements() {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase.rpc("get_active_announcements");
    if (error) {
      console.warn("[announcementService] Failed to fetch active announcements:", error.message);
      return [];
    }
    const dismissed = getDismissedAnnouncementIds();
    const active = Array.isArray(data) ? data : [];
    return active.filter((a) => !dismissed.includes(a.id));
  } catch (err) {
    console.warn("[announcementService] Exception fetching active announcements:", err?.message || err);
    return [];
  }
}

import { describe, it, expect, beforeEach } from "vitest";
import {
  getDismissedAnnouncementIds,
  dismissAnnouncement,
  getActiveAnnouncements,
} from "../announcementService.js";

// Mock localStorage and window for Node test environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};
globalThis.window = {
  localStorage: globalThis.localStorage,
};

describe("Merchant System Announcement Service", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it("returns empty array when no announcements have been dismissed", () => {
    expect(getDismissedAnnouncementIds()).toEqual([]);
  });

  it("records and persists dismissed announcement IDs in localStorage", () => {
    dismissAnnouncement("ann-101");
    expect(getDismissedAnnouncementIds()).toContain("ann-101");

    // Avoid duplicates
    dismissAnnouncement("ann-101");
    expect(getDismissedAnnouncementIds().length).toBe(1);
  });

  it("handles getActiveAnnouncements gracefully when offline or unconfigured", async () => {
    const active = await getActiveAnnouncements();
    expect(Array.isArray(active)).toBe(true);
  });
});

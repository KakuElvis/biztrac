import { useState, useEffect, useCallback } from "react";
import {
  Megaphone,
  Plus,
  X,
  AlertTriangle,
  Info,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  listAdminAnnouncements,
  createAdminAnnouncement,
  toggleAnnouncementActive,
} from "../../services/adminService.js";
import { showToast } from "../../lib/toast.js";

export function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState("info");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAdminAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      console.error("[AdminAnnouncements] Failed to load announcements:", err);
      showToast(err.message || "Failed to load announcements", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleToggle = async (ann) => {
    try {
      const willBeActive = !ann.is_active;
      await toggleAnnouncementActive(ann.id, willBeActive);
      setAnnouncements((prev) =>
        prev.map((item) =>
          item.id === ann.id ? { ...item, is_active: willBeActive } : item
        )
      );
      showToast(
        willBeActive ? "Announcement activated" : "Announcement deactivated",
        { type: "info" }
      );
    } catch (err) {
      console.error("[AdminAnnouncements] Toggle failed:", err);
      showToast(err.message || "Failed to update announcement", { type: "error" });
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showToast("Please provide both a title and message", { type: "warn" });
      return;
    }

    try {
      setSubmitting(true);
      await createAdminAnnouncement({
        title,
        message,
        level,
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59.999Z`).toISOString() : null,
      });

      showToast("Announcement broadcasted successfully", { type: "success" });
      setIsModalOpen(false);
      setTitle("");
      setMessage("");
      setLevel("info");
      setExpiresAt("");
      fetchAnnouncements();
    } catch (err) {
      console.error("[AdminAnnouncements] Creation failed:", err);
      showToast(err.message || "Failed to broadcast announcement", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const renderBadge = (annLevel) => {
    switch (annLevel) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="h-3 w-3 text-rose-600" /> Critical Alert
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="h-3 w-3 text-amber-600" /> Maintenance
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-100 text-sky-800 border border-sky-200">
            <Info className="h-3 w-3 text-sky-600" /> Platform Notice
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-ink">System Broadcast Announcements</h3>
            <span className="bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-0.5 rounded-md text-[10px] uppercase">
              POS Banner
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Broadcast platform-wide notices, maintenance alerts, and service updates to merchant POS terminals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-palm hover:bg-forest text-white font-bold text-xs shadow-xs transition active:scale-95 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Broadcast</span>
        </button>
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 font-bold text-xs">
          Loading system announcements...
        </div>
      ) : announcements.length === 0 ? (
        <div className="py-12 text-center text-slate-400 font-bold text-xs space-y-2">
          <Megaphone className="h-8 w-8 text-slate-300 mx-auto" />
          <p>No system announcements posted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className={`p-4 rounded-2xl border transition-all ${
                ann.is_active
                  ? "bg-slate-50/50 border-slate-200"
                  : "bg-slate-100/50 border-slate-200/60 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderBadge(ann.level)}
                    <h4 className="font-black text-xs text-slate-900">{ann.title}</h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                        ann.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {ann.is_active ? "Active" : "Archived"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                    {ann.message}
                  </p>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Posted: {new Date(ann.created_at).toLocaleDateString()}
                    </span>
                    {ann.expires_at ? (
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <Calendar className="h-3 w-3" />
                        Expires: {new Date(ann.expires_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span>No expiry</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggle(ann)}
                  title={ann.is_active ? "Deactivate banner" : "Activate banner"}
                  className="p-1.5 rounded-xl hover:bg-slate-200/60 text-slate-600 transition shrink-0"
                >
                  {ann.is_active ? (
                    <ToggleRight className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Broadcast Creation Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-palm" />
                <h4 className="font-black text-sm text-slate-900">Broadcast Announcement</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Announcement Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Scheduled Network Maintenance"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-palm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Message Body
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the update, impact, or instructions for merchants..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-palm resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Severity Level
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-palm bg-white"
                  >
                    <option value="info">Info / Notice</option>
                    <option value="warning">Warning / Maintenance</option>
                    <option value="critical">Critical Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expires On (Optional)
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-palm bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-palm hover:bg-forest text-white text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50"
                >
                  {submitting ? "Publishing..." : "Broadcast to POS"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

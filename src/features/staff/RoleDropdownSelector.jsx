import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Check,
  ShoppingCart,
  Shield,
  Crown,
  Lock,
} from "lucide-react";
import { ROLES, normalizeRole } from "./permissions.js";

const ROLE_OPTIONS = [
  {
    role: ROLES.STAFF,
    label: "Cashier",
    badgeLabel: "Cashier",
    tag: "Sales only",
    icon: ShoppingCart,
    tagline: "POS sales & receipts only",
    description: "Rings up sales, accepts Cash/MoMo/Bank & prints receipts. Store cost prices and profits are strictly hidden.",
    colorTheme: {
      pillBg: "bg-emerald-50 text-emerald-800 border-emerald-300/80 hover:bg-emerald-100/70",
      activePill: "ring-2 ring-emerald-500/30",
      iconBg: "bg-emerald-100 text-emerald-700",
      selectedBorder: "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500",
      badgeTone: "bg-emerald-100 text-emerald-800",
      checkColor: "text-emerald-700",
    },
  },
  {
    role: ROLES.ADMIN,
    label: "Manager / Admin",
    badgeLabel: "Manager",
    tag: "Inventory & Profit",
    icon: Shield,
    tagline: "Stock restocks & profit view",
    description: "Can restock supplier stock, edit inventory, and view business profit margins and sales reports.",
    colorTheme: {
      pillBg: "bg-blue-50 text-blue-800 border-blue-300/80 hover:bg-blue-100/70",
      activePill: "ring-2 ring-blue-500/30",
      iconBg: "bg-blue-100 text-blue-700",
      selectedBorder: "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500",
      badgeTone: "bg-blue-100 text-blue-800",
      checkColor: "text-blue-700",
    },
  },
  {
    role: ROLES.OWNER,
    label: "Store Owner",
    badgeLabel: "Owner",
    tag: "Full access",
    icon: Crown,
    tagline: "Full business & team control",
    description: "Complete control over business profile, return policies, printer hardware settings & team members.",
    colorTheme: {
      pillBg: "bg-purple-50 text-purple-800 border-purple-300/80 hover:bg-purple-100/70",
      activePill: "ring-2 ring-purple-500/30",
      iconBg: "bg-purple-100 text-purple-700",
      selectedBorder: "border-purple-500 bg-purple-50/60 ring-1 ring-purple-500",
      badgeTone: "bg-purple-100 text-purple-800",
      checkColor: "text-purple-700",
    },
  },
];

export function RoleDropdownSelector({
  currentRole,
  onChange,
  disabled = false,
  memberName = "Staff Member",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const norm = normalizeRole(currentRole);
  const activeOption =
    ROLE_OPTIONS.find((opt) => opt.role === norm) || ROLE_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectRole = (newRole) => {
    if (newRole !== norm) {
      onChange(newRole);
    }
    setIsOpen(false);
  };

  if (disabled) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${activeOption.colorTheme.pillBg}`}
      >
        <ActiveIcon className="h-3.5 w-3.5 shrink-0" />
        <span>{activeOption.badgeLabel}</span>
      </span>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Interactive Role Trigger Pill */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Change role for ${memberName}. Current role: ${activeOption.label}`}
        className={`group inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black shadow-2xs transition-all duration-150 active:scale-95 ${
          activeOption.colorTheme.pillBg
        } ${isOpen ? activeOption.colorTheme.activePill : ""}`}
      >
        <ActiveIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110" />
        <span className="tracking-wide">{activeOption.badgeLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 opacity-70 group-hover:opacity-100 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 z-40 mt-1.5 w-72 sm:w-80 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2.5 py-2 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Change Assigned Role
              </p>
              <p className="text-xs font-bold text-ink truncate max-w-[200px]">
                {memberName}
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
              Select one
            </span>
          </div>

          <div className="mt-1 space-y-1">
            {ROLE_OPTIONS.map((opt) => {
              const isSelected = opt.role === norm;
              const IconComponent = opt.icon;

              return (
                <button
                  key={opt.role}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectRole(opt.role)}
                  className={`w-full rounded-xl p-2.5 text-left transition-all flex items-start gap-3 ${
                    isSelected
                      ? opt.colorTheme.selectedBorder
                      : "border border-transparent hover:border-slate-200 hover:bg-slate-50/90"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition ${opt.colorTheme.iconBg}`}
                  >
                    <IconComponent className="h-4 w-4" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-ink">
                        {opt.label}
                      </span>
                      {isSelected ? (
                        <span
                          className={`inline-flex items-center gap-0.5 text-[11px] font-black ${opt.colorTheme.checkColor}`}
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">
                          {opt.tag}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] font-semibold text-slate-600 mt-0.5 leading-snug">
                      {opt.tagline}
                    </p>

                    <p className="text-[10px] text-slate-400 mt-1 leading-normal flex items-start gap-1">
                      {opt.role === ROLES.STAFF ? (
                        <Lock className="h-3 w-3 shrink-0 text-slate-400 mt-0.5" />
                      ) : null}
                      <span>{opt.description}</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-slate-100 px-2 py-1.5 bg-slate-50/70 rounded-xl flex items-center justify-between text-[10px] text-slate-400">
            <span>Tap to apply immediately</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="font-bold text-slate-600 hover:text-ink"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    bg: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/80",
    dot: "bg-amber-500",
    description: "In progress, not yet sent to client",
  },
  sent: {
    label: "Sent",
    bg: "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100/80",
    dot: "bg-blue-500",
    description: "Dispatched to customer via WhatsApp or PDF",
  },
  paid: {
    label: "Paid",
    bg: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80",
    dot: "bg-emerald-500",
    description: "Payment fully collected & settled",
  },
  declined: {
    label: "Declined",
    bg: "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100/80",
    dot: "bg-rose-500",
    description: "Estimate or proposal declined by client",
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80",
    dot: "bg-slate-400",
    description: "Voided or cancelled transaction",
  },
};

export function StatusDropdown({
  value = "draft",
  onChange,
  size = "md",
  disabled = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const current = STATUS_CONFIG[value] || STATUS_CONFIG.draft;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (key) => {
    if (onChange) onChange(key);
    setIsOpen(false);
  };

  const isSmall = size === "sm";

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`inline-flex items-center gap-1.5 rounded-xl border font-black uppercase tracking-wider transition-all shadow-2xs select-none disabled:opacity-60 ${
          current.bg
        } ${
          isSmall
            ? "px-2.5 py-1 text-[10px]"
            : "px-3 py-1.5 text-xs ring-1 ring-black/5"
        }`}
        title={`Status: ${current.label}`}
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${current.dot}`} />
        <span>{current.label}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform duration-200 opacity-60 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            Change Document Status
          </div>

          <div className="space-y-0.5">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => {
              const isSelected = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelect(key)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold transition-colors ${
                    isSelected
                      ? "bg-slate-100 text-ink"
                      : "text-slate-600 hover:bg-slate-50 hover:text-ink"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${config.dot}`} />
                    <div>
                      <p className="font-black text-xs leading-none">{config.label}</p>
                      <p className="text-[10px] font-normal text-slate-400 mt-0.5 line-clamp-1">
                        {config.description}
                      </p>
                    </div>
                  </div>

                  {isSelected && <Check className="h-4 w-4 text-palm shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

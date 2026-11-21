import { useState, useRef, useEffect } from "react";
import {
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronDown,
  Check,
  Copy,
} from "lucide-react";
import { showToast } from "../../lib/toast.js";

const DOC_TYPES = {
  invoice: {
    id: "invoice",
    label: "Commercial Invoice",
    short: "INV",
    icon: FileText,
    badgeColor: "bg-palm/10 text-palm border-palm/20",
    description: "Standard commercial tax invoice for billed sales",
  },
  quotation: {
    id: "quotation",
    label: "Quotation / Estimate",
    short: "QT",
    icon: Sparkles,
    badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
    description: "Price estimate & proposal for prospective clients",
  },
  receipt: {
    id: "receipt",
    label: "Official Receipt",
    short: "REC",
    icon: CheckCircle2,
    badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    description: "Proof of payment received & settled",
  },
  proforma: {
    id: "proforma",
    label: "Proforma Invoice",
    short: "PI",
    icon: Clock,
    badgeColor: "bg-blue-50 text-blue-800 border-blue-200",
    description: "Preliminary invoice for advance payment or customs",
  },
};

export function DocTypeSelector({
  value = "invoice",
  onChange,
  docNumber = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const current = DOC_TYPES[value] || DOC_TYPES.invoice;
  const CurrentIcon = current.icon;

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
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

  const handleCopyDocNumber = (e) => {
    e.stopPropagation();
    if (!docNumber) return;
    navigator.clipboard?.writeText(docNumber);
    showToast(`Copied ${docNumber} to clipboard`, { type: "info" });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" ref={containerRef}>
      {/* Document Type Dropdown Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-ink shadow-2xs hover:border-palm transition active:scale-95"
        >
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-palm/10 text-palm shrink-0">
            <CurrentIcon className="h-3.5 w-3.5" />
          </span>
          <span className="tracking-tight">{current.label}</span>
          <span
            className={`rounded-md border px-1.5 py-0.2 text-[10px] font-black uppercase tracking-wider ${current.badgeColor}`}
          >
            {current.short}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-2 w-72 rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
              Select Document Format
            </div>

            <div className="space-y-1">
              {Object.values(DOC_TYPES).map((type) => {
                const Icon = type.icon;
                const isSelected = type.id === value;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      if (onChange) onChange(type.id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-start gap-3 rounded-2xl p-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-palm/10 text-ink"
                        : "hover:bg-slate-50 text-slate-700 hover:text-ink"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-xl shrink-0 mt-0.5 ${
                        isSelected ? "bg-palm text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs">{type.label}</span>
                        <span
                          className={`rounded px-1 text-[9px] font-black uppercase border ${type.badgeColor}`}
                        >
                          {type.short}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                        {type.description}
                      </p>
                    </div>

                    {isSelected && <Check className="h-4 w-4 text-palm shrink-0 mt-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Doc Number Pill with Copy Shortcut */}
      {docNumber && (
        <button
          type="button"
          onClick={handleCopyDocNumber}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-600 hover:bg-slate-100 hover:text-ink transition shadow-2xs group"
          title="Click to copy document number"
        >
          <span>{docNumber}</span>
          <Copy className="h-3 w-3 text-slate-400 group-hover:text-palm transition" />
        </button>
      )}
    </div>
  );
}

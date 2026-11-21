import { useState, useRef, useEffect, useMemo } from "react";
import { UserCheck, Search, X, ChevronDown, Check, Phone, MapPin, UserPlus } from "lucide-react";

export function CustomerPicker({
  customers = [],
  selectedName = "",
  selectedPhone = "",
  onSelectCustomer,
  onClearCustomer,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers.slice(0, 15);
    return customers
      .filter((c) => {
        const nameMatch = (c.name || "").toLowerCase().includes(q);
        const phoneMatch = (c.phone || "").includes(q);
        return nameMatch || phoneMatch;
      })
      .slice(0, 15);
  }, [customers, searchQuery]);

  const getInitials = (name = "") => {
    const parts = name.trim().split(/\s+/);
    if (!parts.length || !parts[0]) return "CU";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const hasSelected = Boolean(selectedName && selectedName.trim());

  return (
    <div className="relative" ref={containerRef}>
      {/* State 1: A customer is currently populated */}
      {hasSelected ? (
        <div className="rounded-2xl border border-palm/30 bg-skyglass/60 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-palm text-white font-black text-xs shadow-xs">
              {getInitials(selectedName)}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-ink">{selectedName}</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-palm/10 px-1.5 py-0.5 text-[10px] font-bold text-palm">
                  <UserCheck className="h-3 w-3" /> Linked Customer
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                {selectedPhone && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="h-3 w-3 text-slate-400" /> {selectedPhone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-palm hover:text-palm transition shadow-2xs"
            >
              Change Customer
            </button>
            <button
              type="button"
              onClick={onClearCustomer}
              className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-400 hover:text-red-600 transition shadow-2xs"
              title="Clear customer details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* State 2: No customer selected - Trigger Bar */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white border border-slate-200 text-palm shadow-2xs">
              <UserCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="font-black text-ink leading-none">Quick-Pick Saved Customer</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Auto-fill name, phone, and delivery address from your client book
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-palm bg-palm text-white px-3.5 py-2 font-bold shadow-xs hover:bg-palm/90 active:scale-95 transition"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Select Customer ({customers.length})</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}

      {/* Popover / Search Combobox Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-palm" />
              <span>Select Customer</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search bar inside combobox */}
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name or phone number..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs font-medium text-ink focus:outline-none focus:border-palm focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Customers list */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 pr-1">
            {filteredCustomers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <p className="font-bold text-slate-600">No matching customers found</p>
                <p className="text-[11px] mt-1">You can type new customer details directly in the fields below.</p>
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isCurrent = c.name === selectedName;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (onSelectCustomer) onSelectCustomer(c);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={`flex w-full items-center justify-between gap-3 p-2.5 rounded-2xl text-left transition-colors ${
                      isCurrent
                        ? "bg-palm/10 text-ink"
                        : "hover:bg-slate-50 text-slate-700 hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 font-black text-xs">
                        {getInitials(c.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-black text-xs text-ink truncate">{c.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          {c.phone && (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="h-2.5 w-2.5" /> {c.phone}
                            </span>
                          )}
                          {c.address && (
                            <span className="flex items-center gap-1 truncate max-w-[140px]">
                              <MapPin className="h-2.5 w-2.5" /> {c.address}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-palm text-white shrink-0">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-palm px-2 py-1 rounded-lg bg-palm/10 opacity-0 group-hover:opacity-100 transition shrink-0">
                        Select
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Showing {filteredCustomers.length} of {customers.length}</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onClearCustomer();
              }}
              className="text-palm font-bold hover:underline flex items-center gap-1"
            >
              <UserPlus className="h-3 w-3" /> Or Enter New Customer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

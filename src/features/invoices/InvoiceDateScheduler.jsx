import { useMemo, useRef } from "react";
import { Calendar, Clock, Sparkles } from "lucide-react";

export function InvoiceDateScheduler({
  label,
  value,
  onChange,
  isDueDate = false,
  required = false,
}) {
  const inputRef = useRef(null);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const relativeNotice = useMemo(() => {
    if (!value || !isDueDate) return null;
    const target = new Date(value + "T00:00:00");
    const today = new Date(todayStr + "T00:00:00");
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { text: "Due Today", color: "bg-amber-100 text-amber-800 border-amber-200" };
    }
    if (diffDays > 0) {
      return {
        text: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
        color: "bg-palm/10 text-palm border-palm/20",
      };
    }
    const overdue = Math.abs(diffDays);
    return {
      text: `Overdue by ${overdue} day${overdue === 1 ? "" : "s"}`,
      color: "bg-rose-100 text-rose-800 border-rose-200",
    };
  }, [value, isDueDate, todayStr]);

  const setDateByOffset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dateStr = d.toISOString().split("T")[0];
    if (onChange) onChange(dateStr);
  };

  const setEndOfMonth = () => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dateStr = end.toISOString().split("T")[0];
    if (onChange) onChange(dateStr);
  };

  const openCalendar = () => {
    if (inputRef.current) {
      if (typeof inputRef.current.showPicker === "function") {
        try {
          inputRef.current.showPicker();
        } catch {
          inputRef.current.focus();
        }
      } else {
        inputRef.current.focus();
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-black text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {relativeNotice && (
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${relativeNotice.color}`}
          >
            {relativeNotice.text}
          </span>
        )}
      </div>

      {/* Modern Date Input Container */}
      <div
        onClick={openCalendar}
        className="group relative flex items-center rounded-2xl border border-slate-200 bg-white px-3.5 py-2 shadow-2xs hover:border-palm focus-within:border-palm focus-within:ring-2 focus-within:ring-palm/20 transition cursor-pointer"
      >
        <span className="grid h-7 w-7 place-items-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-palm/10 group-hover:text-palm transition mr-2.5 shrink-0">
          {isDueDate ? <Clock className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
        </span>

        <input
          ref={inputRef}
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full bg-transparent text-xs font-bold text-ink outline-none cursor-pointer"
        />
      </div>

      {/* Quick Presets Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5 text-palm" /> Presets:
        </span>
        {isDueDate ? (
          <>
            <button
              type="button"
              onClick={() => setDateByOffset(0)}
              className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border transition ${
                value === todayStr
                  ? "bg-palm text-white border-palm shadow-2xs"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateByOffset(3)}
              className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-ink transition"
            >
              +3 Days
            </button>
            <button
              type="button"
              onClick={() => setDateByOffset(7)}
              className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-ink transition"
            >
              +7 Days (1 Wk)
            </button>
            <button
              type="button"
              onClick={() => setDateByOffset(14)}
              className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-ink transition"
            >
              +14 Days (2 Wks)
            </button>
            <button
              type="button"
              onClick={() => setDateByOffset(30)}
              className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-ink transition"
            >
              +30 Days
            </button>
            <button
              type="button"
              onClick={setEndOfMonth}
              className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-ink transition"
            >
              End of Month
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setDateByOffset(0)}
              className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border transition ${
                value === todayStr
                  ? "bg-palm text-white border-palm shadow-2xs"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateByOffset(-1)}
              className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-ink transition"
            >
              Yesterday
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export const DatePickerWithPresets = InvoiceDateScheduler;

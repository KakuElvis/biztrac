import { ArrowRight, Sparkles, AlertTriangle, AlertCircle, TrendingUp, Lightbulb } from "lucide-react";
import { classNames } from "../../lib/formatters.js";

export function AIInsightCard({ insight, onAction }) {
  const { title, description, severity, actionLabel, actionPrompt } = insight;

  const Icon =
    severity === "critical"
      ? AlertCircle
      : severity === "warning"
      ? AlertTriangle
      : TrendingUp;

  return (
    <div
      className={classNames(
        "group flex flex-col justify-between rounded-2xl border p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg",
        severity === "critical"
          ? "border-red-200 bg-red-50/50"
          : severity === "warning"
          ? "border-amber-200 bg-amber-50/50"
          : "border-sky-200 bg-sky-50/50"
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={classNames(
                "grid h-7 w-7 place-items-center rounded-xl text-white shadow-sm",
                severity === "critical"
                  ? "bg-red-600"
                  : severity === "warning"
                  ? "bg-amber-600"
                  : "bg-palm"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="text-xs font-black uppercase tracking-wider text-ink">
              {title}
            </h3>
          </div>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-slate-600 border border-slate-200">
            ✨ AI Insight
          </span>
        </div>

        <p className="mt-2.5 text-xs font-semibold leading-relaxed text-slate-700">
          {description}
        </p>
      </div>

      <button
        onClick={() => onAction(actionPrompt)}
        className={classNames(
          "mt-4 flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-white shadow-md transition",
          severity === "critical"
            ? "bg-red-600 hover:bg-red-700 shadow-red-600/20"
            : severity === "warning"
            ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
            : "bg-palm hover:bg-palmDeep shadow-palm/20"
        )}
      >
        <span>{actionLabel || "Ask AI"}</span>
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
      </button>
    </div>
  );
}

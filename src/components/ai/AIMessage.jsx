import { useState } from "react";
import {
  Check,
  Copy,
  Lightbulb,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { classNames } from "../../lib/formatters.js";

function parseSimpleMarkdown(text) {
  if (!text) return "";
  // Simple renderer for bold **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-bold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export function AIMessage({ message, onSelectSuggestion, onRateFeedback }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-palm px-4 py-3 text-sm font-semibold text-white shadow-md shadow-palm/10 sm:max-w-[75%]">
          {message.content}
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-200 text-slate-700">
          <User className="h-4 w-4" />
        </div>
      </div>
    );
  }

  const {
    content,
    facts = [],
    insights = [],
    recommendation,
    dataCards = [],
    suggestions = [],
    feedback,
  } = message;

  return (
    <div className="flex gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-palm to-palmDeep text-white shadow-md shadow-palm/20">
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        {/* Main Header & Body Text */}
        <div className="rounded-2xl rounded-tl-none border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-palm">
                ✨ BizTrac AI Assistant
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[0.7rem] font-bold text-slate-500 hover:bg-slate-100 hover:text-ink"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="text-sm leading-relaxed text-slate-700">
            {parseSimpleMarkdown(content)}
          </div>

          {/* FACTS SECTION */}
          {facts.length > 0 ? (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Zap className="h-3.5 w-3.5 text-palm" />
                <span>Verified Metrics (Facts)</span>
              </div>
              <ul className="space-y-1 text-xs font-semibold text-slate-700">
                {facts.map((fact, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-palm" />
                    <span>{parseSimpleMarkdown(fact)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* INSIGHTS SECTION */}
          {insights.length > 0 ? (
            <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/70 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-800">
                <TrendingUp className="h-3.5 w-3.5 text-sky-600" />
                <span>Business Insight</span>
              </div>
              <ul className="space-y-1 text-xs font-semibold text-sky-900">
                {insights.map((ins, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                    <span>{parseSimpleMarkdown(ins)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* RECOMMENDATION SECTION */}
          {recommendation ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs font-semibold text-amber-950 shadow-sm">
              <div className="mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-800">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <span>Actionable Recommendation</span>
              </div>
              <p className="mt-1 leading-relaxed">{parseSimpleMarkdown(recommendation)}</p>
            </div>
          ) : null}

          {/* DATA CARDS GRID */}
          {dataCards.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {dataCards.map((card, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-palm/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-slate-600">{card.title}</span>
                    {card.badge ? (
                      <span
                        className={classNames(
                          "rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wider",
                          card.badgeType === "critical"
                            ? "bg-red-100 text-red-700"
                            : card.badgeType === "warning"
                            ? "bg-amber-100 text-amber-800"
                            : card.badgeType === "success"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-sky-100 text-sky-800"
                        )}
                      >
                        {card.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-base font-black text-ink">{card.value}</p>
                  {card.subtitle ? (
                    <p className="mt-0.5 truncate text-[0.7rem] font-medium text-slate-500">
                      {card.subtitle}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {/* FEEDBACK BUTTONS */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[0.68rem] font-semibold text-slate-400">
              Was this analysis helpful?
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRateFeedback?.(message.id, "up")}
                className={classNames(
                  "rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-emerald-600",
                  feedback === "up" ? "bg-emerald-50 text-emerald-600" : ""
                )}
                title="Helpful"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onRateFeedback?.(message.id, "down")}
                className={classNames(
                  "rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-red-600",
                  feedback === "down" ? "bg-red-50 text-red-600" : ""
                )}
                title="Needs Improvement"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* SUGGESTION CHIPS */}
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pl-1">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => onSelectSuggestion?.(sug)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-palm hover:bg-skyglass hover:text-palm"
              >
                ✨ {sug}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

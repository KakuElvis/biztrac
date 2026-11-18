import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import { classNames } from "../../lib/formatters.js";

const toneConfig = {
  emerald: {
    bgGradient: "from-emerald-500 via-emerald-600 to-teal-800 text-white",
    borderColor: "border-white/20 hover:border-white/40",
    shadow: "shadow-lg shadow-emerald-900/20 hover:shadow-xl hover:shadow-emerald-900/35",
    glow: "bg-white/15",
    watermark: "text-white opacity-15",
    iconBg: "bg-white/20 text-white border border-white/30 backdrop-blur-md shadow-md shadow-black/10",
    badgeBg: "bg-white/20 text-white border border-white/25 backdrop-blur-md",
    dot: "bg-white ring-2 ring-white/40",
    accentLight: "from-white/25 via-white/5 to-transparent",
  },
  blue: {
    bgGradient: "from-[#027AEC] via-blue-600 to-[#022864] text-white",
    borderColor: "border-white/20 hover:border-white/40",
    shadow: "shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/35",
    glow: "bg-white/15",
    watermark: "text-white opacity-15",
    iconBg: "bg-white/20 text-white border border-white/30 backdrop-blur-md shadow-md shadow-black/10",
    badgeBg: "bg-white/20 text-white border border-white/25 backdrop-blur-md",
    dot: "bg-white ring-2 ring-white/40",
    accentLight: "from-white/25 via-white/5 to-transparent",
  },
  teal: {
    bgGradient: "from-teal-500 via-teal-600 to-cyan-900 text-white",
    borderColor: "border-white/20 hover:border-white/40",
    shadow: "shadow-lg shadow-teal-900/20 hover:shadow-xl hover:shadow-teal-900/35",
    glow: "bg-white/15",
    watermark: "text-white opacity-15",
    iconBg: "bg-white/20 text-white border border-white/30 backdrop-blur-md shadow-md shadow-black/10",
    badgeBg: "bg-white/20 text-white border border-white/25 backdrop-blur-md",
    dot: "bg-white ring-2 ring-white/40",
    accentLight: "from-white/25 via-white/5 to-transparent",
  },
  rose: {
    bgGradient: "from-rose-500 via-rose-600 to-red-800 text-white",
    borderColor: "border-white/20 hover:border-white/40",
    shadow: "shadow-lg shadow-rose-900/20 hover:shadow-xl hover:shadow-rose-900/35",
    glow: "bg-white/15",
    watermark: "text-white opacity-15",
    iconBg: "bg-white/20 text-white border border-white/30 backdrop-blur-md shadow-md shadow-black/10",
    badgeBg: "bg-white/20 text-white border border-white/25 backdrop-blur-md",
    dot: "bg-white ring-2 ring-white/40",
    accentLight: "from-white/25 via-white/5 to-transparent",
  },
  purple: {
    bgGradient: "from-purple-600 via-purple-700 to-indigo-900 text-white",
    borderColor: "border-white/20 hover:border-white/40",
    shadow: "shadow-lg shadow-purple-900/20 hover:shadow-xl hover:shadow-purple-900/35",
    glow: "bg-white/15",
    watermark: "text-white opacity-15",
    iconBg: "bg-white/20 text-white border border-white/30 backdrop-blur-md shadow-md shadow-black/10",
    badgeBg: "bg-white/20 text-white border border-white/25 backdrop-blur-md",
    dot: "bg-white ring-2 ring-white/40",
    accentLight: "from-white/25 via-white/5 to-transparent",
  },
  amber: {
    bgGradient: "from-amber-500 via-amber-600 to-orange-800 text-white",
    borderColor: "border-white/20 hover:border-white/40",
    shadow: "shadow-lg shadow-amber-900/20 hover:shadow-xl hover:shadow-amber-900/35",
    glow: "bg-white/15",
    watermark: "text-white opacity-15",
    iconBg: "bg-white/20 text-white border border-white/30 backdrop-blur-md shadow-md shadow-black/10",
    badgeBg: "bg-white/20 text-white border border-white/25 backdrop-blur-md",
    dot: "bg-white ring-2 ring-white/40",
    accentLight: "from-white/25 via-white/5 to-transparent",
  },
};

function resolveTone(tone) {
  if (tone === "green") return toneConfig.emerald;
  if (tone === "red") return toneConfig.rose;
  return toneConfig[tone] || toneConfig.emerald;
}

export function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "emerald",
  trend = "up",
  onClick,
}) {
  const config = resolveTone(tone);

  let TrendIcon = ArrowUpRight;
  if (trend === "down") {
    TrendIcon = ArrowDownRight;
  } else if (trend === "alert") {
    TrendIcon = AlertTriangle;
  } else if (trend === "neutral") {
    TrendIcon = Minus;
  }

  return (
    <article
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={classNames(
        "group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300",
        "bg-gradient-to-br",
        config.bgGradient,
        config.borderColor,
        config.shadow,
        onClick &&
          "cursor-pointer hover:-translate-y-1.5 focus:outline-none focus:ring-4 focus:ring-white/30"
      )}
    >
      {/* Top Gloss Sheen Overlay */}
      <div
        className={classNames(
          "pointer-events-none absolute -left-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br blur-xl",
          config.accentLight
        )}
      />

      {/* Top-Right Ambient Glow Orb */}
      <div
        className={classNames(
          "pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100",
          config.glow
        )}
      />

      {/* Large Translucent Watermark Icon */}
      <div
        className={classNames(
          "pointer-events-none absolute -bottom-3 -right-3 transition-transform duration-300 group-hover:scale-115 group-hover:-rotate-6",
          config.watermark
        )}
      >
        <Icon className="h-24 w-24" />
      </div>

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={classNames("h-2 w-2 rounded-full shrink-0", config.dot)} />
            <p className="text-xs font-black uppercase tracking-wider text-white/85 truncate">
              {label}
            </p>
          </div>
          <p className="mt-2.5 text-2xl font-black tracking-tight text-white drop-shadow-sm sm:text-3xl">
            {value}
          </p>
        </div>

        <div
          className={classNames(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
            config.iconBg
          )}
        >
          <Icon className="h-6 w-6 stroke-[2.2]" />
        </div>
      </div>

      <div className="relative z-10 mt-5 flex items-center justify-between gap-2 border-t border-white/15 pt-3">
        <div
          className={classNames(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black shadow-xs",
            config.badgeBg
          )}
        >
          <TrendIcon className="h-3.5 w-3.5 shrink-0 stroke-[2.5] text-white" />
          <span className="truncate">{note}</span>
        </div>

        {onClick ? (
          <span className="flex items-center gap-0.5 text-xs font-black text-white/75 transition-all duration-200 group-hover:text-white group-hover:translate-x-0.5">
            <span className="hidden sm:inline">View</span>
            <ChevronRight className="h-4 w-4" />
          </span>
        ) : null}
      </div>
    </article>
  );
}

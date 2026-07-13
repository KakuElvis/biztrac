import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { classNames } from "../../lib/formatters.js";

export function MetricCard({ label, value, note, icon: Icon, tone = "green", trend = "up" }) {
  const tones = {
    green: "bg-success/10 text-success",
    amber: "bg-warning/15 text-warning",
    red: "bg-red-50 text-red-700",
    blue: "bg-primary/10 text-primary",
  };
  const TrendIcon = trend === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <article className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-normal text-ink">{value}</p>
        </div>
        <div className={classNames("grid h-11 w-11 place-items-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-slate-500">
        <TrendIcon className={classNames("h-3.5 w-3.5", trend === "down" ? "text-red-500" : "text-success")} />
        <span>{note}</span>
      </div>
    </article>
  );
}

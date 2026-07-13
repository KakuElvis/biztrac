import { classNames } from "../../lib/formatters.js";

const variants = {
  green: "bg-success/10 text-success ring-success/20",
  amber: "bg-warning/15 text-warning ring-warning/25",
  red: "bg-red-50 text-red-700 ring-red-100",
  blue: "bg-primary/10 text-primary ring-primary/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function Badge({ children, variant = "slate", className = "" }) {
  return (
    <span
      className={classNames(
        "inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold ring-1",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

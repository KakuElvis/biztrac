import { Loader2 } from "lucide-react";
import { classNames } from "../../lib/formatters.js";

const variants = {
  primary: "bg-palm text-white shadow-lg shadow-palm/20 hover:bg-palmDeep",
  secondary: "border border-slate-200 bg-white text-ink hover:border-palm/40 hover:text-palm",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  children,
  icon: Icon,
  variant = "primary",
  className = "",
  isLoading = false,
  ...props
}) {
  return (
    <button
      className={classNames(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-palm/15 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      <span>{children}</span>
    </button>
  );
}

import { Lock } from "lucide-react";

/**
 * MaskedValue displays confidential financial data (cost prices, profits)
 * when authorized, or an elegant security badge when viewed by a cashier account.
 */
export function MaskedValue({
  value,
  isAllowed = false,
  placeholder = "••••••",
  label = "Confidential",
  className = "",
  inline = false,
}) {
  if (isAllowed) {
    return <span className={className}>{value}</span>;
  }

  if (inline) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-xs font-semibold text-slate-400 select-none ${className}`}
        title="Hidden for Cashier role"
      >
        <Lock className="h-3 w-3 shrink-0 text-slate-400" />
        <span>{placeholder}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-2xs select-none ${className}`}
      title="Restricted: Visible to Owner and Manager only"
    >
      <Lock className="h-3 w-3 shrink-0 text-slate-400" />
      <span className="font-mono tracking-wider">{placeholder}</span>
      {label ? <span className="text-[10px] uppercase font-bold text-slate-400">({label})</span> : null}
    </span>
  );
}

import { Crown, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "./Button.jsx";
import { usePlan } from "../../hooks/usePlan.js";
import { PRO_PERKS } from "../../lib/plans.js";

export function ProGate({
  business,
  feature,
  children,
  title,
  description,
  onUpgrade,
  compact = false,
}) {
  const { canAccess } = usePlan(business);

  if (canAccess(feature)) {
    return children;
  }

  const perk = PRO_PERKS.find((p) => p.feature === feature);
  const displayTitle = title || perk?.title || "Pro Feature";
  const displayDescription =
    description ||
    perk?.description ||
    "Upgrade your store to BizTrac Pro to unlock this capability and accelerate your business.";

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onUpgrade}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onUpgrade?.();
        }}
        className="group relative flex cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-3.5 transition hover:border-amber-400 hover:bg-amber-100/70"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
            <Crown className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-slate-900 group-hover:text-amber-900">
              {displayTitle}
            </p>
            <p className="text-[11px] font-medium text-slate-500">Available on BizTrac Pro</p>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-black text-white shadow-xs transition group-hover:bg-amber-600">
          Unlock
        </span>
      </div>
    );
  }

  return (
    <div className="relative mx-auto my-6 max-w-lg overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/80 via-white to-white p-6 sm:p-8 text-center shadow-soft">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/25">
        <Crown className="h-7 w-7" />
      </div>

      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-800">
        <Sparkles className="h-3 w-3" /> BizTrac Pro
      </div>

      <h3 className="text-xl font-black text-slate-900">{displayTitle}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        {displayDescription}
      </p>

      <div className="my-6 rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-left">
        <p className="text-xs font-black uppercase tracking-wider text-amber-900 mb-2.5">
          Everything included in Pro:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Unlimited products</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Multi-Cashier accounts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Invoices & Quotations</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Profit margin tracking</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>VAT Act 1151 Tax reports</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>WhatsApp statements</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          variant="primary"
          className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-amber-500/20 hover:from-amber-600 hover:to-amber-700"
          icon={Crown}
          onClick={onUpgrade}
        >
          Upgrade to Pro
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { X, Crown, Check, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { Button } from "../common/Button.jsx";
import { showToast } from "../../lib/toast.js";
import { PLAN_PRICING, PRO_PERKS, isProBusiness, getDaysRemaining } from "../../lib/plans.js";
import { upgradeBusinessPlan } from "../../services/businessService.js";

export function UpgradeModal({ isOpen, onClose, business, onPlanUpdated }) {
  const [billingCycle, setBillingCycle] = useState("annual"); // "monthly" | "annual"
  const [isUpgrading, setIsUpgrading] = useState(false);

  if (!isOpen) return null;

  const isPro = isProBusiness(business);
  const daysLeft = getDaysRemaining(business);
  const selectedPlan = PLAN_PRICING[billingCycle];

  const handleUpgrade = async (isDemo = false) => {
    if (!business?.id) {
      showToast("Store information not loaded.", { type: "error" });
      return;
    }

    try {
      setIsUpgrading(true);
      const duration = selectedPlan.durationDays;
      const ref = isDemo ? `DEMO-${Date.now()}` : `MOMO-${Date.now()}`;

      const res = await upgradeBusinessPlan(business.id, {
        planTier: "pro",
        durationDays: duration,
        reference: ref,
        amount: isDemo ? 0 : selectedPlan.amount,
        paymentMethod: isDemo ? "demo" : "momo",
      });

      showToast(
        isDemo
          ? "Demo Pro activated! Enjoy full Pro capabilities."
          : `Upgraded to BizTrac Pro (${selectedPlan.label})!`,
        { type: "success" }
      );

      if (onPlanUpdated) {
        onPlanUpdated({
          ...business,
          plan_tier: res.plan_tier,
          plan_expires_at: res.plan_expires_at,
        });
      }

      onClose();
    } catch (err) {
      console.error("Upgrade error:", err);
      showToast(err.message || "Could not complete upgrade.", { type: "error" });
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl transition-all border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 p-6 text-white text-center relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full bg-black/15 text-white/90 hover:bg-black/30 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md shadow-inner">
            <Crown className="h-6 w-6 text-amber-100" />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-xs font-black uppercase tracking-wider backdrop-blur-xs mb-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" /> BizTrac Pro
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Unlock Full Power For Your Business
          </h2>
          <p className="mt-1 text-xs text-amber-100 font-medium max-w-sm mx-auto">
            Scale your operations with multi-staff accounts, profit tracking, branded invoicing, and compliance reports.
          </p>

          {isPro && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/25 px-3 py-1 text-xs font-bold text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <span>Current Status: Pro Active ({daysLeft} days remaining)</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Billing Switcher */}
          <div className="flex items-center justify-center gap-3">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                  billingCycle === "monthly"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Monthly (GHS 60/mo)
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`relative rounded-lg px-4 py-2 text-xs font-bold transition ${
                  billingCycle === "annual"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Annual (GHS 600/yr)
                <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                  Save 17%
                </span>
              </button>
            </div>
          </div>

          {/* Price Callout */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-center">
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-3xl font-black text-slate-900">
                {business?.currency || "GHS"} {selectedPlan.amount}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                / {selectedPlan.period}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{selectedPlan.description}</p>
          </div>

          {/* Perks Grid */}
          <div className="space-y-2.5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">
              Included with Pro
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRO_PERKS.map((perk) => (
                <div key={perk.feature} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-tight">
                      {perk.title}
                    </p>
                    <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                      {perk.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-6 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleUpgrade(true)}
            disabled={isUpgrading}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition inline-flex items-center gap-1"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Instant Demo Pro</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="secondary" onClick={onClose} disabled={isUpgrading} className="flex-1 sm:flex-initial">
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 sm:flex-initial bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-amber-500/25 hover:from-amber-600 hover:to-amber-700"
              icon={Crown}
              isLoading={isUpgrading}
              onClick={() => handleUpgrade(false)}
            >
              {isPro ? "Extend Pro Plan" : "Upgrade with MoMo / Card"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

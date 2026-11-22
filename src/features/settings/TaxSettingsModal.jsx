import { useState, useEffect } from "react";
import { useBackButtonModal } from "../../hooks/useBackButtonModal.js";
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  X,
} from "lucide-react";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { showToast } from "../../lib/toast.js";

export function TaxSettingsModal({
  isOpen,
  onClose,
  business,
  canManageSettings = true,
  onSaveTaxSettings,
}) {
  const [draft, setDraft] = useState({
    vat_enabled: false,
    tin_number: "",
    tax_pricing_mode: "exclusive",
    vat_rate: 15.0,
    nhil_rate: 2.5,
    getfund_rate: 2.5,
  });
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Hook into Android & Browser Back Button
  useBackButtonModal(isOpen, onClose, "tax-settings-modal");

  // Re-sync and lock modal whenever opened
  useEffect(() => {
    if (isOpen) {
      setDraft({
        vat_enabled: Boolean(business?.vat_enabled),
        tin_number: business?.tin_number || "",
        tax_pricing_mode: business?.tax_pricing_mode || "exclusive",
        vat_rate: business?.vat_rate !== undefined ? business.vat_rate : 15.0,
        nhil_rate: business?.nhil_rate !== undefined ? business.nhil_rate : 2.5,
        getfund_rate: business?.getfund_rate !== undefined ? business.getfund_rate : 2.5,
      });
      setIsUnlocked(false);
      setError("");
      setSuccess("");
    }
  }, [isOpen, business]);

  if (!isOpen) return null;

  function updateField(field, value) {
    setError("");
    setSuccess("");
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  const dynamicVat = Number(draft.vat_rate) || 0;
  const dynamicNhil = Number(draft.nhil_rate) || 0;
  const dynamicGetfund = Number(draft.getfund_rate) || 0;
  const dynamicCombined = dynamicVat + dynamicNhil + dynamicGetfund;

  // Real-time calculation previews
  const simExBase = 100.0;
  const simExNhil = Math.round((simExBase * (dynamicNhil / 100) + Number.EPSILON) * 100) / 100;
  const simExGetfund = Math.round((simExBase * (dynamicGetfund / 100) + Number.EPSILON) * 100) / 100;
  const simExVat = Math.round((simExBase * (dynamicVat / 100) + Number.EPSILON) * 100) / 100;
  const simExTax = Math.round((simExNhil + simExGetfund + simExVat + Number.EPSILON) * 100) / 100;
  const simExTotal = Math.round((simExBase + simExTax + Number.EPSILON) * 100) / 100;

  const simInTag = 120.0;
  const simInRate = dynamicCombined / 100;
  const simInBase = simInRate > 0 ? Math.round(((simInTag / (1 + simInRate)) + Number.EPSILON) * 100) / 100 : simInTag;
  const simInNhil = Math.round((simInBase * (dynamicNhil / 100) + Number.EPSILON) * 100) / 100;
  const simInGetfund = Math.round((simInBase * (dynamicGetfund / 100) + Number.EPSILON) * 100) / 100;
  const simInVat = Math.round((simInBase * (dynamicVat / 100) + Number.EPSILON) * 100) / 100;
  const simInTax = Math.round((simInNhil + simInGetfund + simInVat + Number.EPSILON) * 100) / 100;

  async function handleSubmit(event) {
    if (event?.preventDefault) event.preventDefault();
    if (!canManageSettings) {
      setError("Tax configuration can only be modified by the Store Owner or Manager.");
      return;
    }

    if (!isUnlocked) {
      setError("Settings are currently locked. Click 'Unlock to Modify' before saving changes.");
      return;
    }

    const vatNum = Number(draft.vat_rate);
    const nhilNum = Number(draft.nhil_rate);
    const getfundNum = Number(draft.getfund_rate);

    if (
      !Number.isFinite(vatNum) || vatNum < 0 || vatNum > 100 ||
      !Number.isFinite(nhilNum) || nhilNum < 0 || nhilNum > 100 ||
      !Number.isFinite(getfundNum) || getfundNum < 0 || getfundNum > 100
    ) {
      setError("All statutory tax rates must be valid numbers between 0% and 100%.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      await onSaveTaxSettings({
        vat_enabled: Boolean(draft.vat_enabled),
        tin_number: draft.tin_number?.trim() || null,
        tax_pricing_mode: draft.tax_pricing_mode || "exclusive",
        vat_rate: vatNum,
        nhil_rate: nhilNum,
        getfund_rate: getfundNum,
      });
      setSuccess("Tax configuration and rates saved successfully.");
      showToast("Tax configuration updated", { type: "success" });
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || "Unable to save tax settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-5"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
              <Calculator className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-ink">Ghana VAT & Tax Configuration</h2>
                <Badge variant={draft.vat_enabled ? "green" : "slate"}>
                  {draft.vat_enabled ? `Active (${dynamicCombined.toFixed(1)}%)` : "Disabled"}
                </Badge>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Ghana VAT Act 2025 (Act 1151) — Statutory Levies & Tax Rules
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-button h-9 w-9 text-slate-400 hover:text-slate-700"
            aria-label="Close tax modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Security & Modification Protection Banner */}
        {!isUnlocked ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-amber-950">Settings are Protected</p>
                <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                  Tax rates and pricing rules are locked to prevent accidental alterations. Click &quot;Unlock to Modify&quot; to make authorized changes.
                </p>
              </div>
            </div>
            {canManageSettings ? (
              <button
                type="button"
                onClick={() => setIsUnlocked(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-black text-white shadow-xs transition hover:bg-amber-700 active:scale-95 shrink-0"
              >
                <Unlock className="h-3.5 w-3.5" />
                <span>Unlock to Modify</span>
              </button>
            ) : (
              <span className="text-[11px] font-bold text-slate-400 shrink-0">Cashier view (read-only)</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-red-950">Editing Unlocked</p>
                <p className="text-[11px] text-red-800 leading-relaxed mt-0.5">
                  Be careful: changing tax rates or pricing modes will immediately update calculations on future sales receipts across all registers.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsUnlocked(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-700 shadow-xs transition hover:bg-red-50 active:scale-95 shrink-0"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Re-lock</span>
            </button>
          </div>
        )}

        {/* VAT Status Toggle */}
        <div className={`rounded-2xl border p-4 transition ${
          draft.vat_enabled ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50/60"
        }`}>
          <label className={`flex items-start gap-3.5 select-none ${
            !isUnlocked ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
          }`}>
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 rounded-lg border-slate-300 text-palm focus:ring-palm disabled:opacity-50"
              checked={draft.vat_enabled}
              disabled={!isUnlocked || !canManageSettings}
              onChange={(e) => updateField("vat_enabled", e.target.checked)}
            />
            <div className="space-y-1">
              <span className="text-sm font-black text-ink">
                Enable VAT & Statutory Levies for this business
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                {draft.vat_enabled
                  ? "Your POS counter, product catalog, sales receipts, and accounting will compute and itemize Ghana's statutory taxes. Recommended for VAT-registered stores."
                  : "VAT is currently disabled. BizPurse will record sales and print receipts without any tax calculations or VAT lines. Suitable for informal or non-VAT registered retail shops."}
              </p>
            </div>
          </label>
        </div>

        {/* Fields when VAT is enabled */}
        {draft.vat_enabled && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="label">Taxpayer Identification Number (TIN / Ghana Card PIN)</span>
                <input
                  className="field mt-2 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="e.g. C0012345678 or GHA-123456789-0"
                  value={draft.tin_number}
                  disabled={!isUnlocked || !canManageSettings}
                  onChange={(e) => updateField("tin_number", e.target.value.toUpperCase())}
                />
                <span className="mt-1 block text-[11px] font-medium text-slate-400">
                  Printed at the top of customer sales receipts for tax verification.
                </span>
              </label>

              <div>
                <span className="label">Pricing Mode</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!isUnlocked || !canManageSettings}
                    onClick={() => updateField("tax_pricing_mode", "exclusive")}
                    className={`rounded-xl border p-3 text-left transition disabled:opacity-60 ${
                      draft.tax_pricing_mode === "exclusive"
                        ? "border-palm bg-palm/10 ring-2 ring-palm/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="text-xs font-black text-ink">Tax-Exclusive</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Price + Tax at checkout</p>
                  </button>
                  <button
                    type="button"
                    disabled={!isUnlocked || !canManageSettings}
                    onClick={() => updateField("tax_pricing_mode", "inclusive")}
                    className={`rounded-xl border p-3 text-left transition disabled:opacity-60 ${
                      draft.tax_pricing_mode === "inclusive"
                        ? "border-palm bg-palm/10 ring-2 ring-palm/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="text-xs font-black text-ink">Tax-Inclusive</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Shelf price includes tax</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Statutory Tax Rate Adjustment Form */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Statutory Tax Rate Components
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ghana Act 1151 rates. Modify percentages if rates are amended by GRA.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="blue">Combined: {dynamicCombined.toFixed(1)}%</Badge>
                  {isUnlocked && canManageSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        updateField("vat_rate", 15.0);
                        updateField("nhil_rate", 2.5);
                        updateField("getfund_rate", 2.5);
                        showToast("Reset to Act 1151 defaults (15% VAT, 2.5% NHIL, 2.5% GETFund)", { type: "info" });
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-palm hover:text-palm transition active:scale-95 shadow-xs"
                    >
                      Reset to Act 1151 Defaults
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {/* Standard VAT Rate */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-1 focus-within:border-palm">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                    Standard VAT
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      disabled={!isUnlocked || !canManageSettings}
                      className="field text-base font-black text-ink pr-8 disabled:bg-slate-100 disabled:text-slate-500"
                      value={draft.vat_rate}
                      onChange={(e) => updateField("vat_rate", e.target.value)}
                      required
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Value Added Tax (15.0%)</p>
                </div>

                {/* NHIL Levy */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-1 focus-within:border-palm">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                    NHIL Levy
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      disabled={!isUnlocked || !canManageSettings}
                      className="field text-base font-black text-ink pr-8 disabled:bg-slate-100 disabled:text-slate-500"
                      value={draft.nhil_rate}
                      onChange={(e) => updateField("nhil_rate", e.target.value)}
                      required
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Health Insurance (2.5%)</p>
                </div>

                {/* GETFund Levy */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-1 focus-within:border-palm">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                    GETFund Levy
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      disabled={!isUnlocked || !canManageSettings}
                      className="field text-base font-black text-ink pr-8 disabled:bg-slate-100 disabled:text-slate-500"
                      value={draft.getfund_rate}
                      onChange={(e) => updateField("getfund_rate", e.target.value)}
                      required
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Education Trust (2.5%)</p>
                </div>
              </div>

              {/* Dynamic Live Calculation Example */}
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-amber-900">
                <p className="font-black text-amber-950 flex items-center gap-1.5 mb-1.5">
                  <span>💡 Live Math Simulation</span>
                  <span className="font-normal text-amber-800">
                    ({draft.tax_pricing_mode === "exclusive"
                      ? "Exclusive: Shelf Price GH₵ 100.00"
                      : "Inclusive: Tag Price GH₵ 120.00"})
                  </span>
                </p>
                {draft.tax_pricing_mode === "exclusive" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                    <div>Taxable: <strong>GH₵ {simExBase.toFixed(2)}</strong></div>
                    <div>NHIL ({dynamicNhil}%): <strong>GH₵ {simExNhil.toFixed(2)}</strong></div>
                    <div>GETFund ({dynamicGetfund}%): <strong>GH₵ {simExGetfund.toFixed(2)}</strong></div>
                    <div>VAT ({dynamicVat}%): <strong>GH₵ {simExVat.toFixed(2)}</strong></div>
                    <div className="col-span-2 sm:col-span-4 pt-1 border-t border-amber-200/60 font-bold text-amber-900">
                      Total Customer Pays: <strong>GH₵ {simExTotal.toFixed(2)}</strong> (GH₵ {simExBase.toFixed(2)} Revenue + GH₵ {simExTax.toFixed(2)} Tax)
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                    <div>Tag Price: <strong>GH₵ {simInTag.toFixed(2)}</strong></div>
                    <div>Net Supply: <strong>GH₵ {simInBase.toFixed(2)}</strong></div>
                    <div>Levies ({(dynamicNhil + dynamicGetfund).toFixed(1)}%): <strong>GH₵ {(simInNhil + simInGetfund).toFixed(2)}</strong></div>
                    <div>VAT ({dynamicVat}%): <strong>GH₵ {simInVat.toFixed(2)}</strong></div>
                    <div className="col-span-2 sm:col-span-4 pt-1 border-t border-amber-200/60 font-bold text-amber-900">
                      Total Customer Pays: <strong>GH₵ {simInTag.toFixed(2)}</strong> (Includes GH₵ {simInTax.toFixed(2)} Total Tax)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error / Success Feedback */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-xs font-semibold text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <Button
            icon={isUnlocked ? ShieldCheck : Lock}
            type="submit"
            isLoading={isSaving}
            disabled={!isUnlocked || !canManageSettings}
          >
            {isUnlocked ? "Save & Apply Tax Changes" : "Locked (Click Unlock to Edit)"}
          </Button>
        </div>
      </form>
    </div>
  );
}

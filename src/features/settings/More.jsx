import { useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  LogOut,
  MapPin,
  Phone,
  Printer,
  Settings,
  Store,
  UsersRound,
  WalletCards,
  Zap,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Calculator,
} from "lucide-react";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { formatCurrency } from "../../lib/formatters.js";
import { printThermalReceipt, sampleTestReceipt } from "../../lib/receiptHtml.js";
import { showToast } from "../../lib/toast.js";
import { StaffManagement } from "../staff/index.js";
import { TaxSettingsModal } from "./TaxSettingsModal.jsx";

const fallbackBusiness = {
  name: "BizTrac",
  owner: "",
  phone: "",
  email: "",
  location: "",
  logoText: "BT",
};

const returnPolicyPresets = [
  "Goods sold in good condition are not returnable after 3 days",
  "Exchange only within 7 days with original receipt",
  "No refunds. Store credit only",
];

function toBusinessForm(business) {
  return {
    name: business?.name || "",
    phone: business?.phone || "",
    email: business?.email || "",
    location: business?.location || "",
    slogan: business?.slogan || "",
    momo_details: business?.momo_details || "",
    return_policy:
      business?.return_policy ||
      "Goods sold in good condition are not returnable after 3 days.",
    receipt_width: business?.receipt_width || "58mm",
    receipt_footer:
      business?.receipt_footer || "Thank you for your patronage! Visit again.",
    auto_print_receipt: Boolean(business?.auto_print_receipt),
    vat_enabled: Boolean(business?.vat_enabled),
    tin_number: business?.tin_number || "",
    tax_pricing_mode: business?.tax_pricing_mode || "exclusive",
    vat_rate: business?.vat_rate !== undefined ? business.vat_rate : 15.0,
    nhil_rate: business?.nhil_rate !== undefined ? business.nhil_rate : 2.5,
    getfund_rate: business?.getfund_rate !== undefined ? business.getfund_rate : 2.5,
  };
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
      {children}
    </div>
  );
}

export function More({
  business = fallbackBusiness,
  currentUser,
  permissions,
  canManageSettings = true,
  canManageStaff = true,
  previewRole,
  onSetPreviewRole,
  dashboardSummary,
  onNavigate,
  onSignOut,
  onUpdateBusiness,
  pwaState,
}) {
  const debtors = dashboardSummary?.debtors || [];
  const [form, setForm] = useState(() => toBusinessForm(business));
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");

  const [receiptError, setReceiptError] = useState("");
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptSuccess, setReceiptSuccess] = useState("");

  useEffect(() => {
    setForm(toBusinessForm(business));
  }, [business]);

  function updateField(field, value) {
    if (["name", "phone", "email", "location"].includes(field)) {
      setProfileError("");
      setProfileSuccess("");
    } else {
      setReceiptError("");
      setReceiptSuccess("");
    }
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveTaxSettingsModal(nextTaxConfig) {
    const updated = await onUpdateBusiness({
      ...form,
      ...nextTaxConfig,
    });
    setForm((current) => ({ ...current, ...nextTaxConfig }));
    return updated;
  }

  async function handleSaveProfile(event) {
    if (event?.preventDefault) event.preventDefault();
    if (!canManageSettings) {
      setProfileError("Store profile can only be modified by the Store Owner or Manager.");
      showToast("Access restricted: View only for cashiers", { type: "warn" });
      return;
    }
    setProfileError("");
    setProfileSuccess("");

    if (!form.name.trim()) {
      setProfileError("Business name is required.");
      return;
    }

    setProfileSaving(true);
    try {
      await onUpdateBusiness({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        location: form.location.trim(),
        slogan: form.slogan.trim(),
        momo_details: form.momo_details.trim(),
        return_policy: form.return_policy.trim(),
        receipt_width: form.receipt_width,
        receipt_footer: form.receipt_footer.trim(),
        auto_print_receipt: form.auto_print_receipt,
      });
      setProfileSuccess("Business profile updated successfully.");
      showToast("Business profile updated successfully", { type: "success" });
    } catch (saveError) {
      console.error("Unable to save business profile", saveError);
      showToast("Unable to save business profile", { type: "warn" });
      setProfileError(saveError.message || "Unable to save business profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSaveReceiptSettings(event) {
    if (event?.preventDefault) event.preventDefault();
    if (!canManageSettings) {
      setReceiptError("Receipt settings can only be modified by the Store Owner or Manager.");
      showToast("Access restricted: View only for cashiers", { type: "warn" });
      return;
    }
    setReceiptError("");
    setReceiptSuccess("");

    if (!form.name.trim()) {
      setReceiptError("Business name is required to save receipt settings.");
      return;
    }

    setReceiptSaving(true);
    try {
      await onUpdateBusiness({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        location: form.location.trim(),
        slogan: form.slogan.trim(),
        momo_details: form.momo_details.trim(),
        return_policy: form.return_policy.trim(),
        receipt_width: form.receipt_width,
        receipt_footer: form.receipt_footer.trim(),
        auto_print_receipt: form.auto_print_receipt,
      });
      setReceiptSuccess("Receipt & thermal printer settings saved successfully.");
      showToast("Receipt settings saved successfully", { type: "success" });
    } catch (saveError) {
      console.error("Unable to save receipt settings", saveError);
      showToast("Unable to save receipt settings", { type: "warn" });
      setReceiptError(saveError.message || "Unable to save receipt settings.");
    } finally {
      setReceiptSaving(false);
    }
  }

  const handlePrintTestReceipt = () => {
    const testBusiness = {
      name: form.name || business?.name || "BizTrac",
      phone: form.phone || business?.phone || "",
      location: form.location || business?.location || "",
      receipt_width: form.receipt_width,
      slogan: form.slogan,
      momo_details: form.momo_details,
      return_policy: form.return_policy,
      receipt_footer: form.receipt_footer,
    };

    const printed = printThermalReceipt(sampleTestReceipt, testBusiness, () => {
      showToast("Please allow pop-ups to print the test receipt.", { type: "warn" });
    });
    if (printed) {
      showToast(`Printing ${form.receipt_width} test receipt…`, { type: "info" });
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-bold text-palm">More</p>
        <h1 className="mt-1 text-3xl font-black tracking-normal text-ink">Workspace</h1>
      </section>

      {/* Business Overview Header Card */}
      <section className="panel p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-palm text-lg font-black text-white">
            {business.logoText}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-ink">{business.name}</h2>
              <Badge variant="green">Active</Badge>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-500">{business.owner}</p>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-3">
              <span className="flex items-center gap-2"><Phone className="h-4 w-4 text-palm" /> {business.phone || "No phone"}</span>
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-palm" /> {business.location || "No location"}</span>
              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-palm" /> Retail shop</span>
            </div>
          </div>
        </div>
      </section>

      {/* Team & Staff Roles Card */}
      <section className="panel p-4 sm:p-5 border-l-4 border-l-palm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-palm/10 text-palm">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-palm">Security & Control</p>
                {permissions?.roleMeta && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${permissions.roleMeta.badgeBg}`}>
                    {permissions.roleMeta.shortLabel}
                  </span>
                )}
                {permissions?.isSimulating && (
                  <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    Simulated
                  </span>
                )}
              </div>
              <h3 className="text-base font-black text-ink">Staff & Cashier Permissions</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {permissions?.isCashier
                  ? "Your account is in Cashier mode. Confidential store profits and cost prices are hidden."
                  : "Add counter cashiers, manage access, and keep financial profit margins confidential."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {permissions?.isOwnerOrAdmin && onSetPreviewRole && (
              <button
                type="button"
                onClick={() => onSetPreviewRole(previewRole ? null : "staff")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:border-palm hover:text-palm transition shadow-xs flex items-center gap-1.5 active:scale-95"
              >
                {previewRole ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                <span>{previewRole ? "Exit Cashier View" : "Test Cashier View"}</span>
              </button>
            )}
            {canManageStaff && (
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(true)}
                className="rounded-xl bg-palm px-4 py-2 text-xs font-black text-white hover:bg-palmDeep transition shadow-xs flex items-center gap-1.5 active:scale-95"
              >
                <UsersRound className="h-3.5 w-3.5" />
                <span>Manage Team</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Row 1: Dedicated Business Profile Card (Left) & Quick Links / Debtors (Right) */}
      <section className="grid gap-5 lg:grid-cols-2">
        <form className="panel p-4 sm:p-5 flex flex-col justify-between" onSubmit={handleSaveProfile}>
          <div>
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-palm/10 text-palm">
                <Store className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-black text-ink">Business Profile</h2>
                <p className="text-xs font-semibold text-slate-500">Contact & store identification details</p>
              </div>
            </div>

            {!canManageSettings && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 p-2.5 text-xs font-semibold text-slate-600">
                <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                <span>Store profile is managed by Store Owner / Admin. Cashier view is read-only.</span>
              </div>
            )}

            <div className="mt-4 grid gap-4">
              <label>
                <span className="label">Business name</span>
                <input
                  className="field mt-2"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </label>
              <label>
                <span className="label">Phone</span>
                <input
                  className="field mt-2"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                />
              </label>
              <label>
                <span className="label">Email</span>
                <input
                  className="field mt-2"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </label>
              <label>
                <span className="label">Location</span>
                <input
                  className="field mt-2"
                  value={form.location}
                  onChange={(event) => updateField("location", event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="mt-6 space-y-3 pt-3 border-t border-slate-100">
            {profileError ? (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {profileError}
              </div>
            ) : null}
            {profileSuccess ? (
              <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {profileSuccess}
              </div>
            ) : null}
            <Button icon={Store} isLoading={profileSaving} type="submit" disabled={!canManageSettings}>
              Save Business Profile
            </Button>
          </div>
        </form>

        <div className="space-y-5">
          <div className="panel p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="label">Customers</p>
                <h2 className="mt-1 text-lg font-black text-ink">Debtors snapshot</h2>
              </div>
              <UsersRound className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {!debtors.length ? <EmptyState>No outstanding debtors.</EmptyState> : null}
              {debtors.map((debtor) => (
                <div key={debtor.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-black text-ink">{debtor.name}</p>
                    <p className="text-xs font-semibold text-slate-500">{debtor.due}</p>
                  </div>
                  <p className="text-sm font-black text-red-600">{formatCurrency(debtor.amount)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel overflow-hidden">
            {[
              {
                label: "Reports & Analytics",
                icon: BarChart3,
                note: "Sales, profit, best sellers & stock",
                screen: "reports",
              },
              {
                label: "Expenses",
                icon: WalletCards,
                note: "Operational costs & business records",
                screen: "expenses",
              },
              {
                label: "Receipt & Thermal Printer Settings",
                icon: Printer,
                note: "58mm & 80mm rolls, MoMo & footer",
                onClick: () => {
                  document.getElementById("receipt-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
                },
              },
              {
                label: "Ghana VAT & Tax Settings (Act 1151)",
                icon: Calculator,
                note: form.vat_enabled ? `Active (${form.tax_pricing_mode}) • Protected` : "Disabled (Non-VAT store) • Protected",
                onClick: () => {
                  if (canManageSettings) {
                    setIsTaxModalOpen(true);
                  } else {
                    showToast("Access restricted: View only for Store Owner / Manager", { type: "warn" });
                  }
                },
              },
              { label: "Invoices & Quotations", icon: FileText, note: "A4 invoices, estimates, WhatsApp dispatch", screen: "invoices" },
              { label: "Payment accounts", icon: CreditCard, note: "MoMo and bank details" },
              { label: "Low-stock alerts", icon: Bell, note: "Reminder thresholds", screen: "inventory" },
              { label: "App settings", icon: Settings, note: "Theme and staff access" },
            ].map((item) => (
              <button
                key={item.label}
                className="flex min-h-16 w-full items-center justify-between gap-4 border-b border-slate-100 px-4 text-left last:border-b-0 hover:bg-slate-50 transition"
                onClick={() => {
                  if (item.onClick) {
                    item.onClick();
                  } else if (item.screen) {
                    onNavigate(item.screen);
                  }
                }}
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-palm">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-ink">{item.label}</span>
                    <span className="block text-xs font-semibold text-slate-500">{item.note}</span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Row 2: Standalone Receipt & Thermal Printer Settings Card paired with Live Thermal Preview Card */}
      <section id="receipt-settings" className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] scroll-mt-6">
        <form className="panel p-4 sm:p-5 flex flex-col justify-between" onSubmit={handleSaveReceiptSettings}>
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-palm/10 text-palm">
                  <Printer className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-ink">
                    Receipt & Thermal Printer Settings
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Configure ESC/POS thermal paper rolls, MoMo & store policies
                  </p>
                </div>
              </div>
            </div>

            {!canManageSettings && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 p-2.5 text-xs font-semibold text-slate-600">
                <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                <span>Printer and receipt settings are managed by Store Owner / Admin. Cashier view is read-only.</span>
              </div>
            )}

            <div className="mt-4 grid gap-4">
              <div>
                <span className="label">Thermal Printer Paper Width</span>
                <div className="grid grid-cols-2 gap-2.5 mt-2">
                  {[
                    { id: "58mm", label: "58mm (2\" Roll)", desc: "Portable Bluetooth / USB printer" },
                    { id: "80mm", label: "80mm (3\" Roll)", desc: "Standard desktop counter printer" },
                  ].map((pw) => (
                    <button
                      key={pw.id}
                      type="button"
                      className={`p-3 rounded-2xl border text-left transition active:scale-95 ${
                        form.receipt_width === pw.id
                          ? "bg-palm text-white border-palm shadow-sm ring-2 ring-palm/20"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                      onClick={() => updateField("receipt_width", pw.id)}
                    >
                      <p className="font-black text-xs sm:text-sm">{pw.label}</p>
                      <p className={`text-[10px] mt-0.5 ${form.receipt_width === pw.id ? "text-white/80" : "text-slate-400"}`}>
                        {pw.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-Print on Sale Toggle */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 transition hover:bg-slate-50">
                <label className="flex items-center justify-between cursor-pointer gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-ink flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                      <span>Auto-Print on Sale</span>
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                      Automatically opens thermal print dialog immediately when clicking &quot;Complete Sale&quot; to speed up counter checkout.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-slate-300 text-palm focus:ring-palm/20 accent-palm cursor-pointer shrink-0"
                    checked={form.auto_print_receipt}
                    onChange={(e) => updateField("auto_print_receipt", e.target.checked)}
                  />
                </label>
              </div>

              <label>
                <span className="label">MoMo Pay / Merchant Details</span>
                <input
                  className="field mt-2"
                  placeholder="e.g. MoMo Pay: 0244123456 (Shop Name)"
                  value={form.momo_details}
                  onChange={(event) => updateField("momo_details", event.target.value)}
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Printed clearly on receipts and included in WhatsApp slips for instant verification.
                </span>
              </label>

              <label>
                <span className="label">Store Slogan / Tagline</span>
                <input
                  className="field mt-2"
                  placeholder="e.g. Manage Today. Grow Tomorrow."
                  value={form.slogan}
                  onChange={(event) => updateField("slogan", event.target.value)}
                />
              </label>

              {/* Return / Exchange Policy with Ghanaian SME Quick-Chips */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="label">Return / Exchange Policy</span>
                  <span className="text-[11px] font-bold text-slate-400">Presets</span>
                </div>
                <textarea
                  rows={2}
                  className="field mt-2 h-20 resize-none py-2 text-xs"
                  placeholder="e.g. Goods sold in good condition are not returnable after 3 days."
                  value={form.return_policy}
                  onChange={(event) => updateField("return_policy", event.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {returnPolicyPresets.map((preset) => {
                    const isSelected = form.return_policy.trim() === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => updateField("return_policy", preset)}
                        className={`rounded-xl border px-2.5 py-1 text-[11px] font-bold transition active:scale-95 ${
                          isSelected
                            ? "border-palm bg-palm/10 text-palm ring-1 ring-palm/30"
                            : "border-slate-200 bg-white text-slate-600 hover:border-palm/40 hover:bg-slate-50"
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label>
                <span className="label">Receipt Footer Thank You Message</span>
                <input
                  className="field mt-2"
                  placeholder="e.g. Thank you for your patronage! Visit again."
                  value={form.receipt_footer}
                  onChange={(event) => updateField("receipt_footer", event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="mt-6 space-y-3 pt-3 border-t border-slate-100">
            {receiptError ? (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {receiptError}
              </div>
            ) : null}
            {receiptSuccess ? (
              <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {receiptSuccess}
              </div>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button icon={Printer} isLoading={receiptSaving} type="submit" disabled={!canManageSettings} className="flex-1">
                Save Receipt Settings
              </Button>
              <button
                type="button"
                onClick={handlePrintTestReceipt}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 shadow-sm transition hover:border-palm hover:text-palm active:scale-95"
              >
                <Printer className="h-4 w-4" />
                <span>Print Test Receipt</span>
              </button>
            </div>
          </div>
        </form>

        {/* Live Thermal Receipt Preview Card */}
        <div className="panel p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-palm/10 text-palm">
                  <Printer className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-palm">Live Preview</p>
                  <h3 className="text-base font-black text-ink">Thermal Receipt ({form.receipt_width})</h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintTestReceipt}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-palm hover:text-palm shadow-xs transition active:scale-95 flex items-center gap-1"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Test Print</span>
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-center bg-slate-100/70 p-4 rounded-2xl overflow-x-auto">
              <div
                className={`bg-white text-black p-4 shadow-md font-mono text-[11px] leading-tight space-y-2 rounded-lg border border-slate-300 transition-all ${
                  form.receipt_width === "80mm" ? "w-72" : "w-56"
                }`}
              >
                <div className="text-center space-y-0.5">
                  <p className="font-bold uppercase text-xs sm:text-sm tracking-wide">
                    {form.name || "YOUR BUSINESS NAME"}
                  </p>
                  {form.slogan && <p className="text-[10px] italic text-slate-600">{form.slogan}</p>}
                  <p className="text-[10px] text-slate-500">
                    {[form.phone, form.location].filter(Boolean).join(" • ") || "Accra, Ghana"}
                  </p>
                  {form.momo_details && (
                    <p className="text-[10px] font-bold border border-dashed border-slate-400 p-1 my-1">
                      MoMo: {form.momo_details}
                    </p>
                  )}
                </div>

                <div className="border-t border-b border-dashed border-slate-400 py-1.5 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>Receipt:</span>
                    <span className="font-bold">REC-2026-0042</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>18/11/2026 14:30</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span>Walk-in</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment:</span>
                    <span className="font-bold">MoMo Pay</span>
                  </div>
                </div>

                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>Sample Product (2x)</span>
                    <span className="font-bold">GH₵ 80.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sample Product (1x)</span>
                    <span className="font-bold">GH₵ 45.00</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-400 pt-1.5 space-y-0.5">
                  <div className="flex justify-between font-bold text-xs">
                    <span>TOTAL:</span>
                    <span>GH₵ 125.00</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Amount Paid:</span>
                    <span>GH₵ 125.00</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-400 pt-2 text-center text-[9px] space-y-1 text-slate-600">
                  {form.return_policy && <p className="italic">{form.return_policy}</p>}
                  <p className="font-bold text-black">
                    {form.receipt_footer || "Thank you for your patronage! Visit again."}
                  </p>
                  <p className="text-[8px] text-slate-400">Powered by BizTrac</p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-400 text-center font-medium">
            ESC/POS direct thermal print layout automatically renders to {form.receipt_width} roll specifications.
          </p>
        </div>
      </section>

      {/* Row 3: Protected Ghana VAT & Tax Security Card */}
      <section id="tax-settings" className="scroll-mt-6">
        <div className="panel p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-amber-500">
          <div className="flex items-start gap-3.5">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 shrink-0">
              <Calculator className="h-6 w-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-ink">
                  Ghana VAT & Tax Configuration
                </h2>
                <Badge variant={form.vat_enabled ? "green" : "slate"}>
                  {form.vat_enabled ? `Active (${((Number(form.vat_rate) || 0) + (Number(form.nhil_rate) || 0) + (Number(form.getfund_rate) || 0)).toFixed(1)}%)` : "Disabled"}
                </Badge>
                <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  <Lock className="h-3 w-3 text-slate-500" />
                  <span>Protected</span>
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                {form.vat_enabled
                  ? `Configured in ${form.tax_pricing_mode === "inclusive" ? "Tax-Inclusive" : "Tax-Exclusive"} mode • TIN: ${form.tin_number || "Not set"}`
                  : "Tax calculations and VAT lines are currently disabled for non-registered retail."}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tax rates, statutory levies, and pricing modes are secured in a dedicated modal to prevent accidental modification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              icon={canManageSettings ? Calculator : Lock}
              type="button"
              disabled={!canManageSettings}
              onClick={() => {
                if (canManageSettings) {
                  setIsTaxModalOpen(true);
                } else {
                  showToast("Access restricted: View only for Store Owner / Manager", { type: "warn" });
                }
              }}
            >
              {canManageSettings ? "Manage VAT & Tax Settings" : "Restricted to Store Owner"}
            </Button>
          </div>
        </div>
      </section>

      {/* Row 4: PWA Card & Sign out */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Progressive Web App</p>
              <h3 className="mt-0.5 text-base font-black text-ink">App Installation & Offline</h3>
            </div>
            <Badge variant={pwaState?.isInstalled ? "green" : "blue"}>
              {pwaState?.isInstalled ? "Installed" : "PWA Active"}
            </Badge>
          </div>
          <p className="text-xs font-medium text-slate-600 leading-relaxed">
            BizTrac is fully PWA-enabled. You can install it on Android, iOS, Windows, or Mac for standalone window execution, offline functionality, and quick launcher access.
          </p>
          {pwaState?.canInstall || pwaState?.isIOS ? (
            <button
              onClick={pwaState.onInstallPwa}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-palm px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-palm/20 transition hover:bg-palmDeep"
            >
              Install BizTrac App
            </button>
          ) : pwaState?.needRefresh ? (
            <button
              onClick={pwaState.onUpdatePwa}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-600/20 transition hover:bg-sky-700"
            >
              Update App Now
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Service worker registered & offline cache active</span>
            </div>
          )}
        </div>

        <div className="panel p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div>
            <p className="label">Account Session</p>
            <h3 className="mt-0.5 text-base font-black text-ink">Sign Out</h3>
            <p className="text-xs font-medium text-slate-500 mt-1">
              End your active session on this device. Offline queued sales will sync once reconnected.
            </p>
          </div>
          <Button icon={LogOut} variant="danger" className="w-full" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </section>

      <p className="text-center text-xs font-semibold text-slate-500">
        Product developed by KwameKaku
      </p>

      <StaffManagement
        business={business}
        currentUser={currentUser}
        permissions={permissions}
        previewRole={previewRole}
        onSetPreviewRole={onSetPreviewRole}
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
      />

      <TaxSettingsModal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        business={{ ...business, ...form }}
        canManageSettings={canManageSettings}
        onSaveTaxSettings={handleSaveTaxSettingsModal}
      />
    </div>
  );
}

export default More;

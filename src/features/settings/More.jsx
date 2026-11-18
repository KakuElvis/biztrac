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
} from "lucide-react";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { formatCurrency } from "../../lib/formatters.js";
import { showToast } from "../../lib/toast.js";

const fallbackBusiness = {
  name: "BizTrac",
  owner: "",
  phone: "",
  email: "",
  location: "",
  logoText: "BT",
};

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
  dashboardSummary,
  onNavigate,
  onSignOut,
  onUpdateBusiness,
  pwaState,
}) {
  const debtors = dashboardSummary?.debtors || [];
  const [form, setForm] = useState(() => toBusinessForm(business));
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

  async function handleSaveProfile(event) {
    if (event?.preventDefault) event.preventDefault();
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
            <Button icon={Store} isLoading={profileSaving} type="submit">
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
              { label: "Invoices", icon: FileText, note: "Drafts, sent, paid" },
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
                      className={`p-3 rounded-2xl border text-left transition active:scale-95 ${form.receipt_width === pw.id
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

              <label>
                <span className="label">Return / Exchange Policy</span>
                <textarea
                  rows={2}
                  className="field mt-2 h-20 resize-none py-2 text-xs"
                  placeholder="e.g. Goods sold in good condition are not returnable after 3 days."
                  value={form.return_policy}
                  onChange={(event) => updateField("return_policy", event.target.value)}
                />
              </label>

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
            <Button icon={Printer} isLoading={receiptSaving} type="submit">
              Save Receipt Settings
            </Button>
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
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-600">
                {form.receipt_width} Roll
              </span>
            </div>

            <div className="mt-4 flex justify-center bg-slate-100/70 p-4 rounded-2xl overflow-x-auto">
              <div
                className={`bg-white text-black p-4 shadow-md font-mono text-[11px] leading-tight space-y-2 rounded-lg border border-slate-300 transition-all ${form.receipt_width === "80mm" ? "w-72" : "w-56"
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

      {/* Row 3: PWA Card & Sign out */}
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
    </div>
  );
}

export default More;
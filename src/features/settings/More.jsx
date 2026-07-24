import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  LogOut,
  MapPin,
  Phone,
  ReceiptText,
  Settings,
  Store,
  UsersRound,
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
}) {
  const debtors = dashboardSummary?.debtors || [];
  const [form, setForm] = useState(() => toBusinessForm(business));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setForm(toBusinessForm(business));
  }, [business]);

  function updateField(field, value) {
    setError("");
    setSuccessMessage("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!form.name.trim()) {
      setError("Business name is required.");
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateBusiness({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        location: form.location.trim(),
      });
      setSuccessMessage("Business profile saved.");
    } catch (saveError) {
      console.error("Unable to save business profile", saveError);
      showToast("Unable to save business profile");
      setError(saveError.message || "Unable to save business profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-bold text-palm">More</p>
        <h1 className="mt-1 text-3xl font-black tracking-normal text-ink">Workspace</h1>
      </section>

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

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form className="panel p-4 sm:p-5" onSubmit={handleSubmit}>
          <p className="label">Business profile</p>
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
            {error ? (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}
            {successMessage ? (
              <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {successMessage}
              </div>
            ) : null}
            <Button icon={Store} isLoading={isSaving}>
              Save profile
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
              { label: "Invoices", icon: FileText, note: "Drafts, sent, paid" },
              { label: "Receipt settings", icon: ReceiptText, note: "Logo, footer, tax note" },
              { label: "Payment accounts", icon: CreditCard, note: "MoMo and bank details" },
              { label: "Low-stock alerts", icon: Bell, note: "Reminder thresholds" },
              { label: "App settings", icon: Settings, note: "Theme and staff access" },
            ].map((item) => (
              <button
                key={item.label}
                className="flex min-h-16 w-full items-center justify-between gap-4 border-b border-slate-100 px-4 text-left last:border-b-0 hover:bg-slate-50"
                onClick={() => item.label === "Low-stock alerts" && onNavigate("inventory")}
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

          <Button icon={LogOut} variant="danger" className="w-full" onClick={onSignOut}>
            Sign out
          </Button>

          <p className="text-center text-xs font-semibold text-slate-500">
            Product developed by KwameKaku
          </p>
        </div>
      </section>
    </div>
  );
}

export default More;

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "../../components/common/Button.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { AppLogo } from "../../components/common/AppLogo.jsx";
import { isSupabaseConfigured } from "../../lib/supabase.js";
import {
  sendPasswordReset,
  signIn,
  signUpWithBusiness,
  updatePassword,
} from "../../services/authService.js";

export function AuthScreen({ onDemo }) {
  const [mode, setMode] = useState("register");

  return (
    <main className="screen-pad grid min-h-screen place-items-center py-6">
      <section className="grid w-full max-w-6xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-soft lg:grid-cols-[0.85fr_1.15fr]">
        <div className="bg-ink p-6 text-white sm:p-8">
          <AppLogo
            containerClassName=""
            imageClassName="h-20 w-20  bg-white rounded-2xl object-cover ring-2 ring-white/20 sm:h-16 sm:w-16"
            titleClassName="text-2xl font-black text-white"
            subtitleClassName="text-sm text-white/65"
            subtitle="Manage Today. Grow Tomorrow."
          />

          <div className="mt-10 space-y-5">
            {/* <Badge variant="amber" className="ring-0">
              Retail and boutique MVP
            </Badge> */}
            <h1 className="max-w-md text-3xl font-black leading-tight sm:text-4xl">
              Run sales, stock, expenses, and reports from one pocket-sized system.
            </h1>
            <p className="max-w-md text-sm leading-6 text-white/70">
              Built for quick counter sales, fashion stock variants, WhatsApp receipts,
              debtor follow-up, and daily owner reporting.
            </p>
          </div>

          <div className="mt-10 grid gap-3">
            {[
              ["Fast sale recording", "Cash, MoMo, Bank, and Credit"],
              ["Stock by size and colour", "Low stock warnings for key items"],
              ["Simple profit picture", "Sales less costs and expenses"],
            ].map(([title, detail]) => (
              <div key={title} className="flex gap-3 rounded-2xl bg-white/8 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-gold" />
                <div>
                  <p className="text-sm font-bold">{title}</p>
                  <p className="text-xs text-white/60">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs font-semibold text-white/60">
            Product developed by KwameKaku
          </p>
        </div>

        <div className="p-5 sm:p-8">
          <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            {["register", "login"].map((item) => (
              <button
                key={item}
                type="button"
                className={`h-11 rounded-xl text-sm font-black capitalize transition ${
                  mode === item ? "bg-white text-palm shadow-sm" : "text-slate-500"
                }`}
                onClick={() => setMode(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {mode === "register" ? (
            <RegisterForm onDemo={onDemo} />
          ) : (
            <LoginForm onDemo={onDemo} />
          )}
        </div>
      </section>
    </main>
  );
}

export function PasswordRecoveryScreen({ onComplete }) {
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));

    if (values.password !== values.confirmPassword) {
      setNotice({ type: "error", text: "Passwords do not match." });
      return;
    }

    setIsLoading(true);
    setNotice(null);
    try {
      await updatePassword(values.password);
      onComplete();
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="screen-pad grid min-h-screen place-items-center py-6">
      <form
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8"
        onSubmit={handleSubmit}
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-100">
          <img
            src={new URL("../../assets/biztrac symbol.png", import.meta.url).href}
            alt="BizTrac logo"
            className="h-full w-full rounded-[0.85rem] object-cover"
          />
        </div>
        <p className="label mt-6">Account security</p>
        <h1 className="mt-2 text-2xl font-black text-ink">Choose a new password</h1>
        {notice ? <StatusMessage type={notice.type}>{notice.text}</StatusMessage> : null}
        <div className="mt-6 grid gap-4">
          <Field
            icon={LockKeyhole}
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength="8"
            required
          />
          <Field
            icon={LockKeyhole}
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength="8"
            required
          />
        </div>
        <Button className="mt-6 w-full" type="submit" isLoading={isLoading}>
          Update password
        </Button>
      </form>
    </main>
  );
}

function RegisterForm({ onDemo }) {
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setNotice(null);

    const values = Object.fromEntries(new FormData(form));
    if (values.password !== values.confirmPassword) {
      setNotice({ type: "error", text: "Passwords do not match." });
      return;
    }

    setIsLoading(true);
    try {
      const data = await signUpWithBusiness(values);
      if (!data.session) {
        setNotice({
          type: "success",
          text: "Account created. Check your email to confirm your address, then log in.",
        });
        form.reset();
      }
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="mt-7" onSubmit={handleSubmit}>
      <div>
        <p className="label">Business account</p>
        <h2 className="mt-2 text-2xl font-black text-ink">Create your workspace</h2>
      </div>

      {!isSupabaseConfigured ? (
        <StatusMessage type="error">
          Live accounts are unavailable until Supabase environment keys are added.
        </StatusMessage>
      ) : null}
      {notice ? <StatusMessage type={notice.type}>{notice.text}</StatusMessage> : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          icon={Building2}
          label="Business name"
          name="businessName"
          placeholder="Ama Styles Boutique"
          autoComplete="organization"
          required
        />
        <Field
          icon={Phone}
          label="Business phone"
          name="businessPhone"
          placeholder="+233 24 456 7801"
          autoComplete="tel"
          required
        />
        <Field
          icon={Mail}
          label="Business email"
          name="businessEmail"
          placeholder="sales@business.com"
          type="email"
          autoComplete="email"
          required
        />
        <Field
          icon={MapPin}
          label="Location"
          name="location"
          placeholder="Adum, Kumasi"
          autoComplete="street-address"
          required
        />
        <Field
          icon={UserRound}
          label="Owner name"
          name="ownerName"
          placeholder="Ama Serwaa"
          autoComplete="name"
          required
        />
        <Field
          icon={Mail}
          label="Owner email"
          name="ownerEmail"
          placeholder="owner@email.com"
          type="email"
          autoComplete="username"
          required
        />
        <Field
          icon={LockKeyhole}
          label="Password"
          name="password"
          placeholder="At least 8 characters"
          type="password"
          autoComplete="new-password"
          minLength="8"
          required
        />
        <Field
          icon={LockKeyhole}
          label="Confirm password"
          name="confirmPassword"
          placeholder="Repeat password"
          type="password"
          autoComplete="new-password"
          minLength="8"
          required
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Button
          type="submit"
          icon={ArrowRight}
          isLoading={isLoading}
          disabled={!isSupabaseConfigured}
        >
          Create workspace
        </Button>
        <Button type="button" variant="secondary" onClick={onDemo}>
          Use demo shop
        </Button>
      </div>
    </form>
  );
}

function LoginForm({ onDemo }) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));

    setIsLoading(true);
    try {
      await signIn(values);
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReset() {
    if (!email) {
      setNotice({ type: "error", text: "Enter your email address first." });
      return;
    }

    setIsLoading(true);
    setNotice(null);
    try {
      await sendPasswordReset(email);
      setNotice({ type: "success", text: "Password reset email sent." });
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="mt-7" onSubmit={handleSubmit}>
      <p className="label">Welcome back</p>
      <h2 className="mt-2 text-2xl font-black text-ink">Open your business dashboard</h2>

      {!isSupabaseConfigured ? (
        <StatusMessage type="error">
          Live accounts are unavailable until Supabase environment keys are added.
        </StatusMessage>
      ) : null}
      {notice ? <StatusMessage type={notice.type}>{notice.text}</StatusMessage> : null}

      <div className="mt-6 grid gap-4">
        <Field
          icon={Mail}
          label="Email"
          name="email"
          placeholder="owner@email.com"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Field
          icon={LockKeyhole}
          label="Password"
          name="password"
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          className="text-sm font-bold text-palm"
          disabled={isLoading || !isSupabaseConfigured}
          onClick={handleReset}
        >
          Reset password
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Button
          type="submit"
          className="w-full"
          icon={ArrowRight}
          isLoading={isLoading}
          disabled={!isSupabaseConfigured}
        >
          Login
        </Button>
        <Button type="button" variant="secondary" onClick={onDemo}>
          Use demo shop
        </Button>
      </div>
    </form>
  );
}

function StatusMessage({ children, type }) {
  const Icon = type === "success" ? CheckCircle2 : AlertCircle;
  const styles =
    type === "success"
      ? "border-success/20 bg-success/10 text-success"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`mt-5 flex items-start gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Field({ icon: Icon, label, ...props }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="relative mt-2 block">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className="field pl-10" {...props} />
      </span>
    </label>
  );
}

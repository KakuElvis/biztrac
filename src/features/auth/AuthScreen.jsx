import { useState, useEffect } from "react";
import { useBackButtonModal } from "../../hooks/useBackButtonModal.js";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  WifiOff,
  X,
  Zap,
  ShoppingCart,
  Crown,
  KeyRound,
} from "lucide-react";
import { Button } from "../../components/common/Button.jsx";
import { AppLogo } from "../../components/common/AppLogo.jsx";
import { isSupabaseConfigured } from "../../lib/supabase.js";
import {
  sendPasswordReset,
  signIn,
  signInWithStaffId,
  signUpWithBusiness,
  updatePassword,
} from "../../services/authService.js";

export function AuthScreen({ onSwitchToAdmin }) {
  const [mode, setMode] = useState("login");

  return (
    <main className="min-h-[100dvh] flex flex-col justify-center px-4 py-4 sm:px-6 sm:py-8 bg-white">
      <section className="mx-auto w-full max-w-md sm:max-w-xl lg:max-w-5xl overflow-hidden rounded-3xl lg:rounded-[2rem] border border-slate-200/90 bg-white shadow-soft lg:grid lg:grid-cols-[0.88fr_1.12fr]">
        {/* Left Branding Showcase Panel - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[#021940] via-palmDeep to-[#032d6f] p-8 lg:p-10 text-white flex-col justify-between">
          {/* Subtle Ambient Background Gradients */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-palm/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gold/15 blur-3xl" />

          <div className="relative z-10">
            <AppLogo
              containerClassName=""
              imageClassName="h-16 w-16 bg-white rounded-2xl object-cover ring-4 ring-white/10 shadow-lg sm:h-14 sm:w-14"
              titleClassName="text-2xl font-black text-white tracking-normal"
              subtitleClassName="text-xs font-semibold text-skyglass/80"
              subtitle="Manage Today. Grow Tomorrow."
            />

            <div className="mt-8 space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-bold text-gold backdrop-blur-xs">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Modern POS & Business Management for SMEs</span>
              </div>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl text-white">
                Sales, stock, expenses, and receipts from one fast counter system.
              </h1>
              <p className="text-xs sm:text-sm leading-relaxed text-white/75">
                Built specifically for Ghanaian SMEs and growing businesses. Ring up MoMo & Cash sales, print thermal receipts, follow up debtors on WhatsApp, and view real-time profits.
              </p>
            </div>

            <div className="mt-8 grid gap-2.5">
              {[
                {
                  icon: Zap,
                  title: "Rapid Counter Checkout",
                  desc: "Cash, MoMo, Bank Transfer, and Credit with change calculator",
                },
                {
                  icon: Building2,
                  title: "Inventory & Variants",
                  desc: "Product variants, low stock warning alerts, and restock auditing",
                },
                {
                  icon: WifiOff,
                  title: "Offline Sync Engine",
                  desc: "Keep selling when network drops; auto-syncs upon reconnecting",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-2xl bg-white/7 border border-white/10 p-3.5 backdrop-blur-xs transition hover:bg-white/10"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-black text-white">{item.title}</p>
                    <p className="text-[11px] text-white/65 mt-0.5 leading-snug">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-[11px] font-semibold text-white/60">
            <span>Powered by BizTrac</span>
            <span>Product developed by KwameKaku</span>
          </div>
        </div>

        {/* Right Auth Forms Panel */}
        <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-between">
          <div>
            {/* Mobile Brand Header for Easy Identification & Immediate Access */}
            <div className="lg:hidden flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
              <AppLogo
                imageClassName="h-10 w-10 bg-white rounded-xl object-contain ring-2 ring-palm/15 shadow-xs"
                titleClassName="text-base font-black text-ink leading-tight"
                subtitleClassName="text-[11px] font-semibold text-slate-500"
                subtitle="POS & Counter Terminal"
              />
              <span className="inline-flex items-center gap-1 rounded-full bg-palm/10 px-2.5 py-1 text-[11px] font-bold text-palm border border-palm/20">
                <ShieldCheck className="h-3.5 w-3.5 text-palm" />
                <span>Secure</span>
              </span>
            </div>

            {/* Segmented Mode Switcher */}
            <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1.5 shadow-xs">
              <button
                type="button"
                className={`flex items-center justify-center gap-1.5 sm:gap-2 h-11 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  mode === "login"
                    ? "bg-white text-palm shadow-sm scale-[1.01]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => setMode("login")}
              >
                <UserRound className="h-4 w-4 shrink-0" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                className={`flex items-center justify-center gap-1.5 sm:gap-2 h-11 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  mode === "register"
                    ? "bg-white text-palm shadow-sm scale-[1.01]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => setMode("register")}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span>Register Business</span>
              </button>
            </div>

            {mode === "register" ? (
              <RegisterForm
                onSuccess={() => setMode("login")}
                onSwitchToLogin={() => setMode("login")}
              />
            ) : (
              <LoginForm onSwitchToRegister={() => setMode("register")} />
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-400">
            <span>BizTrac POS &copy; {new Date().getFullYear()}</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Encrypted</span>
            </span>
          </div>

          {onSwitchToAdmin && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="text-[11px] font-bold text-slate-400 hover:text-purple-600 transition inline-flex items-center gap-1.5"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
                <span>Super Administrator Portal &rarr;</span>
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export function PasswordRecoveryScreen({ onComplete }) {
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));

    if (values.password !== values.confirmPassword) {
      setNotice({ type: "error", text: "Passwords do not match." });
      return;
    }

    if (values.password.length < 8) {
      setNotice({ type: "error", text: "Password must be at least 8 characters long." });
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
    <main className="screen-pad grid min-h-screen place-items-center py-6 bg-white">
      <form
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8"
        onSubmit={handleSubmit}
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-palm/10 text-palm p-2">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <p className="label mt-4 text-palm font-bold">Account Security</p>
        <h1 className="mt-1 text-2xl font-black text-ink">Choose a new password</h1>
        <p className="text-xs text-slate-500 mt-1">Enter your new secure password of at least 8 characters.</p>

        {notice ? <StatusMessage type={notice.type}>{notice.text}</StatusMessage> : null}

        <div className="mt-6 grid gap-4">
          <PasswordField
            label="New password"
            name="password"
            placeholder="At least 8 characters"
            showPassword={showPassword}
            onToggleShow={() => setShowPassword((s) => !s)}
            minLength="8"
            required
          />
          <PasswordField
            label="Confirm new password"
            name="confirmPassword"
            placeholder="Re-enter password"
            showPassword={showPassword}
            onToggleShow={() => setShowPassword((s) => !s)}
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

function RegisterForm({ onSuccess, onSwitchToLogin }) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Step 1: Business Profile Fields
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [location, setLocation] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");

  // Step 2: Owner Credentials Fields
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const hasMinLength = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Intercept Android Back Button on Step 2 to return to Step 1 smoothly
  useBackButtonModal(step === 2, () => setStep(1), "register-step-2");

  // Intercept Android Back Button while success modal is visible
  useBackButtonModal(showSuccessModal, () => setShowSuccessModal(false), "auth-register-success");

  useEffect(() => {
    if (!showSuccessModal) return undefined;
    const t = setTimeout(() => {
      setShowSuccessModal(false);
      if (onSuccess) onSuccess();
    }, 2500);
    return () => clearTimeout(t);
  }, [showSuccessModal, onSuccess]);

  function handleNext(e) {
    e.preventDefault();
    setNotice(null);

    if (!businessName.trim()) {
      setNotice({ type: "error", text: "Please enter your business or trading name." });
      return;
    }
    if (!businessPhone.trim()) {
      setNotice({ type: "error", text: "Please enter your business contact phone number." });
      return;
    }
    if (!location.trim()) {
      setNotice({ type: "error", text: "Please enter your shop or market location." });
      return;
    }

    // Default owner email to business email if provided and owner email is empty
    if (businessEmail.trim() && !ownerEmail.trim()) {
      setOwnerEmail(businessEmail.trim());
    }

    setStep(2);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);

    if (password !== confirmPassword) {
      setNotice({ type: "error", text: "Passwords do not match." });
      return;
    }

    if (password.length < 8) {
      setNotice({ type: "error", text: "Password must be at least 8 characters long." });
      return;
    }

    setIsLoading(true);
    try {
      const data = await signUpWithBusiness({
        businessName: businessName.trim(),
        businessPhone: businessPhone.trim(),
        businessEmail: businessEmail.trim() || ownerEmail.trim(),
        location: location.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        password,
      });

      if (!data.session) {
        setNotice({
          type: "success",
          text: "Account created successfully! Check your email to confirm your address, then sign in.",
        });
        setShowSuccessModal(true);
      }
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="mt-5 space-y-4">
        {/* Step Progress Bar & Indicator */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-palm uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-palm text-[10px] text-white font-black">
                {step}
              </span>
              <span>Step {step} of 2: {step === 1 ? "Business Profile" : "Owner Login"}</span>
            </span>
            <span className="font-bold text-slate-400 text-[11px]">
              {step === 1 ? "50%" : "100%"}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-palm to-blue-600 transition-all duration-300"
              style={{ width: step === 1 ? "50%" : "100%" }}
            />
          </div>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-black text-ink">
            {step === 1 ? "Register your business" : "Create owner login"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {step === 1
              ? "Enter your business details to setup your counter terminal."
              : "Set up your secure credentials to manage sales, stock, and profits."}
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <StatusMessage type="error">
            Live accounts are unavailable until Supabase environment keys are added to .env.
          </StatusMessage>
        ) : null}
        {notice && notice.type !== "success" ? (
          <StatusMessage type={notice.type}>{notice.text}</StatusMessage>
        ) : null}

        {/* STEP 1: BUSINESS PROFILE */}
        {step === 1 && (
          <form className="space-y-3.5" onSubmit={handleNext}>
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3.5 sm:p-4 space-y-3">
              <Field
                icon={Building2}
                label="Business / Trading Name"
                name="businessName"
                placeholder="e.g. K. Mensah Enterprises"
                autoComplete="organization"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                autoFocus
                required
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  icon={Phone}
                  label="Business Phone"
                  name="businessPhone"
                  placeholder="024 456 7801"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  required
                />
                <Field
                  icon={MapPin}
                  label="Location / Town"
                  name="location"
                  placeholder="e.g. Makola, Accra"
                  autoComplete="street-address"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>

              <Field
                icon={Mail}
                label="Business Email (Optional)"
                name="businessEmail"
                placeholder="sales@business.com"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
              />
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                className="w-full h-12 text-sm font-black shadow-lg shadow-palm/20"
                icon={ArrowRight}
                disabled={!isSupabaseConfigured}
              >
                Continue to Owner Account
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: OWNER CREDENTIALS */}
        {step === 2 && (
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            {/* Business summary chip with edit shortcut */}
            <div className="flex items-center justify-between rounded-xl bg-palm/5 border border-palm/20 px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-palm text-white font-black text-[10px]">
                  ✓
                </span>
                <span className="truncate font-bold text-ink">
                  {businessName} • {location}
                </span>
              </div>
              <button
                type="button"
                className="shrink-0 text-[11px] font-black text-palm hover:underline ml-2"
                onClick={() => setStep(1)}
              >
                Edit
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3.5 sm:p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  icon={UserRound}
                  label="Owner Full Name"
                  name="ownerName"
                  placeholder="e.g. Kwabena Mensah"
                  autoComplete="name"
                  autoCapitalize="words"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  autoFocus
                  required
                />
                <Field
                  icon={Mail}
                  label="Owner Login Email"
                  name="ownerEmail"
                  placeholder="owner@email.com"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PasswordField
                  label="Create Password"
                  name="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  showPassword={showPassword}
                  onToggleShow={() => setShowPassword((s) => !s)}
                  minLength="8"
                  autoComplete="new-password"
                  required
                />
                <PasswordField
                  label="Confirm Password"
                  name="confirmPassword"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  showPassword={showPassword}
                  onToggleShow={() => setShowPassword((s) => !s)}
                  minLength="8"
                  autoComplete="new-password"
                  required
                />
              </div>

              {/* Real-time Password Strength & Match Checklist */}
              {password.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold pt-0.5">
                  <span
                    className={`flex items-center gap-1 transition ${
                      hasMinLength ? "text-emerald-700" : "text-slate-400"
                    }`}
                  >
                    <Check className={`h-3.5 w-3.5 ${hasMinLength ? "text-emerald-600" : "text-slate-300"}`} />
                    <span>8+ characters</span>
                  </span>
                  {confirmPassword.length > 0 && (
                    <span
                      className={`flex items-center gap-1 transition ${
                        passwordsMatch ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      <Check className={`h-3.5 w-3.5 ${passwordsMatch ? "text-emerald-600" : "text-amber-500"}`} />
                      <span>{passwordsMatch ? "Passwords match" : "Passwords do not match"}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="h-12 px-4 rounded-xl font-bold"
                onClick={() => setStep(1)}
                icon={ArrowLeft}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 h-12 rounded-xl text-sm font-black shadow-lg shadow-palm/20"
                icon={ArrowRight}
                isLoading={isLoading}
                disabled={!isSupabaseConfigured}
              >
                Create Workspace
              </Button>
            </div>
          </form>
        )}

        <div className="text-center pt-1">
          <p className="text-xs font-semibold text-slate-500">
            Already have a BizTrac account?{" "}
            <button
              type="button"
              className="font-black text-palm hover:underline"
              onClick={onSwitchToLogin}
            >
              Sign In here
            </button>
          </p>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="mx-4 max-w-md w-full rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-lg font-black text-ink">Account Created!</h3>
                <p className="mt-1 text-xs font-medium text-slate-600 leading-relaxed">
                  We have registered your business. Please check your email to verify your address, then sign in to start selling.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                className="w-full sm:w-auto h-11"
                onClick={() => {
                  setShowSuccessModal(false);
                  if (onSuccess) onSuccess();
                }}
              >
                Go to Sign In
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function LoginForm({ onSwitchToRegister }) {
  const [loginType, setLoginType] = useState(() => {
    try {
      return localStorage.getItem("biztrac_last_login_type") || "staff";
    } catch {
      return "staff";
    }
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffId, setStaffId] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  // Intercept Android Back Button while password reset modal is visible
  useBackButtonModal(showResetModal, () => setShowResetModal(false), "auth-reset-password");

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);
    setIsLoading(true);

    try {
      if (loginType === "staff") {
        await signInWithStaffId({
          staffId: staffId.trim(),
          password: staffPassword,
        });
      } else {
        await signIn({ email: email.trim(), password });
      }
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Failed to sign in. Please verify your credentials.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetSubmit(event) {
    event.preventDefault();
    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      setNotice({ type: "error", text: "Enter your email address to receive password reset instructions." });
      return;
    }

    setIsResetting(true);
    try {
      await sendPasswordReset(targetEmail);
      setShowResetModal(false);
      setNotice({
        type: "success",
        text: `Password reset link sent to ${targetEmail}. Check your inbox.`,
      });
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Unable to send password reset email." });
    } finally {
      setIsResetting(false);
    }
  }

  const handleSelectLoginType = (type) => {
    setLoginType(type);
    setNotice(null);
    try {
      localStorage.setItem("biztrac_last_login_type", type);
    } catch {
      // Ignore error
    }
  };

  return (
    <>
      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-palm/10 px-2.5 py-0.5 text-[11px] font-bold text-palm mb-1">
            <Sparkles className="h-3 w-3" />
            <span>Counter Terminal</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-ink">
            {loginType === "staff" ? "Staff & Cashier Sign In" : "Store Owner Sign In"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {loginType === "staff"
              ? "Sign in with your assigned Staff ID and password to ring up sales and print receipts."
              : "Access your owner dashboard, inventory restocks, and business financial reports."}
          </p>
        </div>

        {/* Staff ID vs Owner Email Switcher */}
        <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => handleSelectLoginType("staff")}
            className={`flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-black transition-all ${
              loginType === "staff"
                ? "bg-white text-emerald-800 shadow-sm scale-[1.01]"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
            <span>Staff / Cashier</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectLoginType("owner")}
            className={`flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-black transition-all ${
              loginType === "owner"
                ? "bg-white text-palm shadow-sm scale-[1.01]"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Crown className="h-3.5 w-3.5 text-palm" />
            <span>Store Owner</span>
          </button>
        </div>

        {loginType === "owner" && !isSupabaseConfigured ? (
          <StatusMessage type="error">
            Live accounts are unavailable until Supabase environment keys are added to .env.
          </StatusMessage>
        ) : null}
        {notice ? <StatusMessage type={notice.type}>{notice.text}</StatusMessage> : null}

        {loginType === "staff" ? (
          <div className="space-y-3.5">
            <div>
              <Field
                icon={UserRound}
                label="Staff ID"
                name="staffId"
                placeholder="e.g. AF190"
                type="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="username"
                value={staffId}
                onChange={(event) => setStaffId(event.target.value.toUpperCase())}
                autoFocus
                required
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Alphanumeric format (2 letters + 3 numbers). Case-insensitive.
              </p>
            </div>

            <PasswordField
              label="Staff Password"
              name="staffPassword"
              placeholder="Enter your staff password"
              value={staffPassword}
              onChange={(event) => setStaffPassword(event.target.value)}
              showPassword={showPassword}
              onToggleShow={() => setShowPassword((s) => !s)}
              autoComplete="current-password"
              required
            />
          </div>
        ) : (
          <div className="space-y-3.5">
            <Field
              icon={Mail}
              label="Email Address"
              name="email"
              placeholder="owner@business.com"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
              required
            />

            <PasswordField
              label="Password"
              name="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              showPassword={showPassword}
              onToggleShow={() => setShowPassword((s) => !s)}
              autoComplete="current-password"
              required
            />
          </div>
        )}

        <div className="flex items-center justify-between text-xs pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none py-1">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-palm focus:ring-palm" />
            <span className="font-semibold text-xs">Remember this device</span>
          </label>
          {loginType === "owner" ? (
            <button
              type="button"
              className="font-bold text-palm hover:text-palmDeep transition py-1 text-xs"
              disabled={isLoading || !isSupabaseConfigured}
              onClick={() => {
                setResetEmail(email);
                setShowResetModal(true);
              }}
            >
              Forgot password?
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">
              Offline counter enabled
            </span>
          )}
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            className="w-full h-12 text-sm font-black shadow-lg shadow-palm/20"
            icon={ArrowRight}
            isLoading={isLoading}
            disabled={loginType === "owner" && !isSupabaseConfigured}
          >
            {loginType === "staff" ? "Sign In as Staff" : "Sign In to Terminal"}
          </Button>
        </div>

        <div className="text-center pt-1">
          <p className="text-xs font-semibold text-slate-500">
            Don&apos;t have a business account?{" "}
            <button
              type="button"
              className="font-black text-palm hover:underline"
              onClick={onSwitchToRegister}
            >
              Register here
            </button>
          </p>
        </div>
      </form>

      {/* Forgot Password Modal / Mobile Bottom Sheet */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4 backdrop-blur-xs">
          <form
            className="w-full max-w-md space-y-4 rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200"
            onSubmit={handleResetSubmit}
          >
            {/* Mobile drag handle */}
            <div className="mx-auto h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-palm/10 text-palm">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-palm">Password Recovery</p>
                  <h3 className="text-lg font-black text-ink">Reset Your Password</h3>
                </div>
              </div>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                onClick={() => setShowResetModal(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your registered owner email address. We will send you a secure link to create a new password.
            </p>

            <Field
              icon={Mail}
              label="Email Address"
              name="resetEmail"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="owner@business.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              autoFocus
              required
            />

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100"
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </button>
              <Button type="submit" className="flex-1 h-12 font-bold" isLoading={isResetting}>
                Send Reset Link
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function StatusMessage({ children, type }) {
  const Icon = type === "success" ? CheckCircle2 : AlertCircle;
  const styles =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-xs font-semibold ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

function Field({ icon: Icon, label, className = "", inputClassName = "", ...props }) {
  return (
    <label className="group block">
      {label && <span className="label text-slate-600 block mb-1 text-[11px] font-bold uppercase tracking-wider">{label}</span>}
      <span className="relative block">
        {Icon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 transition-colors group-focus-within:text-palm">
            <Icon className="h-4.5 w-4.5" />
          </span>
        ) : null}
        <input
          className={`h-12 w-full rounded-xl border border-slate-200 bg-white ${
            Icon ? "pl-11" : "pl-3.5"
          } pr-3.5 text-base sm:text-sm font-semibold text-ink placeholder:font-normal placeholder:text-slate-400 outline-none transition hover:border-slate-300 focus:border-palm focus:ring-4 focus:ring-palm/10 active:border-palm ${inputClassName} ${className}`}
          {...props}
        />
      </span>
    </label>
  );
}

function PasswordField({
  label,
  showPassword,
  onToggleShow,
  className = "",
  inputClassName = "",
  ...props
}) {
  return (
    <label className="group block">
      {label && <span className="label text-slate-600 block mb-1 text-[11px] font-bold uppercase tracking-wider">{label}</span>}
      <span className="relative block">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 transition-colors group-focus-within:text-palm">
          <LockKeyhole className="h-4.5 w-4.5" />
        </span>
        <input
          type={showPassword ? "text" : "password"}
          className={`h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-base sm:text-sm font-semibold text-ink placeholder:font-normal placeholder:text-slate-400 outline-none transition hover:border-slate-300 focus:border-palm focus:ring-4 focus:ring-palm/10 active:border-palm ${inputClassName} ${className}`}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center pr-2 text-slate-400 hover:text-slate-700 transition focus:outline-none"
          onClick={onToggleShow}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100 transition-colors">
            {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
          </span>
        </button>
      </span>
    </label>
  );
}


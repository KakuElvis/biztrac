import { useState } from "react";
import {
  ShieldAlert,
  Lock,
  LockKeyhole,
  Mail,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { signIn, sendPasswordReset, signOut } from "../../services/authService.js";
import { checkIsSuperAdmin } from "../../services/adminService.js";
import { showToast } from "../../lib/toast.js";

export function AdminLoginScreen({ onSwitchToMerchant, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMessage("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage("Please enter both your admin email and password.");
      return;
    }

    try {
      setIsLoading(true);

      // 1. Authenticate with Supabase credentials
      await signIn({ email: cleanEmail, password });

      // 2. Immediately verify Super Admin authorization
      const isSuper = await checkIsSuperAdmin();
      if (!isSuper) {
        // Destroy session immediately if account is not whitelisted
        await signOut();
        throw new Error(
          "Access Denied: This account is not registered on the platform super-admin whitelist."
        );
      }

      showToast("Authenticated as Platform Super Admin", { type: "success" });
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      console.error("[AdminLogin] Authentication failure:", err);
      setErrorMessage(
        err.message || "Failed to authenticate. Please verify your administrator credentials."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordReset(e) {
    e.preventDefault();
    setErrorMessage("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage("Please enter your registered admin email address.");
      return;
    }

    try {
      setIsLoading(true);
      await sendPasswordReset(cleanEmail);
      setResetSent(true);
      showToast(`Password recovery instructions sent to ${cleanEmail}`, { type: "info" });
    } catch (err) {
      console.error("[AdminLogin] Password reset error:", err);
      setErrorMessage(err.message || "Failed to send password recovery email.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 relative overflow-hidden">
      {/* Subtle Ambient Glow Effects */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-purple-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#33415510_1px,transparent_1px),linear-gradient(to_bottom,#33415510_1px,transparent_1px)] bg-[size:3.5rem_3.5rem]" />

      <section className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* Header Emblem */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-600 grid place-items-center text-white shadow-lg shadow-purple-600/30 mb-4 ring-4 ring-purple-500/20">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            BizTrac Operations
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Super Administrator Control Portal
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-950/80 border border-purple-800/80 text-purple-300">
            <Lock className="h-3 w-3 text-purple-400" />
            <span>Strict Access &bull; Whitelist Only</span>
          </div>
        </div>

        {/* Error Notification Banner */}
        {errorMessage ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl bg-rose-950/60 border border-rose-800/80 p-3.5 text-xs text-rose-200 animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{errorMessage}</div>
          </div>
        ) : null}

        {/* Password Reset Success Banner */}
        {resetSent && isResetMode ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 p-3.5 text-xs text-emerald-200 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">
              Recovery instructions have been transmitted. Check your administrator email inbox to reset your password.
            </div>
          </div>
        ) : null}

        {!isResetMode ? (
          /* STANDARD ADMIN LOGIN FORM */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Super Admin Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@biztrac.app"
                  required
                  autoFocus
                  autoComplete="username email"
                  className="w-full h-12 bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 text-sm font-semibold text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-[11px] font-black uppercase tracking-wider text-slate-400"
                >
                  Admin Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(true);
                    setErrorMessage("");
                  }}
                  className="text-[11px] font-bold text-purple-400 hover:text-purple-300 transition"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <LockKeyhole className="h-4 w-4" />
                </span>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-12 bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-11 text-sm font-semibold text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.99] transition font-black text-xs uppercase tracking-wider text-white shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Super Admin</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* PASSWORD RESET FORM */
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label
                htmlFor="reset-email"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Registered Admin Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@biztrac.app"
                  required
                  autoFocus
                  className="w-full h-12 bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 text-sm font-semibold text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-[0.99] transition font-black text-xs uppercase tracking-wider text-white shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending Instructions...</span>
                </>
              ) : (
                <>
                  <span>Send Recovery Email</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsResetMode(false);
                setErrorMessage("");
                setResetSent(false);
              }}
              className="w-full text-center text-xs font-bold text-slate-400 hover:text-white transition pt-2"
            >
              Back to Super Admin Sign In
            </button>
          </form>
        )}

        {/* Security Audit Log Disclaimer */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
            Session logins, tenant modifications, and plan overrides are cryptographically logged to the immutable platform audit ledger.
          </p>
        </div>

        {/* Switch to Merchant Counter Terminal */}
        {onSwitchToMerchant ? (
          <div className="mt-4 pt-3 text-center">
            <button
              type="button"
              onClick={onSwitchToMerchant}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
              <span>Looking for store counter? Go to Store Login</span>
            </button>
          </div>
        ) : null}
      </section>

      {/* Footer copyright */}
      <footer className="mt-8 text-center text-xs text-slate-600 font-medium">
        BizTrac Platform Infrastructure &copy; {new Date().getFullYear()}
      </footer>
    </main>
  );
}

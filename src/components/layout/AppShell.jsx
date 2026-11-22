import { useState, useEffect } from "react";
import {
  Crown,
  Sparkles,
  BarChart3,
  Boxes,
  Home,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  UsersRound,
  WalletCards,
  Smartphone,
  Eye,
  EyeOff,
  Lock,
  FileText,
  AlertTriangle,
  RefreshCw,
  Trash2,
  X,
  Settings,
} from "lucide-react";
import { AppLogo } from "../../components/common/AppLogo.jsx";
import { classNames, formatCurrency } from "../../lib/formatters.js";
import { PwaBanner, PwaInstallButton } from "../pwa/PwaBanner.jsx";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "sales", label: "Sales", icon: ShoppingCart },
  { id: "inventory", label: "Stock", icon: Boxes },
  { id: "customers", label: "Customers", icon: UsersRound },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "more", label: "More", icon: Menu },
];

const mobileNavItems = navItems.filter((item) => item.id !== "reports");

export function AppShell({
  children,
  activeScreen,
  business,
  isOnline,
  onNavigate,
  lowStockCount,
  onSignOut,
  queuedCount = 0,
  conflictedCount = 0,
  conflictedSales = [],
  onDismissConflicted,
  onRetryConflicted,
  onDismissSingleConflicted,
  isSyncing = false,
  onTriggerSync,
  pwaState = {},
  permissions,
  onSetPreviewRole,
  plan,
  onOpenUpgradeModal,
}) {
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isMobileDrawerOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsMobileDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isMobileDrawerOpen]);
  const { canInstall, isInstalled, isIOS, needRefresh, onInstallPwa, onUpdatePwa } = pwaState;
  const isCashier = Boolean(permissions?.isCashier);

  const visibleNavItems = isCashier
    ? navItems.filter((item) => !["inventory", "reports", "more"].includes(item.id))
    : navItems;

  const visibleMobileNavItems = isCashier
    ? navItems.filter((item) => !["inventory", "reports", "expenses", "more"].includes(item.id))
    : mobileNavItems;

  const drawerNavItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "sales", label: "Sales & POS", icon: ShoppingCart },
    ...(!isCashier ? [{ id: "inventory", label: "Stock / Inventory", icon: Boxes }] : []),
    { id: "customers", label: "Customers", icon: UsersRound },
    ...(!isCashier ? [{ id: "invoices", label: "Invoices & Quotes", icon: FileText }] : []),
    ...(!isCashier ? [{ id: "expenses", label: "Expenses", icon: WalletCards }] : []),
    ...(!isCashier ? [{ id: "reports", label: "Reports & Analytics", icon: BarChart3 }] : []),
    ...(!isCashier ? [{ id: "more", label: "Settings & Store Profile", icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl lg:grid lg:grid-cols-[18rem_1fr]">
        <aside className="sticky top-0 z-10 hidden h-screen border-r border-slate-200 bg-white p-5 shadow-[2px_0_8px_rgba(2,40,100,0.06)] lg:flex lg:flex-col">
          <Brand />
          <nav className="mt-8 space-y-2">
            {visibleNavItems.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={activeScreen === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}
            {!isCashier && (
              <NavButton
                item={{ id: "invoices", label: "Invoices & Quotes", icon: FileText }}
                active={activeScreen === "invoices"}
                onClick={() => onNavigate("invoices")}
                badge={!plan?.isPro ? (
                  <span className="rounded-md bg-amber-500/15 text-amber-700 px-1.5 py-0.5 text-[10px] font-black uppercase">
                    PRO
                  </span>
                ) : null}
              />
            )}
            {!isCashier && (
              <NavButton
                item={{ id: "expenses", label: "Expenses", icon: WalletCards }}
                active={activeScreen === "expenses"}
                onClick={() => onNavigate("expenses")}
              />
            )}
          </nav>
          
          {(canInstall || isIOS) && !isInstalled ? (
            <div className="mt-4 rounded-xl border border-palm/30 bg-skyglass p-3 text-center">
              <p className="text-xs font-black text-ink mb-2 flex items-center justify-center gap-1.5">
                <Smartphone className="h-4 w-4 text-palm" />
                <span>Get Desktop / Mobile App</span>
              </p>
              <PwaInstallButton
                canInstall={canInstall}
                isInstalled={isInstalled}
                isIOS={isIOS}
                onInstall={onInstallPwa}
                className="w-full justify-center"
              />
            </div>
          ) : null}

          <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[0.7rem] font-bold uppercase tracking-normal text-slate-500">
              Product developed by
            </p>
            <p className="mt-1 text-sm font-black text-ink">KwameKaku</p>
          </div>
          <button
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white transition hover:bg-palmDeep"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        <main className="w-full">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
            {/* Mobile Header: BizPurse Logo on left, Hamburger Menu on right (matches reference mockup) */}
            <div className="screen-pad mx-auto flex h-16 max-w-5xl items-center justify-between lg:hidden">
              <button
                type="button"
                onClick={() => onNavigate("dashboard")}
                className="flex items-center text-left focus:outline-none focus:ring-2 focus:ring-palm/20 rounded-xl transition active:scale-98"
                aria-label="BizPurse home"
              >
                <AppLogo
                  imageClassName="h-9 w-9 rounded-xl border-2 border-ink/50 object-contain shadow-xs"
                  titleClassName="text-xl font-black text-slate-900 tracking-tight"
                  subtitle={null}
                />
              </button>
              <div className="flex items-center gap-2">
                {plan?.isPro ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-xs">
                    <Crown className="h-3 w-3" /> PRO
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenUpgradeModal}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 active:scale-95"
                  >
                    <Sparkles className="h-3 w-3 text-amber-600" /> Pro
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(true)}
                  className="grid h-11 w-11 place-items-center rounded-xl text-slate-900 transition hover:bg-slate-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-palm/20"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-6 w-6" strokeWidth={2.4} />
                </button>
              </div>
            </div>

            {/* Desktop Header */}
            <div className="screen-pad mx-auto hidden h-20 max-w-5xl items-center justify-between gap-3 lg:flex">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-palm text-sm font-black text-white">
                  {business.logoText}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-ink">{business.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-xs font-medium text-slate-500">{business.location}</p>
                    {plan?.isPro ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs">
                        <Crown className="h-3 w-3" /> PRO
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenUpgradeModal}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800 transition hover:bg-amber-100 hover:border-amber-400 active:scale-95"
                      >
                        <Sparkles className="h-3 w-3 text-amber-600" /> Upgrade
                      </button>
                    )}
                    {permissions?.roleMeta && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${permissions.roleMeta.badgeBg}`}>
                        {permissions.roleMeta.shortLabel}
                      </span>
                    )}
                    <span
                      className={classNames(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-xs",
                        isOnline
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                          : "bg-amber-50 text-amber-800 border border-amber-200/80"
                      )}
                    >
                      <span
                        className={classNames(
                          "h-1.5 w-1.5 rounded-full",
                          isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                        )}
                      />
                      {isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(canInstall || isIOS) && !isInstalled ? (
                  <button
                    onClick={onInstallPwa}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-palm/30 bg-skyglass px-2.5 py-1.5 text-xs font-bold text-palm transition hover:bg-palm hover:text-white"
                    title="Install BizPurse App"
                  >
                    <Smartphone className="h-4 w-4" />
                    <span className="hidden sm:inline">Install App</span>
                  </button>
                ) : null}
                {!isCashier ? (
                  <button
                    className="icon-button"
                    aria-label="Search inventory"
                    title="Search inventory"
                    onClick={() => onNavigate("inventory")}
                  >
                    <Search className="h-5 w-5" />
                  </button>
                ) : null}
                {isCashier ? (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 hover:text-rose-800"
                    title="Sign out / End cashier shift"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                ) : null}
                <button
                  className="hidden min-h-11 items-center gap-2 rounded-xl bg-palm px-4 text-sm font-bold text-white shadow-lg shadow-palm/20 transition hover:bg-palmDeep sm:inline-flex"
                  onClick={() => onNavigate("sales")}
                >
                  <Plus className="h-4 w-4" />
                  New Sale
                </button>
              </div>
            </div>
          </header>

          <div className="screen-pad mx-auto max-w-5xl pt-4 space-y-3">
            {permissions?.isSimulating ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-2xl bg-amber-500 px-4 py-3 text-xs font-black text-white shadow-md animate-in fade-in slide-in-from-top duration-200">
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4 shrink-0 text-amber-100" />
                  <span>
                    Cashier View Simulation Active — Confidential cost prices and store profit margins are hidden.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSetPreviewRole?.(null)}
                  className="self-end sm:self-auto shrink-0 rounded-xl bg-ink px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900 transition shadow-xs"
                >
                  Exit Simulation
                </button>
              </div>
            ) : null}

            <PwaBanner
              canInstall={canInstall}
              isInstalled={isInstalled}
              isIOS={isIOS}
              needRefresh={needRefresh}
              onInstall={onInstallPwa}
              onUpdate={onUpdatePwa}
            />

            {!isOnline ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm">
                You are offline. Core app pages are available, but new data may not sync until you reconnect.
              </div>
            ) : null}

            {queuedCount > 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-3xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-sky-600 px-1 text-xs font-black text-white">
                    {queuedCount}
                  </span>
                  <span>
                    {queuedCount === 1 ? "1 offline sale queued." : `${queuedCount} offline sales queued.`}
                    {isOnline ? (isSyncing ? " Syncing automatically..." : " Ready to sync.") : " Reconnect to sync."}
                  </span>
                </div>
                {isOnline && onTriggerSync ? (
                  <button
                    onClick={onTriggerSync}
                    disabled={isSyncing}
                    className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sky-700 disabled:opacity-50"
                  >
                    {isSyncing ? "Syncing..." : "Sync Now"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {conflictedCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-rose-600 px-1 text-xs font-black text-white">
                    {conflictedCount}
                  </span>
                  <span>
                    {conflictedCount === 1
                      ? "1 offline sale encountered a conflict (e.g. stock depleted on server)."
                      : `${conflictedCount} offline sales encountered conflicts.`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConflictModal(true)}
                    className="rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-black text-rose-800 shadow-sm transition hover:bg-rose-100/50"
                  >
                    Review Conflicts
                  </button>
                  {onDismissConflicted ? (
                    <button
                      type="button"
                      onClick={onDismissConflicted}
                      className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700"
                    >
                      Dismiss All
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="screen-pad mx-auto max-w-5xl pt-5 sm:pt-7 pb-24 lg:pb-8">{children}</div>
        </main>
      </div>

      {activeScreen !== "sales" ? (
        <button
          className="fixed bottom-[calc(5.15rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-palm text-white shadow-2xl shadow-palm/40 transition-all hover:scale-105 active:scale-95 hover:bg-palmDeep sm:hidden"
          aria-label="New sale"
          title="Start new sale"
          onClick={() => onNavigate("sales")}
        >
          <ReceiptText className="h-6 w-6" />
        </button>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-2 lg:hidden">
        <div className={classNames("mx-auto grid gap-1", isCashier ? "max-w-xs grid-cols-3" : "max-w-md grid-cols-5")}>
          {visibleMobileNavItems.map((item) => (
            <MobileNavButton
              key={item.id}
              item={item}
              active={
                item.id === "more"
                  ? activeScreen === "more" || activeScreen === "reports" || activeScreen === "expenses"
                  : activeScreen === item.id
              }
              lowStockCount={item.id === "inventory" ? lowStockCount : 0}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-out Drawer Panel */}
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col bg-white shadow-2xl border-l border-slate-100 animate-in slide-in-from-right duration-200 ease-out"
            aria-label="Mobile Navigation Drawer"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <AppLogo
                imageClassName="h-8 w-8 rounded-xl object-contain shadow-xs"
                titleClassName="text-lg font-black text-slate-900 tracking-tight"
                subtitle={null}
              />
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition active:scale-95"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>

            {/* Store & Member Info Card */}
            <div className="border-b border-slate-100 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-palm text-xs font-black text-white shadow-xs">
                  {business?.logoText || "BP"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">{business?.name || "BizPurse Store"}</p>
                  {business?.location ? (
                    <p className="truncate text-xs font-medium text-slate-500">{business.location}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {permissions?.roleMeta && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${permissions.roleMeta.badgeBg}`}>
                        {permissions.roleMeta.shortLabel}
                      </span>
                    )}
                    <span
                      className={classNames(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        isOnline
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                          : "bg-amber-50 text-amber-800 border border-amber-200/80"
                      )}
                    >
                      <span
                        className={classNames(
                          "h-1.5 w-1.5 rounded-full",
                          isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                        )}
                      />
                      {isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {drawerNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      setIsMobileDrawerOpen(false);
                    }}
                    className={classNames(
                      "flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-sm font-bold transition",
                      isActive
                        ? "bg-palm text-white shadow-md shadow-palm/20"
                        : "text-slate-700 hover:bg-slate-100 hover:text-ink active:bg-slate-200/60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </div>
                    {item.id === "inventory" && lowStockCount > 0 ? (
                      <span
                        className={classNames(
                          "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.65rem] font-black",
                          isActive ? "bg-white text-palm" : "bg-red-600 text-white"
                        )}
                      >
                        {lowStockCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>

            {/* Drawer Footer */}
            <div className="border-t border-slate-100 p-4 space-y-2 bg-slate-50/50">
              {!plan?.isPro && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onOpenUpgradeModal?.();
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 p-3 text-white shadow-md shadow-amber-500/20 transition hover:from-amber-600 hover:to-amber-700"
                >
                  <div className="flex items-center gap-2.5">
                    <Crown className="h-5 w-5 text-amber-100" />
                    <div className="text-left">
                      <p className="text-xs font-black">Upgrade to BizTrac Pro</p>
                      <p className="text-[10px] text-amber-100">Invoices, staff PINs & margins</p>
                    </div>
                  </div>
                  <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase">
                    Go Pro
                  </span>
                </button>
              )}
              {(canInstall || isIOS) && !isInstalled ? (
                <button
                  type="button"
                  onClick={() => {
                    onInstallPwa?.();
                    setIsMobileDrawerOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-palm/30 bg-skyglass px-3 py-2.5 text-xs font-bold text-palm hover:bg-palm hover:text-white transition"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Install BizPurse App</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  onSignOut?.();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-98"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Review Conflicted Sales</h3>
                  <p className="text-xs text-slate-500">{conflictedCount} sale(s) could not automatically sync</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConflictModal(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {conflictedSales.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8">No conflicted sales found.</p>
              ) : (
                conflictedSales.map((sale) => {
                  const payload = sale.payload || {};
                  const lines = payload.lines || [];
                  const customerName = payload.customer?.name || "Walk-in Customer";
                  const totalAmount = lines.reduce((sum, l) => sum + (Number(l.total ?? l.lineTotal) || 0), 0);

                  return (
                    <div
                      key={sale.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{customerName}</p>
                          <p className="font-mono text-[11px] text-slate-500">
                            {new Date(sale.conflictedAt || sale.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <span className="font-black text-slate-900 text-sm">
                          {formatCurrency(totalAmount)}
                        </span>
                      </div>

                      <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-2 text-rose-800 font-medium">
                        ⚠️ Reason: {sale.conflictError || "Stock depleted on server."}
                      </div>

                      <div className="text-[11px] text-slate-600">
                        <span className="font-semibold">Items: </span>
                        {lines.map((l) => `${l.quantity}x ${l.product?.name || l.name || "Item"}`).join(", ") || "No items"}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={async () => {
                            await onRetryConflicted?.(sale.id);
                            if (conflictedSales.length <= 1) setShowConflictModal(false);
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-palm" />
                          <span>Retry Sync</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await onDismissSingleConflicted?.(sale.id);
                            if (conflictedSales.length <= 1) setShowConflictModal(false);
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-bold text-rose-700 shadow-sm transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                          <span>Dismiss</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3.5 bg-slate-50 rounded-b-3xl">
              {onDismissConflicted && conflictedSales.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    onDismissConflicted();
                    setShowConflictModal(false);
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 underline"
                >
                  Dismiss All Conflicts
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setShowConflictModal(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <AppLogo
      imageClassName="h-14 w-14 rounded-2xl border-2 border-ink/50 object-cover lg:h-13 lg:w-13"
      titleClassName="text-lg font-black text-ink"
      subtitleClassName="text-xs font-semibold text-slate-500"
      subtitle="Manage Today. Grow Tomorrow."
    />
  );
}

function NavButton({ item, active, onClick, badge }) {
  const Icon = item.icon;

  return (
    <button
      className={classNames(
        "flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-sm font-bold transition",
        active ? "bg-palm text-white shadow-lg shadow-palm/20" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <span>{item.label}</span>
      </div>
      {badge}
    </button>
  );
}

function MobileNavButton({ item, active, onClick, lowStockCount }) {
  const Icon = item.icon;

  return (
    <button
      className={classNames(
        "relative flex min-h-[4.15rem] flex-col items-center justify-center gap-1 rounded-2xl text-[0.7rem] font-bold transition-all active:scale-95",
        active ? "bg-palm/10 text-palm font-black" : "text-slate-500 hover:text-slate-800"
      )}
      onClick={onClick}
    >
      {active && (
        <span className="absolute top-1.5 h-1 w-5 rounded-full bg-palm animate-in fade-in" />
      )}
      <Icon className={classNames("h-5 w-5 transition-transform", active ? "scale-110" : "")} />
      <span>{item.label}</span>
      {lowStockCount > 0 ? (
        <span className="absolute right-3 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[0.63rem] font-black text-white shadow-sm">
          {lowStockCount}
        </span>
      ) : null}
    </button>
  );
}

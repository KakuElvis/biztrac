import {
  BarChart3,
  Boxes,
  Home,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  WalletCards,
} from "lucide-react";
import { AppLogo } from "../../components/common/AppLogo.jsx";
import { classNames } from "../../lib/formatters.js";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "sales", label: "Sales", icon: ShoppingCart },
  { id: "inventory", label: "Stock", icon: Boxes },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "more", label: "More", icon: Menu },
];

export function AppShell({
  children,
  activeScreen,
  business,
  onNavigate,
  lowStockCount,
  onSignOut,
}) {
  return (
    <div className="min-h-screen pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl lg:grid lg:grid-cols-[18rem_1fr]">
        <aside className="sticky top-0 hidden h-screen border-r border-slate-200 bg-white/85 p-5 backdrop-blur lg:flex lg:flex-col">
          <Brand />
          <nav className="mt-8 space-y-2">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={activeScreen === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}
            <NavButton
              item={{ id: "expenses", label: "Expenses", icon: WalletCards }}
              active={activeScreen === "expenses"}
              onClick={() => onNavigate("expenses")}
            />
          </nav>
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
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
            <div className="screen-pad mx-auto flex h-20 max-w-5xl items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-palm text-sm font-black text-white">
                  {business.logoText}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-ink">{business.name}</p>
                  <p className="truncate text-xs font-medium text-slate-500">{business.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="icon-button" aria-label="Search">
                  <Search className="h-5 w-5" />
                </button>
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

          <div className="screen-pad mx-auto max-w-5xl py-5 sm:py-7">{children}</div>
        </main>
      </div>

      <button
        className="fixed bottom-[calc(5.15rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-palm text-white shadow-2xl shadow-palm/35 transition hover:bg-palmDeep sm:hidden"
        aria-label="New sale"
        onClick={() => onNavigate("sales")}
      >
        <ReceiptText className="h-6 w-6" />
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {navItems.map((item) => (
            <MobileNavButton
              key={item.id}
              item={item}
              active={activeScreen === item.id}
              lowStockCount={item.id === "inventory" ? lowStockCount : 0}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>
      </nav>
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

function NavButton({ item, active, onClick }) {
  const Icon = item.icon;

  return (
    <button
      className={classNames(
        "flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-sm font-bold transition",
        active ? "bg-palm text-white shadow-lg shadow-palm/20" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
      )}
      onClick={onClick}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </button>
  );
}

function MobileNavButton({ item, active, onClick, lowStockCount }) {
  const Icon = item.icon;

  return (
    <button
      className={classNames(
        "relative flex min-h-[4.15rem] flex-col items-center justify-center gap-1 rounded-2xl text-[0.7rem] font-bold transition",
        active ? "bg-skyglass text-palm" : "text-slate-500"
      )}
      onClick={onClick}
    >
      <Icon className="h-5 w-5" />
      <span>{item.label}</span>
      {lowStockCount > 0 ? (
        <span className="absolute right-3 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[0.63rem] font-black text-white">
          {lowStockCount}
        </span>
      ) : null}
    </button>
  );
}

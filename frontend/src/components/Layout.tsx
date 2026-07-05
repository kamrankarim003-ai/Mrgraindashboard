import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  ShoppingCart,
  FileText,
  Wallet,
  Receipt,
  Boxes,
  CheckSquare,
  BarChart3,
  UserCog,
  Settings as SettingsIcon,
  Menu,
  LogOut,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ModuleName } from "../types";
import { NotificationBell } from "./NotificationBell";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; module: ModuleName }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { to: "/customers", label: "Customers", icon: Users, module: "customers" },
  { to: "/pipeline", label: "Sales Pipeline", icon: GitBranch, module: "customers" },
  { to: "/orders", label: "Orders", icon: ShoppingCart, module: "orders" },
  { to: "/invoices", label: "Invoices", icon: FileText, module: "invoices" },
  { to: "/payments", label: "Payments", icon: Wallet, module: "payments" },
  { to: "/expenses", label: "Expenses", icon: Receipt, module: "expenses" },
  { to: "/inventory", label: "Inventory", icon: Boxes, module: "inventory" },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, module: "tasks" },
  { to: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
  { to: "/team", label: "Team", icon: UserCog, module: "team" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, module: "settings" },
];

export function Layout() {
  const { user, can, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = NAV.filter((item) => can(item.module, "view"));

  return (
    <div className="min-h-screen flex bg-cream">
      <aside
        className={`fixed sm:static z-40 inset-y-0 left-0 w-64 bg-brown text-cream transform transition-transform sm:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-cream/10">
          <h1 className="text-xl font-heading text-gold">MR GRAIN</h1>
          <p className="text-xs text-cream/60">Business Command Centre</p>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-gold text-brown font-medium" : "text-cream/80 hover:bg-cream/10"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 sm:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-4 bg-white border-b border-black/5 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button className="sm:hidden text-brown" onClick={() => setMobileOpen(true)}>
              <Menu size={22} />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-cream rounded-lg px-3 py-2 w-full max-w-sm text-brown/50">
              <Search size={16} />
              <input placeholder="Search..." className="bg-transparent outline-none text-sm w-full text-ink" />
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <NotificationBell />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-brown">{user?.name}</p>
              <p className="text-xs text-brown/60">{user?.roleName}</p>
            </div>
            <button onClick={logout} className="btn-ghost !px-2" title="Log out">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

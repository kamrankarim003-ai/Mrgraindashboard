import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const REPORTS: { key: string; label: string; financial?: boolean }[] = [
  { key: "sales", label: "Sales Report" },
  { key: "profit-loss", label: "Profit & Loss", financial: true },
  { key: "expenses", label: "Expense Report", financial: true },
  { key: "customers", label: "Customer Report" },
  { key: "salesperson-performance", label: "Salesperson Performance" },
  { key: "outstanding-payments", label: "Outstanding Payments", financial: true },
  { key: "order-status", label: "Order Status Report" },
  { key: "inventory", label: "Inventory Report" },
  { key: "followups", label: "Follow-up Report" },
  { key: "lost-leads", label: "Lost Leads Report" },
  { key: "best-customers", label: "Best Customer Report" },
  { key: "best-products", label: "Best Product Report" },
];

export function Reports() {
  const { user } = useAuth();
  const isFinancial = user?.roleName === "Owner" || user?.roleName === "Accountant";
  const visible = REPORTS.filter((r) => !r.financial || isFinancial);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Reports</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((r) => (
          <Link key={r.key} to={`/reports/${r.key}`} className="card hover:border-gold/40 border border-transparent transition-colors">
            <h3 className="text-base font-semibold text-brown">{r.label}</h3>
            <p className="text-xs text-brown/50 mt-1">View, filter, and export</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

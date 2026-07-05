import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { StatCard } from "../components/StatCard";
import { CustomerFormModal } from "../components/forms/CustomerFormModal";
import { OrderFormModal } from "../components/forms/OrderFormModal";
import { ExpenseFormModal } from "../components/forms/ExpenseFormModal";
import { TaskFormModal } from "../components/forms/TaskFormModal";
import { CreateInvoiceModal } from "../components/forms/CreateInvoiceModal";

type RangeKey = "today" | "week" | "month" | "custom";

function rangeToDates(range: RangeKey, customFrom: string, customTo: string) {
  const now = new Date();
  const to = new Date(now);
  let from = new Date(now);
  if (range === "today") {
    from = new Date(now);
  } else if (range === "week") {
    from.setDate(now.getDate() - 7);
  } else if (range === "month") {
    from.setMonth(now.getMonth() - 1);
  } else {
    return { from: customFrom, to: customTo };
  }
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function Dashboard() {
  const { user, can } = useAuth();
  const [range, setRange] = useState<RangeKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [modal, setModal] = useState<null | "customer" | "order" | "expense" | "task" | "invoice">(null);

  const { from, to } = useMemo(() => rangeToDates(range, customFrom, customTo), [range, customFrom, customTo]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", from, to],
    queryFn: async () => (await api.get("/dashboard", { params: { from, to } })).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Welcome back, {user?.name}</h1>
        <p className="text-brown/60 text-sm">Logged in as {user?.roleName}</p>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-2">
            {(["today", "week", "month", "custom"] as RangeKey[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={range === r ? "btn-primary !py-1.5 !px-3 text-xs" : "btn-secondary !py-1.5 !px-3 text-xs"}
              >
                {r === "today" ? "Today" : r === "week" ? "This Week" : r === "month" ? "This Month" : "Custom"}
              </button>
            ))}
            {range === "custom" && (
              <div className="flex gap-2 items-center">
                <input type="date" className="input !py-1.5 text-xs" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                <span className="text-xs text-brown/50">to</span>
                <input type="date" className="input !py-1.5 text-xs" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {can("customers", "create") && <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => setModal("customer")}>+ Add Lead</button>}
            {can("customers", "create") && <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => setModal("customer")}>+ Add Customer</button>}
            {can("orders", "create") && <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => setModal("order")}>+ Add Order</button>}
            {can("invoices", "create") && <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => setModal("invoice")}>+ Create Invoice</button>}
            {can("expenses", "create") && <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => setModal("expense")}>+ Add Expense</button>}
            {can("tasks", "create") && <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => setModal("task")}>+ Add Task</button>}
          </div>
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-brown/60">Loading dashboard...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Today's Tasks" value={data.todaysTasks.count} sub={data.todaysTasks.items.slice(0, 3).map((t: any) => t.title).join(", ") || "No data yet"} />
          <StatCard label="Overdue Tasks" value={data.overdueTasks.count} tone={data.overdueTasks.count > 0 ? "red" : "neutral"} />
          <StatCard
            label="Follow-ups Due Today"
            value={data.followupsToday.count}
            tone={data.followupsToday.count > 0 ? "amber" : "neutral"}
            sub={data.followupsToday.items.slice(0, 3).map((c: any) => c.businessName).join(", ") || "No data yet"}
          />
          <StatCard label="Pending Orders" value={data.pendingOrders.count} />
          <StatCard label="Ready for Delivery" value={data.readyForDelivery.count} tone="amber" />
          <StatCard label="Unpaid Invoices" value={data.unpaidInvoices.count} sub={`$${data.unpaidInvoices.total.toFixed(2)} outstanding`} tone={data.unpaidInvoices.count > 0 ? "amber" : "neutral"} />
          <StatCard label="Payments Received" value={`$${data.paymentsReceived.total.toFixed(2)}`} tone="green" />
          <StatCard label="Total Sales" value={`$${data.totalSales.total.toFixed(2)}`} tone="green" />
          <StatCard label="Total Expenses" value={`$${data.totalExpenses.total.toFixed(2)}`} />
          <StatCard label="Estimated Profit" value={`$${data.estimatedProfit.total.toFixed(2)}`} tone={data.estimatedProfit.total >= 0 ? "green" : "red"} />
          <StatCard label="Low Stock Alerts" value={data.lowStockAlerts.count} tone={data.lowStockAlerts.count > 0 ? "red" : "neutral"} sub={data.lowStockAlerts.items.slice(0, 3).map((p: any) => p.productName).join(", ") || "No data yet"} />
          <StatCard label="New Leads" value={data.newLeads.count} />
          <StatCard label="Sales Pipeline Value" value={`$${data.salesPipelineValue.total.toFixed(2)}`} sub="Coming in Sales Pipeline module" />
          <div className="card sm:col-span-2 lg:col-span-2">
            <p className="text-xs font-medium text-brown/60 uppercase tracking-wide mb-3">Best Customers</p>
            {data.bestCustomers.length === 0 ? (
              <p className="text-sm text-brown/50">No data yet</p>
            ) : (
              <ul className="space-y-2">
                {data.bestCustomers.map((c: any) => (
                  <li key={c.customerId} className="flex justify-between text-sm">
                    <Link to={`/customers/${c.customerId}`} className="text-ink hover:text-gold-dark">{c.businessName}</Link>
                    <span className="font-medium">${c.totalValue.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <CustomerFormModal open={modal === "customer"} onClose={() => setModal(null)} />
      <OrderFormModal open={modal === "order"} onClose={() => setModal(null)} />
      <ExpenseFormModal open={modal === "expense"} onClose={() => setModal(null)} />
      <TaskFormModal open={modal === "task"} onClose={() => setModal(null)} />
      <CreateInvoiceModal open={modal === "invoice"} onClose={() => setModal(null)} />
    </div>
  );
}

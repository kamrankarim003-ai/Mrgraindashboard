import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, downloadFile } from "../lib/api";
import { Customer } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { CustomerFormModal } from "../components/forms/CustomerFormModal";
import { Download } from "lucide-react";

const STATUSES = ["new_lead", "contacted", "quote_sent", "negotiating", "active_customer", "inactive", "lost"];

function isOverdue(dateStr?: string | null) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export function Customers() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers", search, status, customerType],
    queryFn: async () =>
      (await api.get("/customers", { params: { search: search || undefined, status: status || undefined, customerType: customerType || undefined } })).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Customers</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => downloadFile("/customers/export.xlsx", "customers.xlsx")}>
            <Download size={16} /> Export
          </button>
          {can("customers", "create") && (
            <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Customer</button>
          )}
        </div>
      </div>

      <div className="card flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <select className="input max-w-xs" value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
          <option value="">All types</option>
          {["restaurant", "grocery_store", "supermarket", "distributor", "food_service", "other"].map((t) => (
            <option key={t} value={t}>{t.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-brown/60">Loading...</p>
        ) : customers.length === 0 ? (
          <p className="text-brown/60 text-center py-8">No data yet</p>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-brown/60 border-b border-black/5">
                <th className="pb-2 pr-4">Business</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Assigned</th>
                <th className="pb-2 pr-4">Last Contacted</th>
                <th className="pb-2 pr-4">Next Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-cream/60">
                  <td className="py-2 pr-4">
                    <Link to={`/customers/${c.id}`} className="text-ink font-medium hover:text-gold-dark">{c.businessName}</Link>
                  </td>
                  <td className="py-2 pr-4 text-brown/70">{c.customerType.replace("_", " ")}</td>
                  <td className="py-2 pr-4"><StatusBadge value={c.status} /></td>
                  <td className="py-2 pr-4 text-brown/70">{c.assignedUser?.name || "-"}</td>
                  <td className="py-2 pr-4 text-brown/70">{c.lastContactedAt ? new Date(c.lastContactedAt).toLocaleDateString() : "-"}</td>
                  <td className="py-2 pr-4">
                    {c.nextFollowupAt ? (
                      <span className={isOverdue(c.nextFollowupAt) ? "text-status-red-text font-medium" : ""}>
                        {new Date(c.nextFollowupAt).toLocaleDateString()}
                      </span>
                    ) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CustomerFormModal open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}

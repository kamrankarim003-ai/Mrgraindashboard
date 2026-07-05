import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { api, downloadFile } from "../lib/api";
import { Invoice } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { CreateInvoiceModal } from "../components/forms/CreateInvoiceModal";
import { useAuth } from "../context/AuthContext";

const STATUSES = ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled"];

export function Invoices() {
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices", status],
    queryFn: async () => (await api.get("/invoices", { params: { status: status || undefined } })).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Invoices</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => downloadFile("/invoices/export.xlsx", "invoices.xlsx")}>
            <Download size={16} /> Export
          </button>
          {can("invoices", "create") && <button className="btn-primary" onClick={() => setShowForm(true)}>+ Create Invoice</button>}
        </div>
      </div>

      <div className="card flex flex-wrap gap-3">
        <select className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-brown/60">Loading...</p>
        ) : invoices.length === 0 ? (
          <p className="text-brown/60 text-center py-8">No data yet</p>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-brown/60 border-b border-black/5">
                <th className="pb-2 pr-4">Invoice #</th>
                <th className="pb-2 pr-4">Customer</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4 text-right">Total</th>
                <th className="pb-2 pr-4 text-right">Balance Due</th>
                <th className="pb-2 pr-4">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const overdue = i.status !== "paid" && i.status !== "cancelled" && i.dueDate && new Date(i.dueDate) < new Date();
                return (
                  <tr key={i.id} className={`border-b border-black/5 last:border-0 hover:bg-cream/60 ${overdue ? "bg-status-red-bg/30" : ""}`}>
                    <td className="py-2 pr-4">
                      <Link to={`/invoices/${i.id}`} className="text-ink font-medium hover:text-gold-dark">{i.invoiceNumber}</Link>
                    </td>
                    <td className="py-2 pr-4 text-brown/70">{i.customer?.businessName}</td>
                    <td className="py-2 pr-4"><StatusBadge value={i.status} /></td>
                    <td className="py-2 pr-4 text-right">${Number(i.totalAmount).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right font-medium">${Number(i.balanceDue).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-brown/70">{i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <CreateInvoiceModal open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}

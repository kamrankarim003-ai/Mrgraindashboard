import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api, downloadFile } from "../lib/api";
import { Expense } from "../types";
import { useAuth } from "../context/AuthContext";
import { ExpenseFormModal } from "../components/forms/ExpenseFormModal";

const CATEGORIES = [
  "stock_purchase", "packaging", "warehouse", "rent", "delivery_fuel",
  "marketing", "staff_wages", "software", "accountant", "bank_fees", "other",
];

export function Expenses() {
  const { can } = useAuth();
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", category, from, to],
    queryFn: async () =>
      (await api.get("/expenses", { params: { category: category || undefined, from: from || undefined, to: to || undefined } })).data,
  });

  const expenses: Expense[] = data?.expenses || [];
  const totalsByCategory: Record<string, number> = data?.totalsByCategory || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Expenses</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => downloadFile("/expenses/export.xlsx", "expenses.xlsx")}>
            <Download size={16} /> Export
          </button>
          {can("expenses", "create") && <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Expense</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(totalsByCategory).length === 0 && <p className="text-brown/50 text-sm col-span-full">No data yet</p>}
        {Object.entries(totalsByCategory).map(([cat, total]) => (
          <div key={cat} className="card !p-3">
            <p className="text-xs text-brown/60 capitalize">{cat.replace("_", " ")}</p>
            <p className="text-lg font-semibold text-ink">${total.toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <select className="input max-w-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.replace("_", " ")}</option>
          ))}
        </select>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-brown/60">Loading...</p>
        ) : expenses.length === 0 ? (
          <p className="text-brown/60 text-center py-8">No data yet</p>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-brown/60 border-b border-black/5">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Supplier</th>
                <th className="pb-2 pr-4 text-right">Amount</th>
                <th className="pb-2 pr-4">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-black/5 last:border-0 hover:bg-cream/60">
                  <td className="py-2 pr-4">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="py-2 pr-4 capitalize">{e.category.replace("_", " ")}</td>
                  <td className="py-2 pr-4 text-brown/70">{e.supplierName || "-"}</td>
                  <td className="py-2 pr-4 text-right font-medium">${Number(e.amount).toFixed(2)}</td>
                  <td className="py-2 pr-4">
                    {e.receiptFileUrl ? (
                      <a href={e.receiptFileUrl} target="_blank" rel="noreferrer" className="text-gold-dark hover:underline text-xs">View</a>
                    ) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ExpenseFormModal open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}

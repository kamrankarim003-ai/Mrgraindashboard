import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { api, downloadFile } from "../lib/api";

const LABELS: Record<string, string> = {
  sales: "Sales Report",
  "profit-loss": "Profit & Loss",
  expenses: "Expense Report",
  customers: "Customer Report",
  "salesperson-performance": "Salesperson Performance",
  "outstanding-payments": "Outstanding Payments",
  "order-status": "Order Status Report",
  inventory: "Inventory Report",
  followups: "Follow-up Report",
  "lost-leads": "Lost Leads Report",
  "best-customers": "Best Customer Report",
  "best-products": "Best Product Report",
};

function humanize(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export function ReportDetail() {
  const { type } = useParams();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["report", type, from, to],
    queryFn: async () => (await api.get(`/reports/${type}`, { params: { from: from || undefined, to: to || undefined } })).data,
    enabled: !!type,
  });

  const rows: any[] = Array.isArray(data) ? data : data ? [data] : [];
  const columns = rows.length > 0 ? Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object" || rows[0][k] === null) : [];

  return (
    <div className="space-y-4">
      <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-brown/60 hover:text-brown">
        <ArrowLeft size={14} /> Back to Reports
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">{LABELS[type || ""] || "Report"}</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => downloadFile(`/reports/${type}?format=xlsx&from=${from}&to=${to}`, `${type}.xlsx`)}>
            <Download size={16} /> Excel
          </button>
          <button className="btn-secondary" onClick={() => downloadFile(`/reports/${type}?format=pdf&from=${from}&to=${to}`, `${type}.pdf`)}>
            <Download size={16} /> PDF
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
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
        ) : rows.length === 0 ? (
          <p className="text-brown/60 text-center py-8">No data yet</p>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-brown/60 border-b border-black/5">
                {columns.map((c) => (
                  <th key={c} className="pb-2 pr-4">{humanize(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id || idx} className="border-b border-black/5 last:border-0">
                  {columns.map((c) => (
                    <td key={c} className="py-2 pr-4">{typeof row[c] === "number" ? row[c].toLocaleString() : String(row[c] ?? "-")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

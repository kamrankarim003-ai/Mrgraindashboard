import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, downloadFile } from "../lib/api";
import { Payment } from "../types";
import { Download } from "lucide-react";

export function Payments() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["payments", from, to],
    queryFn: async () => (await api.get("/payments", { params: { from: from || undefined, to: to || undefined } })).data,
  });

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Payments</h1>
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
        <p className="text-sm text-brown/60 ml-auto">Total: <span className="font-semibold text-ink">${total.toFixed(2)}</span></p>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-brown/60">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="text-brown/60 text-center py-8">No data yet</p>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-brown/60 border-b border-black/5">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Customer</th>
                <th className="pb-2 pr-4">Invoice</th>
                <th className="pb-2 pr-4 text-right">Amount</th>
                <th className="pb-2 pr-4">Method</th>
                <th className="pb-2 pr-4">Recorded By</th>
                <th className="pb-2 pr-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-cream/60">
                  <td className="py-2 pr-4">{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">{p.customer?.businessName}</td>
                  <td className="py-2 pr-4">
                    <Link to={`/invoices/${p.invoiceId}`} className="text-ink hover:text-gold-dark">{p.invoice?.invoiceNumber}</Link>
                  </td>
                  <td className="py-2 pr-4 text-right font-medium">${Number(p.amount).toFixed(2)}</td>
                  <td className="py-2 pr-4">{p.paymentMethod.replace("_", " ")}</td>
                  <td className="py-2 pr-4 text-brown/70">{p.recorder?.name || "-"}</td>
                  <td className="py-2 pr-4 text-right">
                    <button className="text-gold-dark hover:underline text-xs" onClick={() => downloadFile(`/payments/${p.id}/receipt.pdf`, "receipt.pdf")}>
                      <Download size={14} className="inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

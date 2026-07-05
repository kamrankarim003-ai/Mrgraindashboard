import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { api, downloadFile } from "../lib/api";
import { Order } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { OrderFormModal } from "../components/forms/OrderFormModal";

const ORDER_STATUSES = ["draft", "confirmed", "packed", "dispatched", "delivered", "completed", "cancelled"];
const PAYMENT_STATUSES = ["unpaid", "deposit_paid", "partially_paid", "paid", "overdue"];

export function Orders() {
  const { can } = useAuth();
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders", orderStatus, paymentStatus],
    queryFn: async () =>
      (await api.get("/orders", { params: { orderStatus: orderStatus || undefined, paymentStatus: paymentStatus || undefined } })).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Orders</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => downloadFile("/orders/export.xlsx", "orders.xlsx")}>
            <Download size={16} /> Export
          </button>
          {can("orders", "create") && <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Order</button>}
        </div>
      </div>

      <div className="card flex flex-wrap gap-3">
        <select className="input max-w-xs" value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)}>
          <option value="">All order statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input max-w-xs" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="">All payment statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-brown/60">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-brown/60 text-center py-8">No data yet</p>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-brown/60 border-b border-black/5">
                <th className="pb-2 pr-4">Order #</th>
                <th className="pb-2 pr-4">Customer</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Payment</th>
                <th className="pb-2 pr-4">Delivery Date</th>
                <th className="pb-2 pr-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-black/5 last:border-0 hover:bg-cream/60">
                  <td className="py-2 pr-4">
                    <Link to={`/orders/${o.id}`} className="text-ink font-medium hover:text-gold-dark">{o.orderNumber}</Link>
                  </td>
                  <td className="py-2 pr-4 text-brown/70">{o.customer?.businessName}</td>
                  <td className="py-2 pr-4"><StatusBadge value={o.orderStatus} /></td>
                  <td className="py-2 pr-4"><StatusBadge value={o.paymentStatus} /></td>
                  <td className="py-2 pr-4 text-brown/70">{o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : "-"}</td>
                  <td className="py-2 pr-4 text-right font-medium">${Number(o.totalValue).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <OrderFormModal open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}

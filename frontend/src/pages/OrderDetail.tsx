import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage, downloadFile } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { Download } from "lucide-react";

const FLOW = ["draft", "confirmed", "packed", "dispatched", "delivered", "completed"];

export function OrderDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => (await api.get(`/orders/${id}`)).data,
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (orderStatus: string) => (await api.patch(`/orders/${id}/status`, { orderStatus })).data,
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["order", id] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const generateInvoice = useMutation({
    mutationFn: async () => (await api.post(`/invoices/from-order/${id}`)).data,
    onSuccess: (data) => navigate(`/invoices/${data.id}`),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (isLoading || !order) return <p className="text-brown/60">Loading...</p>;

  const currentIdx = FLOW.indexOf(order.orderStatus);
  const canAdvance = can("orders", "edit") && order.orderStatus !== "cancelled" && order.orderStatus !== "completed";
  const canCancel = can("orders", "edit") && !["cancelled", "completed"].includes(order.orderStatus);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl">{order.orderNumber}</h1>
            <p className="text-sm text-brown/60">
              <Link to={`/customers/${order.customerId}`} className="hover:text-gold-dark">{order.customer?.businessName}</Link>
            </p>
            <div className="mt-2 flex gap-2">
              <StatusBadge value={order.orderStatus} />
              <StatusBadge value={order.paymentStatus} />
            </div>
          </div>
          <div className="flex gap-2">
            {order.orderStatus !== "draft" && !order.invoiceId && can("invoices", "create") && (
              <button className="btn-primary text-xs" disabled={generateInvoice.isPending} onClick={() => generateInvoice.mutate()}>
                Generate Invoice
              </button>
            )}
            {order.invoiceId && (
              <Link to={`/invoices/${order.invoiceId}`} className="btn-secondary text-xs">View Invoice</Link>
            )}
          </div>
        </div>

        {order.orderStatus !== "cancelled" && (
          <div className="mt-6 flex items-center flex-wrap gap-1">
            {FLOW.map((step, idx) => (
              <div key={step} className="flex items-center">
                <span
                  className={`text-xs px-3 py-1.5 rounded-full ${
                    idx <= currentIdx ? "bg-gold text-brown font-medium" : "bg-black/5 text-brown/50"
                  }`}
                >
                  {step}
                </span>
                {idx < FLOW.length - 1 && <span className="w-4 h-px bg-black/10 mx-1" />}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-status-red-text mt-3">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {canAdvance && currentIdx < FLOW.length - 1 && (
            <button className="btn-primary text-xs" onClick={() => updateStatus.mutate(FLOW[currentIdx + 1])}>
              Move to {FLOW[currentIdx + 1]}
            </button>
          )}
          {canCancel && (
            <button className="btn-secondary text-xs text-status-red-text" onClick={() => updateStatus.mutate("cancelled")}>
              Cancel Order
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg">Line Items</h2>
          <button className="btn-secondary text-xs" onClick={() => downloadFile("/orders/export.xlsx", "orders.xlsx")}>
            <Download size={14} /> Export All
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-brown/60 border-b border-black/5">
              <th className="pb-2">Product</th>
              <th className="pb-2 text-right">Bags</th>
              <th className="pb-2 text-right">Kg</th>
              <th className="pb-2 text-right">Price/Bag</th>
              <th className="pb-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item: any) => (
              <tr key={item.id} className="border-b border-black/5 last:border-0">
                <td className="py-2">{item.product?.productName}</td>
                <td className="py-2 text-right">{item.quantityBags}</td>
                <td className="py-2 text-right">{item.quantityKg}</td>
                <td className="py-2 text-right">${Number(item.pricePerBag).toFixed(2)}</td>
                <td className="py-2 text-right">${Number(item.subtotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end mt-4">
          <div className="text-sm space-y-1 text-right">
            <p className="text-brown/60">Discount: ${Number(order.discount).toFixed(2)}</p>
            <p className="text-brown/60">GST applicable: {order.gstApplicable ? "Yes" : "No"}</p>
            <p className="text-lg font-semibold text-ink">Total: ${Number(order.totalValue).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="card grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="label">Delivery Address</p>
          <p>{order.deliveryAddress || "-"}</p>
        </div>
        <div>
          <p className="label">Delivery Date</p>
          <p>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "-"}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="label">Delivery Notes</p>
          <p>{order.deliveryNotes || "-"}</p>
        </div>
      </div>
    </div>
  );
}

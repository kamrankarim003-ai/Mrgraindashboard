import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Modal } from "../Modal";
import { api, apiErrorMessage } from "../../lib/api";
import { Order } from "../../types";

export function CreateInvoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["orders", "invoiceable"],
    queryFn: async () => (await api.get("/orders")).data,
    enabled: open,
  });

  const invoiceable = orders.filter((o) => o.orderStatus !== "draft" && o.orderStatus !== "cancelled" && !o.invoiceId);

  const mutation = useMutation({
    mutationFn: async () => (await api.post(`/invoices/from-order/${orderId}`)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onClose();
      navigate(`/invoices/${data.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!orderId) return setError("Please select an order");
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Invoice from Order">
      <form onSubmit={handleSubmit} className="space-y-4">
        {invoiceable.length === 0 ? (
          <p className="text-sm text-brown/60">No confirmed orders are awaiting an invoice right now.</p>
        ) : (
          <div>
            <label className="label">Confirmed order</label>
            <select className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">Select order...</option>
              {invoiceable.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} - {o.customer?.businessName} - ${Number(o.totalValue).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && <p className="text-sm text-status-red-text">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending || invoiceable.length === 0}>
            {mutation.isPending ? "Generating..." : "Generate Invoice"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "../Modal";
import { api, apiErrorMessage } from "../../lib/api";
import { Customer, Product } from "../../types";

interface LineItem {
  productId: string;
  quantityBags: number;
}

export function OrderFormModal({
  open,
  onClose,
  presetCustomerId,
}: {
  open: boolean;
  onClose: () => void;
  presetCustomerId?: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState(presetCustomerId || "");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState<LineItem[]>([{ productId: "", quantityBags: 1 }]);
  const [error, setError] = useState("");

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers", "all"],
    queryFn: async () => (await api.get("/customers")).data,
    enabled: open,
  });
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.post("/orders", {
          customerId,
          deliveryDate: deliveryDate || undefined,
          deliveryAddress: deliveryAddress || undefined,
          discount,
          items: items.filter((i) => i.productId && i.quantityBags > 0),
        })
      ).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
      navigate(`/orders/${data.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!customerId) return setError("Please select a customer");
    if (items.every((i) => !i.productId)) return setError("Add at least one product line");
    mutation.mutate();
  }

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  const estimatedTotal = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return sum;
    return sum + Number(product.wholesalePrice) * (product.bagSize === "kg1" ? 1 : product.bagSize === "kg5" ? 5 : 20) * item.quantityBags;
  }, 0);

  return (
    <Modal open={open} onClose={onClose} title="Create Order" wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Select customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.businessName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Delivery date</label>
            <input type="date" className="input" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Delivery address</label>
            <input className="input" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label mb-2">Line items</label>
          <div className="space-y-2">
            {items.map((item, idx) => {
              const product = products.find((p) => p.id === item.productId);
              return (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    className="input"
                    value={item.productId}
                    onChange={(e) => updateItem(idx, { productId: e.target.value })}
                  >
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.productName} ({p.bagSize.replace("kg", "")}kg) - {p.stockBags} bags in stock</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="input w-28"
                    value={item.quantityBags}
                    onChange={(e) => updateItem(idx, { quantityBags: Number(e.target.value) })}
                  />
                  <span className="text-xs text-brown/60 w-24 shrink-0">
                    {product ? `$${(Number(product.wholesalePrice) * (product.bagSize === "kg1" ? 1 : product.bagSize === "kg5" ? 5 : 20) * item.quantityBags).toFixed(2)}` : ""}
                  </span>
                  <button type="button" className="text-status-red-text" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn-ghost mt-2 text-sm"
            onClick={() => setItems((prev) => [...prev, { productId: "", quantityBags: 1 }])}
          >
            <Plus size={14} /> Add line
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Discount ($)</label>
            <input type="number" min={0} className="input" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </div>
          <div className="flex items-end justify-end">
            <p className="text-sm text-brown/70">Estimated total (excl. GST): <span className="font-semibold text-ink">${(estimatedTotal - discount).toFixed(2)}</span></p>
          </div>
        </div>

        {error && <p className="text-sm text-status-red-text">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create Order"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

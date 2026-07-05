import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/Modal";

export function ProductDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [stockInOpen, setStockInOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => (await api.get(`/products/${id}`)).data,
    enabled: !!id,
  });

  const stockIn = useMutation({
    mutationFn: async () => (await api.post(`/products/${id}/stock-in`, { quantityBags: Number(quantity), notes })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      setStockInOpen(false);
      setQuantity("");
      setNotes("");
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const adjust = useMutation({
    mutationFn: async () => (await api.post(`/products/${id}/adjust`, { quantityBags: Number(quantity), reason: notes })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      setAdjustOpen(false);
      setQuantity("");
      setNotes("");
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (isLoading || !product) return <p className="text-brown/60">Loading...</p>;

  const low = product.stockBags <= product.lowStockLevel;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl">{product.productName}</h1>
            <p className="text-sm text-brown/60">SKU: {product.sku} · {product.bagSize.replace("kg", "")}kg bags</p>
            {low && <span className="badge badge-red mt-2 inline-block">Low Stock</span>}
          </div>
          {can("inventory", "create") && (
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={() => setStockInOpen(true)}>+ Add Stock</button>
              <button className="btn-secondary text-xs" onClick={() => setAdjustOpen(true)}>Adjust Stock</button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
          <div><p className="label">Stock (Bags)</p><p className="text-lg font-semibold">{product.stockBags}</p></div>
          <div><p className="label">Stock (Kg)</p><p className="text-lg font-semibold">{product.stockKg}</p></div>
          <div><p className="label">Cost Price</p><p className="text-lg font-semibold">${Number(product.costPrice).toFixed(2)}</p></div>
          <div><p className="label">Wholesale Price</p><p className="text-lg font-semibold">${Number(product.wholesalePrice).toFixed(2)}</p></div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg mb-3">Stock Movement History</h2>
        {product.inventoryMovements?.length === 0 ? (
          <p className="text-brown/50 text-sm">No data yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brown/60 border-b border-black/5">
                <th className="pb-2">Date</th>
                <th className="pb-2">Type</th>
                <th className="pb-2 text-right">Bags</th>
                <th className="pb-2">Notes</th>
                <th className="pb-2">By</th>
              </tr>
            </thead>
            <tbody>
              {product.inventoryMovements?.map((m: any) => (
                <tr key={m.id} className="border-b border-black/5 last:border-0">
                  <td className="py-2">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="py-2 capitalize">{m.movementType.replace("_", " ")}</td>
                  <td className={`py-2 text-right ${m.quantityBags < 0 ? "text-status-red-text" : "text-status-green-text"}`}>
                    {m.quantityBags > 0 ? "+" : ""}{m.quantityBags}
                  </td>
                  <td className="py-2 text-brown/70">{m.notes || "-"}</td>
                  <td className="py-2 text-brown/70">{m.user?.name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={stockInOpen} onClose={() => setStockInOpen(false)} title="Add Stock">
        <div className="space-y-4">
          <div>
            <label className="label">Quantity received (bags)</label>
            <input type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-status-red-text">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setStockInOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={stockIn.isPending || !quantity} onClick={() => { setError(""); stockIn.mutate(); }}>Add Stock</button>
          </div>
        </div>
      </Modal>

      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Adjust Stock">
        <div className="space-y-4">
          <div>
            <label className="label">Adjustment (bags, use negative for reductions)</label>
            <input type="number" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div>
            <label className="label">Reason (required)</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-status-red-text">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setAdjustOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={adjust.isPending || !quantity || !notes} onClick={() => { setError(""); adjust.mutate(); }}>Save Adjustment</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

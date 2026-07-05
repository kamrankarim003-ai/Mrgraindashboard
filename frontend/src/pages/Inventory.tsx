import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";
import { Product } from "../types";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/Modal";

const PRODUCT_TYPES = ["basmati", "sella"];
const BAG_SIZES = ["kg1", "kg5", "kg20"];

export function Inventory() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    productName: "", productType: "basmati", bagSize: "kg20", sku: "",
    costPrice: "", wholesalePrice: "", lowStockLevel: "10",
  });

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
  });

  const createProduct = useMutation({
    mutationFn: async () =>
      (await api.post("/products", {
        ...form,
        costPrice: Number(form.costPrice),
        wholesalePrice: Number(form.wholesalePrice),
        lowStockLevel: Number(form.lowStockLevel),
      })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowForm(false);
      setForm({ productName: "", productType: "basmati", bagSize: "kg20", sku: "", costPrice: "", wholesalePrice: "", lowStockLevel: "10" });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    createProduct.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Inventory</h1>
        {can("inventory", "create") && <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Product</button>}
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-brown/60">Loading...</p>
        ) : products.length === 0 ? (
          <p className="text-brown/60 text-center py-8">No data yet</p>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-brown/60 border-b border-black/5">
                <th className="pb-2 pr-4">Product</th>
                <th className="pb-2 pr-4">SKU</th>
                <th className="pb-2 pr-4 text-right">Stock (Bags)</th>
                <th className="pb-2 pr-4 text-right">Stock (Kg)</th>
                <th className="pb-2 pr-4 text-right">Cost</th>
                <th className="pb-2 pr-4 text-right">Wholesale</th>
                <th className="pb-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = p.stockBags <= p.lowStockLevel;
                return (
                  <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-cream/60">
                    <td className="py-2 pr-4">
                      <Link to={`/inventory/${p.id}`} className="text-ink font-medium hover:text-gold-dark">{p.productName}</Link>
                      <span className="text-xs text-brown/50 block">{p.bagSize.replace("kg", "")}kg bags</span>
                    </td>
                    <td className="py-2 pr-4 text-brown/70">{p.sku}</td>
                    <td className="py-2 pr-4 text-right">{p.stockBags}</td>
                    <td className="py-2 pr-4 text-right">{p.stockKg}</td>
                    <td className="py-2 pr-4 text-right">${Number(p.costPrice).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right">${Number(p.wholesalePrice).toFixed(2)}</td>
                    <td className="py-2 pr-4">
                      {low ? <span className="badge badge-red">Low Stock</span> : <span className="badge badge-green">OK</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Product">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Product name</label>
            <input className="input" required value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Product type</label>
              <select className="input" value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}>
                {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bag size</label>
              <select className="input" value={form.bagSize} onChange={(e) => setForm({ ...form, bagSize: e.target.value })}>
                {BAG_SIZES.map((b) => <option key={b} value={b}>{b.replace("kg", "")}kg</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">SKU</label>
            <input className="input" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Cost price</label>
              <input type="number" step="0.01" className="input" required value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
            </div>
            <div>
              <label className="label">Wholesale price</label>
              <input type="number" step="0.01" className="input" required value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} />
            </div>
            <div>
              <label className="label">Low stock level</label>
              <input type="number" className="input" value={form.lowStockLevel} onChange={(e) => setForm({ ...form, lowStockLevel: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-status-red-text">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createProduct.isPending}>Save Product</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

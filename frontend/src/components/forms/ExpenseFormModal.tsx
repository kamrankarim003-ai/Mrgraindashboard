import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../Modal";
import { api, apiErrorMessage } from "../../lib/api";

const CATEGORIES = [
  "stock_purchase", "packaging", "warehouse", "rent", "delivery_fuel",
  "marketing", "staff_wages", "software", "accountant", "bank_fees", "other",
];
const PAYMENT_METHODS = ["bank_transfer", "cash", "card", "other"];

export function ExpenseFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("stock_purchase");
  const [supplierName, setSupplierName] = useState("");
  const [amount, setAmount] = useState("");
  const [gstIncluded, setGstIncluded] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("date", date);
      formData.append("category", category);
      formData.append("supplierName", supplierName);
      formData.append("amount", amount);
      formData.append("gstIncluded", String(gstIncluded));
      formData.append("paymentMethod", paymentMethod);
      formData.append("notes", notes);
      if (receipt) formData.append("receipt", receipt);
      return (await api.post("/expenses", formData, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Expense">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Supplier</label>
          <input className="input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Amount ($)</label>
            <input type="number" step="0.01" min={0} className="input" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Payment method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-brown">
          <input type="checkbox" checked={gstIncluded} onChange={(e) => setGstIncluded(e.target.checked)} />
          GST included in amount
        </label>
        <div>
          <label className="label">Receipt (PDF or image)</label>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setReceipt(e.target.files?.[0] || null)} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="text-sm text-status-red-text">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

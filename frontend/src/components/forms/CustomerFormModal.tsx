import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../Modal";
import { api, apiErrorMessage } from "../../lib/api";

const CUSTOMER_TYPES = ["restaurant", "grocery_store", "supermarket", "distributor", "food_service", "other"];
const LEAD_SOURCES = ["facebook", "instagram", "google_ads", "referral", "walk_in", "phone_call", "email", "whatsapp", "other"];

export function CustomerFormModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    businessName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    suburb: "",
    state: "",
    postcode: "",
    customerType: "restaurant",
    leadSource: "referral",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => (await api.post("/customers", form)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onCreated?.(data.id);
      onClose();
      setForm({ ...form, businessName: "", contactPerson: "", phone: "", email: "", address: "", suburb: "", state: "", postcode: "" });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Customer" wide>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Business name</label>
          <input className="input" required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
        </div>
        <div>
          <label className="label">Contact person</label>
          <input className="input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div>
          <label className="label">Suburb</label>
          <input className="input" value={form.suburb} onChange={(e) => setForm({ ...form, suburb: e.target.value })} />
        </div>
        <div>
          <label className="label">State</label>
          <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </div>
        <div>
          <label className="label">Postcode</label>
          <input className="input" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
        </div>
        <div>
          <label className="label">Customer type</label>
          <select className="input" value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Lead source</label>
          <select className="input" value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value })}>
            {LEAD_SOURCES.map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-status-red-text sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Customer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

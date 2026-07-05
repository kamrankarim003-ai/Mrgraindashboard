import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { Settings } from "../../types";

export function FinanceTab({ settings }: { settings: Settings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    gstRegistered: settings.gstRegistered,
    defaultPaymentTerms: settings.defaultPaymentTerms || "",
    invoicePrefix: settings.invoicePrefix,
    quotePrefix: settings.quotePrefix,
    orderPrefix: settings.orderPrefix,
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({
      gstRegistered: settings.gstRegistered,
      defaultPaymentTerms: settings.defaultPaymentTerms || "",
      invoicePrefix: settings.invoicePrefix,
      quotePrefix: settings.quotePrefix,
      orderPrefix: settings.orderPrefix,
    });
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => (await api.patch("/settings", form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setMessage("Saved. New invoices will use these settings immediately.");
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  return (
    <div className="card space-y-4 max-w-xl">
      <label className="flex items-center gap-2 text-sm text-brown">
        <input type="checkbox" checked={form.gstRegistered} onChange={(e) => setForm({ ...form, gstRegistered: e.target.checked })} />
        GST registered
      </label>
      <div>
        <label className="label">Default payment terms (days)</label>
        <input className="input" value={form.defaultPaymentTerms} onChange={(e) => setForm({ ...form, defaultPaymentTerms: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Invoice prefix</label>
          <input className="input" value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} />
        </div>
        <div>
          <label className="label">Quote prefix</label>
          <input className="input" value={form.quotePrefix} onChange={(e) => setForm({ ...form, quotePrefix: e.target.value })} />
        </div>
        <div>
          <label className="label">Order prefix</label>
          <input className="input" value={form.orderPrefix} onChange={(e) => setForm({ ...form, orderPrefix: e.target.value })} />
        </div>
      </div>
      {message && <p className="text-sm text-brown/70">{message}</p>}
      <button className="btn-primary" disabled={save.isPending} onClick={() => { setMessage(""); save.mutate(); }}>
        Save Changes
      </button>
    </div>
  );
}

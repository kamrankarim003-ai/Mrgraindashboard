import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { Settings } from "../../types";

export function BusinessProfileTab({ settings }: { settings: Settings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    businessName: settings.businessName || "",
    abn: settings.abn || "",
    businessAddress: settings.businessAddress || "",
    businessEmail: settings.businessEmail || "",
    businessPhone: settings.businessPhone || "",
    bankDetails: settings.bankDetails || "",
  });
  const [message, setMessage] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    setForm({
      businessName: settings.businessName || "",
      abn: settings.abn || "",
      businessAddress: settings.businessAddress || "",
      businessEmail: settings.businessEmail || "",
      businessPhone: settings.businessPhone || "",
      bankDetails: settings.bankDetails || "",
    });
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => (await api.patch("/settings", form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setMessage("Saved.");
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const uploadLogo = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("logo", logoFile!);
      return (await api.post("/settings/logo", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  return (
    <div className="card space-y-4 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Business name</label>
          <input className="input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
        </div>
        <div>
          <label className="label">ABN</label>
          <input className="input" value={form.abn} onChange={(e) => setForm({ ...form, abn: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <input className="input" value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} />
        </div>
        <div>
          <label className="label">Business email</label>
          <input className="input" value={form.businessEmail} onChange={(e) => setForm({ ...form, businessEmail: e.target.value })} />
        </div>
        <div>
          <label className="label">Business phone</label>
          <input className="input" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Bank details (shown on invoices)</label>
          <textarea className="input" rows={2} value={form.bankDetails} onChange={(e) => setForm({ ...form, bankDetails: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Logo</label>
          {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" className="h-12 mb-2" />}
          <div className="flex gap-2">
            <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            <button type="button" className="btn-secondary text-xs" disabled={!logoFile || uploadLogo.isPending} onClick={() => uploadLogo.mutate()}>
              Upload
            </button>
          </div>
        </div>
      </div>
      {message && <p className="text-sm text-brown/70">{message}</p>}
      <button className="btn-primary" disabled={save.isPending} onClick={() => { setMessage(""); save.mutate(); }}>
        Save Changes
      </button>
    </div>
  );
}

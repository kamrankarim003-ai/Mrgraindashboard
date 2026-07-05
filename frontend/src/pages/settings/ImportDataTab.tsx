import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, apiErrorMessage, downloadFile } from "../../lib/api";
import { Download } from "lucide-react";

const MODULES = [
  { key: "customers", label: "Customers" },
  { key: "products", label: "Products" },
  { key: "orders", label: "Orders" },
  { key: "expenses", label: "Expenses" },
  { key: "inventory", label: "Inventory (Stock Adjustments)" },
];

interface PreviewRow {
  data: Record<string, string>;
  errors: string[];
}

export function ImportDataTab() {
  const [module, setModule] = useState("customers");
  const [preview, setPreview] = useState<{ headers: string[]; rows: PreviewRow[] } | null>(null);
  const [result, setResult] = useState<{ created: number; errors: { row: number; error: string }[] } | null>(null);
  const [error, setError] = useState("");

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post(`/imports/${module}/preview`, fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: (data) => {
      setPreview(data);
      setResult(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      const validRows = preview!.rows.filter((r) => r.errors.length === 0).map((r) => r.data);
      return (await api.post(`/imports/${module}/commit`, { rows: validRows })).data;
    },
    onSuccess: (data) => {
      setResult(data);
      setPreview(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const validCount = preview?.rows.filter((r) => r.errors.length === 0).length ?? 0;
  const invalidCount = (preview?.rows.length ?? 0) - validCount;

  return (
    <div className="card max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Import into</label>
          <select className="input" value={module} onChange={(e) => { setModule(e.target.value); setPreview(null); setResult(null); }}>
            {MODULES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <button className="btn-secondary text-xs" onClick={() => downloadFile(`/imports/${module}/template`, `${module}-template.xlsx`)}>
          <Download size={14} /> Download Template
        </button>
        <div>
          <label className="label">Upload file</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              setError("");
              const file = e.target.files?.[0];
              if (file) previewMutation.mutate(file);
            }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-status-red-text">{error}</p>}

      {preview && (
        <div className="space-y-3">
          <p className="text-sm text-brown/70">
            {validCount} valid row{validCount === 1 ? "" : "s"} ready to import, {invalidCount} row{invalidCount === 1 ? "" : "s"} with errors (these will be skipped).
          </p>
          <div className="overflow-x-auto max-h-80 overflow-y-auto border border-black/5 rounded-lg">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-brown/60 border-b border-black/5">
                  <th className="p-2">#</th>
                  {preview.headers.map((h) => <th key={h} className="p-2">{h}</th>)}
                  <th className="p-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, idx) => (
                  <tr key={idx} className={`border-b border-black/5 last:border-0 ${r.errors.length > 0 ? "bg-status-red-bg/40" : ""}`}>
                    <td className="p-2">{idx + 1}</td>
                    {preview.headers.map((h) => <td key={h} className="p-2">{r.data[h]}</td>)}
                    <td className="p-2 text-status-red-text">{r.errors.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-primary" disabled={validCount === 0 || commitMutation.isPending} onClick={() => commitMutation.mutate()}>
            Import {validCount} Row{validCount === 1 ? "" : "s"}
          </button>
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-status-green-bg text-status-green-text p-3 text-sm">
          <p>Imported {result.created} row(s) successfully.</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-status-red-text list-disc list-inside">
              {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

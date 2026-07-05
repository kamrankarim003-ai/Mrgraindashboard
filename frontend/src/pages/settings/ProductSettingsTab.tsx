import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { Settings } from "../../types";

function TagList({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((v) => (
          <span key={v} className="badge badge-neutral">
            {v.replace("_", " ")}
            <button onClick={() => onChange(values.filter((x) => x !== v))}><X size={12} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add new..." />
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => {
            if (draft && !values.includes(draft)) onChange([...values, draft]);
            setDraft("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function ProductSettingsTab({ settings }: { settings: Settings }) {
  const queryClient = useQueryClient();
  const [expenseCategories, setExpenseCategories] = useState(settings.expenseCategories);
  const [productTypes, setProductTypes] = useState(settings.productTypes);
  const [message, setMessage] = useState("");

  const save = useMutation({
    mutationFn: async () => (await api.patch("/settings", { expenseCategories, productTypes })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setMessage("Saved.");
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  return (
    <div className="card space-y-6 max-w-xl">
      <TagList label="Expense categories" values={expenseCategories} onChange={setExpenseCategories} />
      <TagList label="Product types" values={productTypes} onChange={setProductTypes} />
      {message && <p className="text-sm text-brown/70">{message}</p>}
      <button className="btn-primary" disabled={save.isPending} onClick={() => { setMessage(""); save.mutate(); }}>
        Save Changes
      </button>
    </div>
  );
}

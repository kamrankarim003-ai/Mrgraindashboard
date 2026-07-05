import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { Settings } from "../../types";

const TEMPLATE_LABELS: Record<string, string> = {
  new_customer_intro: "New Customer Introduction",
  quote_followup: "Quote Follow-up",
  order_confirmation: "Order Confirmation",
  invoice_sent: "Invoice Sent",
  payment_reminder: "Payment Reminder",
  thank_you_payment: "Thank You for Payment",
  delivery_confirmation: "Delivery Confirmation",
  reorder_reminder: "Reorder Reminder",
};

export function EmailTemplatesTab({ settings }: { settings: Settings }) {
  const queryClient = useQueryClient();
  const [activeKey, setActiveKey] = useState(Object.keys(TEMPLATE_LABELS)[0]);
  const [drafts, setDrafts] = useState(settings.emailTemplates);
  const [message, setMessage] = useState("");

  const save = useMutation({
    mutationFn: async () => (await api.patch("/settings", { emailTemplates: drafts })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setMessage("Templates saved.");
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const current = drafts[activeKey] || { subject: "", body: "" };

  return (
    <div className="card max-w-3xl">
      <p className="text-xs text-brown/60 mb-3">
        Placeholders like <code>{"{{customer_name}}"}</code>, <code>{"{{invoice_number}}"}</code>, <code>{"{{amount_due}}"}</code>, <code>{"{{due_date}}"}</code> are replaced automatically when an email is sent.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveKey(key)}
            className={activeKey === key ? "btn-primary !py-1 !px-3 text-xs" : "btn-secondary !py-1 !px-3 text-xs"}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <div>
          <label className="label">Subject</label>
          <input
            className="input"
            value={current.subject}
            onChange={(e) => setDrafts({ ...drafts, [activeKey]: { ...current, subject: e.target.value } })}
          />
        </div>
        <div>
          <label className="label">Body (HTML)</label>
          <textarea
            className="input"
            rows={6}
            value={current.body}
            onChange={(e) => setDrafts({ ...drafts, [activeKey]: { ...current, body: e.target.value } })}
          />
        </div>
      </div>
      {message && <p className="text-sm text-brown/70 mt-3">{message}</p>}
      <button className="btn-primary mt-3" disabled={save.isPending} onClick={() => { setMessage(""); save.mutate(); }}>
        Save Templates
      </button>
    </div>
  );
}

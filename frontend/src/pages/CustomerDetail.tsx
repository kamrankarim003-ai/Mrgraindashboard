import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import { OrderFormModal } from "../components/forms/OrderFormModal";
import { useAuth } from "../context/AuthContext";
import { formatDistanceToNow } from "date-fns";

const STATUSES = ["new_lead", "contacted", "quote_sent", "negotiating", "active_customer", "inactive", "lost"];
const NOTE_TYPES = ["general", "call", "email", "meeting"];

export function CustomerDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"overview" | "notes" | "orders" | "invoices">("overview");
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [showFollowup, setShowFollowup] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [error, setError] = useState("");

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => (await api.get(`/customers/${id}`)).data,
    enabled: !!id,
  });

  const canEdit = can("customers", "edit");

  const addNote = useMutation({
    mutationFn: async () => (await api.post(`/customers/${id}/notes`, { noteText, noteType })).data,
    onSuccess: () => {
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => (await api.patch(`/customers/${id}`, patch)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer", id] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const sendFollowupEmail = useMutation({
    mutationFn: async () => (await api.post(`/customers/${id}/email`, { template: "quote_followup" })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer", id] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (isLoading || !customer) return <p className="text-brown/60">Loading...</p>;

  function handleStatusChange(newStatus: string) {
    setError("");
    if (newStatus === "lost") {
      setShowLostModal(true);
      return;
    }
    updateCustomer.mutate({ status: newStatus });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl">{customer.businessName}</h1>
            <p className="text-sm text-brown/60">{customer.contactPerson} · {customer.phone} · {customer.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge value={customer.status} />
              <span className="text-xs text-brown/50">{customer.customerType.replace("_", " ")}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <button className="btn-secondary text-xs" onClick={() => setTab("notes")}>Log Note</button>
                <button className="btn-secondary text-xs" onClick={() => setShowFollowup(true)}>Set Follow-up</button>
                {customer.email && (
                  <button className="btn-secondary text-xs" disabled={sendFollowupEmail.isPending} onClick={() => sendFollowupEmail.mutate()}>
                    Send Follow-up Email
                  </button>
                )}
                <button className="btn-primary text-xs" onClick={() => setShowOrderForm(true)}>Create Order</button>
              </>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="mt-4 flex items-center gap-3">
            <label className="label !mb-0">Status</label>
            <select className="input max-w-xs" value={customer.status} onChange={(e) => handleStatusChange(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
            {error && <p className="text-sm text-status-red-text">{error}</p>}
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-black/10">
        {(["overview", "notes", "orders", "invoices"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px ${tab === t ? "border-gold text-brown font-medium" : "border-transparent text-brown/50"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="card grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Field label="Address" value={`${customer.address || ""} ${customer.suburb || ""} ${customer.state || ""} ${customer.postcode || ""}`} />
          <Field label="Lead Source" value={customer.leadSource?.replace("_", " ")} />
          <Field label="Interest Level" value={customer.interestLevel} />
          <Field label="Assigned To" value={customer.assignedUser?.name || "Unassigned"} />
          <Field label="Next Follow-up" value={customer.nextFollowupAt ? new Date(customer.nextFollowupAt).toLocaleDateString() : "-"} />
          <Field label="Last Contacted" value={customer.lastContactedAt ? new Date(customer.lastContactedAt).toLocaleDateString() : "-"} />
          {customer.lostReason && <Field label="Lost Reason" value={customer.lostReason} />}
          <div className="sm:col-span-2">
            <p className="label">Notes</p>
            <p className="text-ink">{customer.notes || "No data yet"}</p>
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div className="card space-y-4">
          {canEdit && (
            <div className="space-y-2">
              <textarea className="input" rows={2} placeholder="Add a note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              <div className="flex items-center gap-2">
                <select className="input max-w-[140px]" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
                  {NOTE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button className="btn-primary text-xs" disabled={!noteText || addNote.isPending} onClick={() => addNote.mutate()}>
                  Add Note
                </button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {(() => {
              const noteEvents = (customer.customerNotes || []).map((n: any) => ({
                id: `note-${n.id}`,
                createdAt: n.createdAt,
                render: (
                  <>
                    <p className="text-sm text-ink">{n.noteText}</p>
                    <p className="text-xs text-brown/50 mt-1">
                      {n.user?.name} · {n.noteType} · {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </>
                ),
              }));
              const emailEvents = (customer.emailLogs || []).map((e: any) => ({
                id: `email-${e.id}`,
                createdAt: e.createdAt,
                render: (
                  <>
                    <p className="text-sm text-ink">Email sent: "{e.subject}"</p>
                    <p className="text-xs text-brown/50 mt-1">
                      {e.sender?.name || "System"} · {e.status} · {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                    </p>
                  </>
                ),
              }));
              const events = [...noteEvents, ...emailEvents].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              if (events.length === 0) return <p className="text-brown/50 text-sm">No notes yet</p>;
              return events.map((e) => (
                <div key={e.id} className="border-b border-black/5 pb-3">
                  {e.render}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="card">
          {customer.orders?.length === 0 ? (
            <p className="text-brown/50 text-sm text-center py-6">No data yet</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {customer.orders?.map((o: any) => (
                <li key={o.id} className="py-2 flex justify-between items-center text-sm">
                  <Link to={`/orders/${o.id}`} className="text-ink hover:text-gold-dark">{o.orderNumber}</Link>
                  <StatusBadge value={o.orderStatus} />
                  <span className="font-medium">${Number(o.totalValue).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "invoices" && (
        <div className="card">
          {customer.invoices?.length === 0 ? (
            <p className="text-brown/50 text-sm text-center py-6">No data yet</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {customer.invoices?.map((i: any) => (
                <li key={i.id} className="py-2 flex justify-between items-center text-sm">
                  <Link to={`/invoices/${i.id}`} className="text-ink hover:text-gold-dark">{i.invoiceNumber}</Link>
                  <StatusBadge value={i.status} />
                  <span className="font-medium">${Number(i.totalAmount).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={showFollowup} onClose={() => setShowFollowup(false)} title="Set Follow-up Date">
        <div className="space-y-4">
          <input type="date" className="input" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowFollowup(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() => {
                updateCustomer.mutate({ nextFollowupAt: followupDate });
                setShowFollowup(false);
              }}
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showLostModal} onClose={() => setShowLostModal(false)} title="Mark as Lost">
        <div className="space-y-4">
          <div>
            <label className="label">Reason</label>
            <textarea className="input" rows={2} value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowLostModal(false)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={!lostReason}
              onClick={() => {
                updateCustomer.mutate({ status: "lost", lostReason });
                setShowLostModal(false);
                setLostReason("");
              }}
            >
              Confirm Lost
            </button>
          </div>
        </div>
      </Modal>

      <OrderFormModal open={showOrderForm} onClose={() => setShowOrderForm(false)} presetCustomerId={id} />
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="text-ink">{value || "-"}</p>
    </div>
  );
}

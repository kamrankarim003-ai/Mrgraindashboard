import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage, downloadFile } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { Download, Mail } from "lucide-react";

const PAYMENT_METHODS = ["bank_transfer", "cash", "card", "other"];

export function InvoiceDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [referenceNote, setReferenceNote] = useState("");
  const [error, setError] = useState("");
  const [emailStatus, setEmailStatus] = useState("");

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => (await api.get(`/invoices/${id}`)).data,
    enabled: !!id,
  });

  const recordPayment = useMutation({
    mutationFn: async () =>
      (await api.post("/payments", { invoiceId: id, amount: Number(amount), paymentDate, paymentMethod, referenceNote })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      setShowPayment(false);
      setAmount("");
      setReferenceNote("");
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const sendEmail = useMutation({
    mutationFn: async () => (await api.post(`/invoices/${id}/email`, { template: "invoice_sent" })).data,
    onSuccess: (data) => {
      setEmailStatus(data.status === "sent" ? "Email sent." : "Email failed to send.");
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    },
    onError: (err) => setEmailStatus(apiErrorMessage(err)),
  });

  if (isLoading || !invoice) return <p className="text-brown/60">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl">{invoice.invoiceNumber}</h1>
            <p className="text-sm text-brown/60">
              <Link to={`/customers/${invoice.customerId}`} className="hover:text-gold-dark">{invoice.customer?.businessName}</Link>
              {invoice.orderId && (
                <>
                  {" · "}
                  <Link to={`/orders/${invoice.orderId}`} className="hover:text-gold-dark">View Order</Link>
                </>
              )}
            </p>
            <div className="mt-2"><StatusBadge value={invoice.status} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary text-xs" onClick={() => downloadFile(`/invoices/${id}/pdf`, `${invoice.invoiceNumber}.pdf`)}>
              <Download size={14} /> Download PDF
            </button>
            {can("invoices", "edit") && invoice.customer?.email !== null && (
              <button className="btn-secondary text-xs" disabled={sendEmail.isPending} onClick={() => sendEmail.mutate()}>
                <Mail size={14} /> Email to Customer
              </button>
            )}
            {can("payments", "create") && invoice.balanceDue > 0 && (
              <button className="btn-primary text-xs" onClick={() => setShowPayment(true)}>Record Payment</button>
            )}
          </div>
        </div>
        {emailStatus && <p className="text-sm text-brown/70 mt-2">{emailStatus}</p>}
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-brown/60 border-b border-black/5">
              <th className="pb-2">Description</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Unit Price</th>
              <th className="pb-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item: any) => (
              <tr key={item.id} className="border-b border-black/5 last:border-0">
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">${Number(item.unitPrice).toFixed(2)}</td>
                <td className="py-2 text-right">${Number(item.subtotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end mt-4">
          <div className="text-sm space-y-1 text-right">
            <p className="text-brown/60">Subtotal: ${Number(invoice.subtotal).toFixed(2)}</p>
            {Number(invoice.gstAmount) > 0 && <p className="text-brown/60">GST: ${Number(invoice.gstAmount).toFixed(2)}</p>}
            <p className="text-lg font-semibold text-ink">Total: ${Number(invoice.totalAmount).toFixed(2)}</p>
            <p className="text-brown/60">Paid: ${Number(invoice.amountPaid).toFixed(2)}</p>
            <p className="font-semibold text-gold-dark">Balance Due: ${Number(invoice.balanceDue).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg mb-3">Payments</h2>
        {invoice.payments?.length === 0 ? (
          <p className="text-brown/50 text-sm">No data yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brown/60 border-b border-black/5">
                <th className="pb-2">Date</th>
                <th className="pb-2">Method</th>
                <th className="pb-2">Reference</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments?.map((p: any) => (
                <tr key={p.id} className="border-b border-black/5 last:border-0">
                  <td className="py-2">{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td className="py-2">{p.paymentMethod.replace("_", " ")}</td>
                  <td className="py-2">{p.referenceNote || "-"}</td>
                  <td className="py-2 text-right">${Number(p.amount).toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <button className="text-gold-dark hover:underline text-xs" onClick={() => downloadFile(`/payments/${p.id}/receipt.pdf`, `receipt-${invoice.invoiceNumber}.pdf`)}>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showPayment} onClose={() => setShowPayment(false)} title="Record Payment">
        <div className="space-y-4">
          <div>
            <label className="label">Amount ($)</label>
            <input type="number" step="0.01" min={0} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Reference note</label>
            <input className="input" value={referenceNote} onChange={(e) => setReferenceNote(e.target.value)} />
          </div>
          {error && <p className="text-sm text-status-red-text">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowPayment(false)}>Cancel</button>
            <button className="btn-primary" disabled={recordPayment.isPending || !amount} onClick={() => { setError(""); recordPayment.mutate(); }}>
              Record Payment
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

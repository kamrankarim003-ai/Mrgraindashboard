import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../Modal";
import { api, apiErrorMessage } from "../../lib/api";
import { UserAccount } from "../../types";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const RECURRENCE = ["none", "daily", "weekly", "monthly"];

export function TaskFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const { data: users = [] } = useQuery<UserAccount[]>({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.post("/tasks", {
          title,
          description: description || undefined,
          assignedTo: assignedTo || undefined,
          priority,
          dueDate: dueDate || undefined,
          recurrence,
          notes: notes || undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
      setTitle("");
      setDescription("");
      setNotes("");
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Title</label>
          <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Assign to</label>
            <select className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Due date</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Recurrence</label>
            <select className="input" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              {RECURRENCE.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="text-sm text-status-red-text">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

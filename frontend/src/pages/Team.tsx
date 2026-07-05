import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { UserAccount } from "../types";
import { Modal } from "../components/Modal";
import { formatDistanceToNow } from "date-fns";

export function Team() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"users" | "activity">("users");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", roleId: "" });
  const [error, setError] = useState("");

  const { data: users = [] } = useQuery<UserAccount[]>({ queryKey: ["users"], queryFn: async () => (await api.get("/users")).data });
  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: async () => (await api.get("/users/roles")).data });
  const { data: activity = [] } = useQuery({
    queryKey: ["activity"],
    queryFn: async () => (await api.get("/activity")).data,
    enabled: tab === "activity",
  });

  const createUser = useMutation({
    mutationFn: async () => (await api.post("/users", { ...form, roleId: Number(form.roleId) })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowForm(false);
      setForm({ name: "", email: "", phone: "", password: "", roleId: "" });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => (await api.patch(`/users/${id}`, { isActive })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, roleId }: { id: string; roleId: number }) => (await api.patch(`/users/${id}`, { roleId })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    createUser.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Team</h1>
        {tab === "users" && <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add User</button>}
      </div>

      <div className="flex gap-2 border-b border-black/10">
        {(["users", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px ${tab === t ? "border-gold text-brown font-medium" : "border-transparent text-brown/50"}`}
          >
            {t === "users" ? "Users & Roles" : "Activity Log"}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-brown/60 border-b border-black/5">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Last Login</th>
                <th className="pb-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-black/5 last:border-0">
                  <td className="py-2 pr-4 font-medium">{u.name}</td>
                  <td className="py-2 pr-4 text-brown/70">{u.email}</td>
                  <td className="py-2 pr-4">
                    <select
                      className="input !py-1 text-xs max-w-[140px]"
                      value={u.roleId}
                      onChange={(e) => changeRole.mutate({ id: u.id, roleId: Number(e.target.value) })}
                    >
                      {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`badge ${u.isActive ? "badge-green" : "badge-red"}`}>{u.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="py-2 pr-4 text-brown/70">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                  <td className="py-2 pr-4">
                    <button
                      className="text-xs text-gold-dark hover:underline"
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                    >
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          {activity.length === 0 ? (
            <p className="text-brown/60 text-center py-8">No data yet</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {activity.map((a: any) => (
                <li key={a.id} className="py-2 text-sm flex justify-between gap-4">
                  <span>
                    <span className="font-medium text-ink">{a.user?.name || "System"}</span>{" "}
                    <span className="text-brown/70">{a.details || a.action}</span>
                  </span>
                  <span className="text-xs text-brown/50 shrink-0">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add User">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Temporary password</label>
            <input type="password" className="input" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              <option value="">Select role...</option>
              {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-status-red-text">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createUser.isPending}>Create User</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

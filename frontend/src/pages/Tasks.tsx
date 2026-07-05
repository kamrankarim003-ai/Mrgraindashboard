import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { TaskItem } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { TaskFormModal } from "../components/forms/TaskFormModal";

const STATUSES = ["not_started", "in_progress", "waiting", "completed", "cancelled"];

function isOverdue(task: TaskItem) {
  return task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString()) && task.status !== "completed" && task.status !== "cancelled";
}

export function Tasks() {
  const { user, can } = useAuth();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: tasks = [], isLoading } = useQuery<TaskItem[]>({
    queryKey: ["tasks", scope, status],
    queryFn: async () => (await api.get("/tasks", { params: { scope, status: status || undefined } })).data,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => (await api.patch(`/tasks/${id}`, { status: newStatus })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Tasks</h1>
        {can("tasks", "create") && <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Task</button>}
      </div>

      <div className="card flex flex-wrap gap-3">
        {user?.roleName === "Owner" && (
          <div className="flex gap-2">
            <button className={scope === "mine" ? "btn-primary !py-1.5 !px-3 text-xs" : "btn-secondary !py-1.5 !px-3 text-xs"} onClick={() => setScope("mine")}>My Tasks</button>
            <button className={scope === "all" ? "btn-primary !py-1.5 !px-3 text-xs" : "btn-secondary !py-1.5 !px-3 text-xs"} onClick={() => setScope("all")}>All Tasks</button>
          </div>
        )}
        <select className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-brown/60">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="text-brown/60 text-center py-8">No data yet</p>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-brown/60 border-b border-black/5">
                <th className="pb-2 pr-4">Title</th>
                <th className="pb-2 pr-4">Assigned To</th>
                <th className="pb-2 pr-4">Priority</th>
                <th className="pb-2 pr-4">Due Date</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-black/5 last:border-0 hover:bg-cream/60">
                  <td className="py-2 pr-4 font-medium text-ink">{t.title}</td>
                  <td className="py-2 pr-4 text-brown/70">{t.assignee?.name || "-"}</td>
                  <td className="py-2 pr-4"><StatusBadge value={t.priority} /></td>
                  <td className="py-2 pr-4">
                    <span className={isOverdue(t) ? "text-status-red-text font-medium" : "text-brown/70"}>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "-"}
                    </span>
                  </td>
                  <td className="py-2 pr-4"><StatusBadge value={t.status} /></td>
                  <td className="py-2 pr-4">
                    {t.status !== "completed" && t.status !== "cancelled" && (
                      <button
                        className="text-xs text-gold-dark hover:underline"
                        onClick={() => updateStatus.mutate({ id: t.id, newStatus: "completed" })}
                      >
                        Mark Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TaskFormModal open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}

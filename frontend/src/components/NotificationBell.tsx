import { useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Notification } from "../types";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data,
    refetchInterval: 60000,
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  async function markAllRead() {
    await api.post("/notifications/read-all");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative">
      <button className="relative text-brown hover:bg-black/5 rounded-lg p-2" onClick={() => setOpen((o) => !o)}>
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-status-red-text text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-xl border border-black/5 z-20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
              <span className="font-medium text-brown text-sm">Notifications</span>
              <button onClick={markAllRead} className="text-xs text-gold-dark hover:underline">
                Mark all read
              </button>
            </div>
            {notifications.length === 0 && (
              <p className="text-sm text-brown/50 px-4 py-6 text-center">No notifications yet</p>
            )}
            {notifications.map((n) => (
              <div key={n.id} className={`px-4 py-3 border-b border-black/5 text-sm ${n.isRead ? "" : "bg-cream/60"}`}>
                <p className="text-ink">{n.message}</p>
                <p className="text-xs text-brown/50 mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const GREEN = new Set([
  "active_customer", "paid", "completed", "delivered", "confirmed", "not_started_ok",
]);
const AMBER = new Set([
  "new_lead", "contacted", "quote_sent", "negotiating", "draft", "packed", "dispatched",
  "unpaid", "deposit_paid", "partially_paid", "sent", "viewed", "in_progress", "waiting", "not_started",
]);
const RED = new Set(["overdue", "lost", "inactive", "cancelled", "urgent", "high"]);

function toneFor(value: string): "green" | "amber" | "red" | "neutral" {
  if (GREEN.has(value)) return "green";
  if (RED.has(value)) return "red";
  if (AMBER.has(value)) return "amber";
  return "neutral";
}

function labelFor(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusBadge({ value, tone }: { value: string; tone?: "green" | "amber" | "red" | "neutral" }) {
  const resolved = tone ?? toneFor(value);
  return <span className={`badge badge-${resolved}`}>{labelFor(value)}</span>;
}

import { ReactNode } from "react";

type Tone = "neutral" | "green" | "amber" | "red";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink",
  green: "text-status-green-text",
  amber: "text-status-amber-text",
  red: "text-status-red-text",
};

export function StatCard({
  label,
  value,
  tone = "neutral",
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  sub?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-brown/60 uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className={`text-2xl font-semibold mt-2 ${TONE_TEXT[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-brown/50 mt-1">{sub}</p>}
    </div>
  );
}

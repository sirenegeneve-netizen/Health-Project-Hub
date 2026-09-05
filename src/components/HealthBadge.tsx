import type { HealthLevel } from "@/lib/healthScore";

const STYLES: Record<HealthLevel, string> = {
  vert: "bg-ok/10 text-ok border-ok/30",
  orange: "bg-warn/10 text-warn border-warn/30",
  rouge: "bg-bad/10 text-bad border-bad/30",
};

const DOT: Record<HealthLevel, string> = {
  vert: "bg-ok",
  orange: "bg-warn",
  rouge: "bg-bad",
};

export function HealthBadge({ level, label }: { level: HealthLevel; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 border rounded-full px-3 py-1 text-sm font-medium ${STYLES[level]}`}
    >
      <span className={`w-2 h-2 rounded-full ${DOT[level]}`} />
      {label}
    </span>
  );
}

import type { HealthLevel } from "@/lib/healthScore";

const TEXT: Record<HealthLevel, string> = {
  vert: "text-ok",
  orange: "text-warn",
  rouge: "text-bad",
};

const DOT: Record<HealthLevel, string> = {
  vert: "bg-ok",
  orange: "bg-warn",
  rouge: "bg-bad",
};

export function HealthBadge({ level, label }: { level: HealthLevel; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${TEXT[level]}`}>
      <span className={`w-2 h-2 rounded-full ${DOT[level]}`} />
      {label}
    </span>
  );
}

export function HealthBar({ level }: { level: HealthLevel }) {
  const bg = level === "vert" ? "bg-ok" : level === "orange" ? "bg-warn" : "bg-bad";
  return <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${bg}`} aria-hidden />;
}

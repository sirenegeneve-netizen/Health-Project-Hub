import type { LucideIcon } from "lucide-react";

const PALETTES: Record<string, { bg: string; fg: string }> = {
  primary: { bg: "bg-primary-50", fg: "text-primary" },
  blue: { bg: "bg-blue-50", fg: "text-blue" },
  red: { bg: "bg-bad/10", fg: "text-bad" },
  orange: { bg: "bg-warn/10", fg: "text-warn" },
  purple: { bg: "bg-purple-50", fg: "text-purple" },
  neutral: { bg: "bg-ink/5", fg: "text-ink/70" },
  green: { bg: "bg-ok/10", fg: "text-ok" },
};

export function IconBadge({ color, icon: Icon }: { color: keyof typeof PALETTES; icon: LucideIcon }) {
  const p = PALETTES[color];
  return (
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.bg} ${p.fg}`}>
      <Icon size={18} strokeWidth={1.8} />
    </div>
  );
}

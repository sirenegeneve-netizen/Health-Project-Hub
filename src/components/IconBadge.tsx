const PALETTES: Record<string, { bg: string; fg: string }> = {
  blue: { bg: "bg-blue-50", fg: "text-blue" },
  red: { bg: "bg-bad/10", fg: "text-bad" },
  orange: { bg: "bg-clay-50", fg: "text-clay" },
  purple: { bg: "bg-purple-50", fg: "text-purple" },
  teal: { bg: "bg-teal-50", fg: "text-teal-600" },
  green: { bg: "bg-ok/10", fg: "text-ok" },
};

export function IconBadge({ color, children }: { color: keyof typeof PALETTES; children: React.ReactNode }) {
  const p = PALETTES[color];
  return <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.bg} ${p.fg}`}>{children}</div>;
}

export function IconBriefcase() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="2.5" y="6.5" width="15" height="10" rx="1.8" />
      <path d="M7 6.5V5a2 2 0 012-2h2a2 2 0 012 2v1.5M2.5 11h15" strokeLinecap="round" />
    </svg>
  );
}
export function IconAlert() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M10 2l8 14H2l8-14z" strokeLinejoin="round" />
      <path d="M10 8.5v3.2M10 14.5h.01" strokeLinecap="round" />
    </svg>
  );
}
export function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="10" cy="10" r="7.3" />
      <path d="M10 6v4l2.6 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconEuro() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M14 5.5a5.6 5.6 0 100 9M4.5 8.5h7M4.5 11.5h6" strokeLinecap="round" />
    </svg>
  );
}

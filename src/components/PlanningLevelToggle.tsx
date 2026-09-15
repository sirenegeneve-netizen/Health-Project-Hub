import Link from "next/link";

export function PlanningLevelToggle({ level }: { level: "simple" | "detaille" }) {
  return (
    <div className="inline-flex rounded-full border border-line p-0.5 mb-4">
      <Link
        href="/roadmap"
        className={`px-3 py-1 text-xs rounded-full transition-colors ${level === "simple" ? "bg-primary text-white" : "text-ink/60 hover:text-blue"}`}
      >
        Vue simple
      </Link>
      <Link
        href="/calendar"
        className={`px-3 py-1 text-xs rounded-full transition-colors ${level === "detaille" ? "bg-primary text-white" : "text-ink/60 hover:text-blue"}`}
      >
        Vue détaillée
      </Link>
    </div>
  );
}

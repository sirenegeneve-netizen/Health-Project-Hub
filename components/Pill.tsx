export function Pill({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "ok" | "warn" | "bad" }) {
  const styles: Record<string, string> = {
    neutral: "bg-ink/5 text-ink/70",
    ok: "bg-ok/10 text-ok",
    warn: "bg-warn/10 text-warn",
    bad: "bg-bad/10 text-bad",
  };
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[tone]}`}>{text}</span>;
}

export function statusTone(status: string): "neutral" | "ok" | "warn" | "bad" {
  if (["termine", "valide", "decision_prise", "corrigee", "validee", "maitrise", "cloture"].includes(status)) return "ok";
  if (["en_retard", "bloquant", "critique", "arbitrage_necessaire", "ouverte"].includes(status)) return "bad";
  if (["en_cours", "en_attente", "en_traitement", "en_correction", "en_test"].includes(status)) return "warn";
  return "neutral";
}

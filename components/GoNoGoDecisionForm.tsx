"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GoNoGoDecisionForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState("GO");
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await fetch("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        subject: "Go/No Go déploiement",
        decision,
        context: justification,
        status: "decision_prise",
        date: new Date().toISOString(),
      }),
    });
    setSaving(false);
    setJustification("");
    router.refresh();
  }

  return (
    <div className="card mt-4 space-y-3">
      <div className="font-medium">Enregistrer la décision Go/No Go</div>
      <div className="flex gap-3">
        {["GO", "GO sous conditions", "NO GO"].map((v) => (
          <label key={v} className="flex items-center gap-1.5 text-sm">
            <input type="radio" name="gonogo" checked={decision === v} onChange={() => setDecision(v)} />
            {v}
          </label>
        ))}
      </div>
      <textarea
        className="input"
        rows={2}
        placeholder="Justification (toute décision doit être justifiée et historisée)"
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
      />
      <button className="btn" onClick={submit} disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer la décision"}
      </button>
    </div>
  );
}

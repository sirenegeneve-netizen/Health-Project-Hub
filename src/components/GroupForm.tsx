"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GroupForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button className="btn mb-4" onClick={() => setOpen(true)}>
        + Nouveau groupe
      </button>
    );
  }

  return (
    <div className="card mb-4 space-y-3">
      <label className="block">
        <div className="label mb-1">Nom du groupe</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : CH Alpha Santé" autoFocus />
      </label>
      <div className="flex gap-2">
        <button
          className="btn"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await fetch("/api/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
              });
              setOpen(false);
              setName("");
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}

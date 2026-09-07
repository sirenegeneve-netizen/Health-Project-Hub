"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pill } from "@/components/Pill";

const COLUMNS: [string, string][] = [
  ["a_faire", "À faire"],
  ["en_cours", "En cours"],
  ["en_attente", "Bloqué"],
  ["termine", "Terminé"],
];

export interface KanbanAction {
  id: string;
  title: string;
  responsable: string | null;
  echeance: string | null;
  priority: string;
  status: string;
  projectName?: string;
}

export function ActionsKanban({ actions }: { actions: KanbanAction[] }) {
  const router = useRouter();
  const [items, setItems] = useState(actions);
  const [dragId, setDragId] = useState<string | null>(null);
  const now = new Date();

  async function moveTo(id: string, status: string) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {COLUMNS.map(([status, label]) => {
        const colItems = items.filter((a) => a.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) moveTo(dragId, status);
            }}
            className="bg-ink/[0.03] rounded-card p-3 min-h-[120px]"
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm font-medium text-body">{label}</span>
              <span className="text-xs text-muted">{colItems.length}</span>
            </div>
            <div className="space-y-2">
              {colItems.map((a) => {
                const late = a.echeance && new Date(a.echeance) < now && status !== "termine";
                return (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={() => setDragId(a.id)}
                    onDragEnd={() => setDragId(null)}
                    className="card cursor-grab active:cursor-grabbing p-3"
                  >
                    <div className="text-sm font-medium text-ink">{a.title}</div>
                    {a.projectName && <div className="text-xs text-muted mt-0.5">{a.projectName}</div>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted">{a.responsable || "—"}</span>
                      {a.echeance && (
                        <span className={`text-xs ${late ? "text-bad font-medium" : "text-muted"}`}>
                          {new Date(a.echeance).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    {a.priority === "critique" && <Pill text="critique" tone="bad" />}
                  </div>
                );
              })}
              {colItems.length === 0 && <div className="text-xs text-muted/70 text-center py-4">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

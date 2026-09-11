import { computeActorWorkload, type ActorLike, type RaciLike, type WorkloadInputs } from "@/lib/resourceGovernance";

// Détection "au mieux" des conflits interprojets pour la Phase 2.
// LIMITE CONNUE (cf. diagnostic F.1) : les acteurs sont aujourd'hui rattachés à un
// projet, pas à une identité globale — le rapprochement se fait donc par nom
// normalisé. Fiable pour repérer un signal, pas pour un calcul de charge exact ;
// ce sera refondu en Phase 4 avec une vraie notion de ressource transverse.

export interface ResourceConflict {
  name: string;
  combinedWorkload: number;
  level: "orange" | "rouge";
  initiatives: { id: string; name: string; workload: number }[];
}

const norm = (s: string) => s.trim().toLowerCase();

export function detectResourceConflicts(
  initiatives: {
    id: string;
    name: string;
    status: string;
    actors: ActorLike[];
    workloadInputs: WorkloadInputs;
    raciEntries: RaciLike[];
  }[]
): ResourceConflict[] {
  const byName = new Map<string, { name: string; initiatives: { id: string; name: string; workload: number }[] }>();

  for (const initiative of initiatives) {
    if (initiative.status !== "actif") continue;
    for (const actor of initiative.actors) {
      const key = norm(actor.name);
      if (!key) continue;
      const workload = computeActorWorkload(actor, initiative.workloadInputs, initiative.raciEntries).totalOwned;
      if (workload === 0) continue;
      if (!byName.has(key)) byName.set(key, { name: actor.name, initiatives: [] });
      byName.get(key)!.initiatives.push({ id: initiative.id, name: initiative.name, workload });
    }
  }

  const conflicts: ResourceConflict[] = [];
  for (const entry of byName.values()) {
    if (entry.initiatives.length < 2) continue;
    const combinedWorkload = entry.initiatives.reduce((s, p) => s + p.workload, 0);
    if (combinedWorkload < 4) continue;
    conflicts.push({
      name: entry.name,
      combinedWorkload,
      level: combinedWorkload >= 8 ? "rouge" : "orange",
      initiatives: entry.initiatives.sort((a, b) => b.workload - a.workload),
    });
  }

  return conflicts.sort((a, b) => b.combinedWorkload - a.combinedWorkload);
}

export interface ScheduleConflict {
  establishmentName: string;
  initiatives: { id: string; name: string; targetDate: string }[];
}

// Deux projets actifs du même établissement avec une échéance à moins de 21 jours
// d'écart : bascules qui risquent de se percuter (formation, hypercare, disponibilité
// des équipes métier de l'établissement).
export function detectScheduleConflicts(
  initiatives: { id: string; name: string; status: string; targetDate: Date | null; establishments: { id: string; name: string }[] }[]
): ScheduleConflict[] {
  const byEstablishment = new Map<string, { name: string; entries: { id: string; name: string; targetDate: Date }[] }>();

  for (const p of initiatives) {
    if (p.status !== "actif" || !p.targetDate) continue;
    for (const est of p.establishments) {
      if (!byEstablishment.has(est.id)) byEstablishment.set(est.id, { name: est.name, entries: [] });
      byEstablishment.get(est.id)!.entries.push({ id: p.id, name: p.name, targetDate: p.targetDate });
    }
  }

  const conflicts: ScheduleConflict[] = [];
  for (const { name: establishmentName, entries } of byEstablishment.values()) {
    if (entries.length < 2) continue;
    const sorted = [...entries].sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapDays = Math.round((sorted[i + 1].targetDate.getTime() - sorted[i].targetDate.getTime()) / (1000 * 60 * 60 * 24));
      if (gapDays <= 21) {
        conflicts.push({
          establishmentName,
          initiatives: [sorted[i], sorted[i + 1]].map((p) => ({ id: p.id, name: p.name, targetDate: p.targetDate.toISOString() })),
        });
      }
    }
  }
  return conflicts;
}

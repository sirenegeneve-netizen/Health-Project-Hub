export interface ActorLike {
  id: string;
  name: string;
  roleProjet: string | null;
  disponibiliteJh: number | null;
}

export interface RaciLike {
  actorId: string;
  activite: string;
  role: string;
}

export interface WorkloadInputs {
  actions: { responsable: string | null; status: string }[];
  risks: { proprietaire: string | null; status: string }[];
  interfaces: { responsable: string | null; status: string }[];
  deliverables: { responsable: string | null; status: string }[];
}

export interface ActorWorkload {
  openActions: number;
  ownedRisks: number;
  ownedInterfaces: number;
  ownedDeliverables: number;
  totalOwned: number;
  raci: { R: number; A: number; C: number; I: number };
}

const norm = (s: string | null) => (s || "").trim().toLowerCase();

export function computeActorWorkload(actor: ActorLike, data: WorkloadInputs, raciEntries: RaciLike[]): ActorWorkload {
  const n = norm(actor.name);
  const openActions = data.actions.filter((a) => norm(a.responsable) === n && !["termine", "abandonne"].includes(a.status)).length;
  const ownedRisks = data.risks.filter((r) => norm(r.proprietaire) === n && !["maitrise", "cloture"].includes(r.status)).length;
  const ownedInterfaces = data.interfaces.filter((i) => norm(i.responsable) === n && i.status !== "valide").length;
  const ownedDeliverables = data.deliverables.filter((d) => norm(d.responsable) === n && d.status !== "valide").length;

  const raci = { R: 0, A: 0, C: 0, I: 0 };
  for (const entry of raciEntries) {
    if (entry.actorId === actor.id && entry.role in raci) {
      raci[entry.role as keyof typeof raci]++;
    }
  }

  return {
    openActions,
    ownedRisks,
    ownedInterfaces,
    ownedDeliverables,
    totalOwned: openActions + ownedRisks + ownedInterfaces + ownedDeliverables,
    raci,
  };
}

// Dépendance critique : activité RACI où un seul acteur porte le rôle "R" (bus factor).
export function findSinglePointsOfFailure(raciEntries: RaciLike[], actorsById: Map<string, string>): { activite: string; actorName: string }[] {
  const byActivite = new Map<string, RaciLike[]>();
  for (const entry of raciEntries) {
    if (entry.role !== "R") continue;
    if (!byActivite.has(entry.activite)) byActivite.set(entry.activite, []);
    byActivite.get(entry.activite)!.push(entry);
  }
  const result: { activite: string; actorName: string }[] = [];
  for (const [activite, entries] of byActivite) {
    if (entries.length === 1) {
      const name = actorsById.get(entries[0].actorId);
      if (name) result.push({ activite, actorName: name });
    }
  }
  return result;
}

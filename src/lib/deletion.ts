import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { can, getUserAssignments } from "@/lib/authz";
import { GLOBAL_SCOPE_ID, type PermissionAction, type ScopeType } from "@/lib/roles";
import { logAudit, truncateLabel } from "@/lib/audit";
import {
  deleteEstablishmentData,
  deleteGroupData,
  deleteInitiativeData,
  deleteSimpleData,
  previewDeletion,
  type DeletionSummary,
  type SimpleKind,
} from "@/lib/deletionCore";

export type DeleteKind = "group" | "establishment" | "initiative" | SimpleKind;

export const DELETE_KINDS: DeleteKind[] = ["group", "establishment", "initiative", "risk", "action", "decision", "document", "meeting", "kpi"];

type Resolved = { label: string; entityType: string; scope: { type: ScopeType; id: string } | null; permission: PermissionAction };

// Retrouve l'objet, son libellé (pour le journal) et son périmètre d'autorisation.
// Les objets "possédés" (risque, action, décision, document) se rattachent à une
// initiative OU, via ownerType/ownerId, à un groupe/établissement.
function ownerScope(o: { initiativeId: string | null; ownerType: string; ownerId: string | null }): Resolved["scope"] {
  if (o.ownerType === "groupe" && o.ownerId) return { type: "groupe", id: o.ownerId };
  if (o.ownerType === "etablissement" && o.ownerId) return { type: "etablissement", id: o.ownerId };
  const initiativeId = o.initiativeId ?? (o.ownerType === "initiative" ? o.ownerId : null);
  return initiativeId ? { type: "initiative", id: initiativeId } : null;
}

async function resolve(kind: DeleteKind, id: string): Promise<Resolved | null> {
  switch (kind) {
    case "group": {
      const g = await prisma.group.findUnique({ where: { id }, select: { name: true } });
      // Structure : même règle que la création/édition de structure (administrateur).
      return g && { label: g.name, entityType: "group", scope: { type: "groupe", id }, permission: "gererStructure" };
    }
    case "establishment": {
      const e = await prisma.establishment.findUnique({ where: { id }, select: { name: true, groupId: true } });
      // Un administrateur de groupe couvre ses établissements ; l'affectation
      // "établissement" seule ne suffit pas (gererStructure est réservé admin).
      return e && { label: e.name, entityType: "establishment", scope: { type: "etablissement", id }, permission: "gererStructure" };
    }
    case "initiative": {
      const i = await prisma.initiative.findUnique({ where: { id }, select: { name: true } });
      return i && { label: i.name, entityType: "initiative", scope: { type: "initiative", id }, permission: "supprimer" };
    }
    case "risk": {
      const r = await prisma.risk.findUnique({ where: { id } });
      return r && { label: r.description, entityType: "risk", scope: ownerScope(r), permission: "supprimer" };
    }
    case "action": {
      const a = await prisma.action.findUnique({ where: { id } });
      return a && { label: a.title, entityType: "action", scope: ownerScope(a), permission: "supprimer" };
    }
    case "decision": {
      const d = await prisma.decision.findUnique({ where: { id } });
      return d && { label: d.subject, entityType: "decision", scope: ownerScope(d), permission: "supprimer" };
    }
    case "document": {
      const d = await prisma.documentRef.findUnique({ where: { id } });
      return d && { label: d.title, entityType: "document", scope: ownerScope(d), permission: "supprimer" };
    }
    case "meeting": {
      const m = await prisma.meeting.findUnique({ where: { id }, select: { title: true, initiativeId: true } });
      return m && { label: m.title, entityType: "meeting", scope: { type: "initiative", id: m.initiativeId }, permission: "supprimer" };
    }
    case "kpi": {
      const k = await prisma.kpi.findUnique({ where: { id }, select: { name: true, initiativeId: true } });
      return k && { label: k.name, entityType: "kpi", scope: { type: "initiative", id: k.initiativeId }, permission: "supprimer" };
    }
  }
}

async function authorize(user: CurrentUser, r: Resolved): Promise<boolean> {
  const assignments = await getUserAssignments(user.id);
  // Objet sans périmètre identifiable : réservé à la portée plateforme.
  const target = r.scope ?? { type: "plateforme" as ScopeType, id: GLOBAL_SCOPE_ID };
  return can({ id: user.id, assignments }, r.permission, target);
}

async function runCore(kind: DeleteKind, id: string, hooks: Parameters<typeof deleteSimpleData>[3]): Promise<DeletionSummary> {
  switch (kind) {
    case "group": return deleteGroupData(prisma, id, hooks);
    case "establishment": return deleteEstablishmentData(prisma, id, hooks);
    case "initiative": return deleteInitiativeData(prisma, id, hooks);
    default: return deleteSimpleData(prisma, kind, id, hooks);
  }
}

const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status });

// Handler commun de toutes les routes DELETE. Réponses :
//  200 { ok, deleted }    suppression réalisée
//  200 { ok, alreadyGone } l'objet n'existait déjà plus (idempotent)
//  401 / 403              non authentifié / non autorisé
//  500 { error }          message lisible, base inchangée (transaction annulée)
export async function handleDelete(kind: DeleteKind, id: string): Promise<NextResponse> {
  const { user } = await requireUser();
  if (!user) return json({ error: "Authentification requise." }, 401);

  const resolved = await resolve(kind, id);
  if (!resolved) return json({ ok: true, alreadyGone: true }, 200);

  if (!(await authorize(user, resolved))) {
    return json({ error: "Vous n'avez pas les droits nécessaires pour supprimer cet élément." }, 403);
  }

  let summary: DeletionSummary;
  try {
    summary = await runCore(kind, id, {
      inTx: async (tx, s) => {
        await logAudit(
          { entityType: resolved.entityType, entityId: id, entityLabel: truncateLabel(resolved.label), action: "delete", changes: summaryToChanges(s), user },
          tx
        );
      },
    });
  } catch (e) {
    console.error(`[deletion] échec suppression ${kind} ${id}`, e);
    return json({ error: "La suppression n'a pas pu être réalisée. Aucune donnée n'a été supprimée ; réessayez ou contactez un administrateur." }, 500);
  }

  // Fichiers Blob : uniquement après le commit, au mieux (un fichier orphelin
  // est préférable à une référence cassée).
  await Promise.allSettled(summary.blobUrls.map((url) => del(url)));

  return json({ ok: true, deleted: summary.deleted }, 200);
}

function summaryToChanges(s: DeletionSummary) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, n] of Object.entries(s.deleted)) changes[k] = { from: n, to: null };
  return changes;
}

// Aperçu pour la boîte de confirmation (compteurs d'éléments dépendants).
export async function handlePreview(kind: DeleteKind, id: string): Promise<NextResponse> {
  const { user } = await requireUser();
  if (!user) return json({ error: "Authentification requise." }, 401);

  const resolved = await resolve(kind, id);
  if (!resolved) return json({ error: "Cet élément n'existe plus." }, 404);
  if (!(await authorize(user, resolved))) return json({ error: "Accès refusé." }, 403);

  if (kind === "group" || kind === "establishment" || kind === "initiative") {
    const preview = await previewDeletion(prisma, kind, id);
    return json({ ok: true, preview }, 200);
  }
  return json({ ok: true, preview: { label: resolved.label, counts: {}, notes: [] } }, 200);
}

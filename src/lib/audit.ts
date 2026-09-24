import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type AuditUser = { id: string; name: string } | null;

// Compare deux instantanés d'un même enregistrement et retourne uniquement
// les champs scalaires qui ont changé (dates comparées par valeur ISO,
// relations/objets imbriqués ignorés — ils ne sont pas la donnée éditée par
// le formulaire). Générique : fonctionne pour n'importe quel modèle Prisma
// sans liste de champs à maintenir manuellement par entité.
export function diffRecords(before: Record<string, any>, after: Record<string, any>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (key === "id" || key === "createdAt" || key === "updatedAt") continue;
    let b = before[key];
    let a = after[key];
    if (b instanceof Date) b = b.toISOString();
    if (a instanceof Date) a = a.toISOString();
    if (b !== null && typeof b === "object") continue;
    if (a !== null && typeof a === "object") continue;
    if (b !== a) changes[key] = { from: b ?? null, to: a ?? null };
  }
  return changes;
}

export function truncateLabel(s: string, max = 80): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export async function logAudit(params: {
  entityType: string;
  entityId: string;
  entityLabel: string;
  action: "create" | "update" | "delete";
  changes?: Record<string, { from: unknown; to: unknown }>;
  user: AuditUser;
}) {
  if (params.action === "update" && (!params.changes || Object.keys(params.changes).length === 0)) return;
  await prisma.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      action: params.action,
      changes: params.changes && Object.keys(params.changes).length > 0 ? (params.changes as Prisma.InputJsonValue) : undefined,
      userId: params.user?.id || null,
      userName: params.user?.name || "Système",
    },
  });
}

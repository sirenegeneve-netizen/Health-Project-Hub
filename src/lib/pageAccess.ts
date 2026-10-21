import { notFound, redirect } from "next/navigation";
import type { PermissionAction } from "@/lib/roles";
import { authorizeScopes, loadAccess, recordScope, type RecordModel } from "@/lib/access";

// Garde des PAGES serveur : même décision que les routes API. Ressource introuvable ou non autorisée → même réponse (404),
// pour ne pas révéler l'existence d'un objet à un utilisateur qui n'y a pas droit. Non connecté → page de connexion.
export async function requirePageAccess(model: RecordModel, id: string, action: PermissionAction = "voir") {
  const access = await loadAccess();
  if (!access) redirect("/login");
  const scope = await recordScope(access.db, model, id);
  if (!scope) {
    // aucune portée identifiable : réservé au rôle plateforme
    const r = await authorizeScopes(access, action, [null], `${model}:${id}`);
    if (!r.allowed) notFound();
    return access;
  }
  const r = await authorizeScopes(access, action, [scope], `${model}:${id}`);
  if (!r.allowed) notFound();
  return access;
}

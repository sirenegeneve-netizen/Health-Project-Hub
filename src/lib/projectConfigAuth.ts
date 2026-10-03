import { NextResponse } from "next/server";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { canGlobally, getUserAssignments } from "@/lib/authz";

// Garde commune des routes de configuration des projets (types, modèles, bibliothèque d'étapes).
// Même règle que la gestion de structure : « gererStructure » au niveau plateforme
// (mode transitoire inclus : sans aucune affectation, l'accès reste complet).
export async function requireConfigAccess(): Promise<{ user: CurrentUser; error: null } | { user: null; error: NextResponse }> {
  const { user } = await requireUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Authentification requise." }, { status: 401 }) };
  const assignments = await getUserAssignments(user.id);
  const ok = await canGlobally({ id: user.id, assignments }, "gererStructure");
  if (!ok) return { user: null, error: NextResponse.json({ error: "Droits insuffisants pour configurer les modèles de projet." }, { status: 403 }) };
  return { user, error: null };
}

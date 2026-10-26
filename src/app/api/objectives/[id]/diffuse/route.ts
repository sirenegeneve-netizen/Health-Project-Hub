import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";
import { applySelection, previewSelection } from "@/lib/declinaisonDb";

// Diffuse un objectif de GROUPE aux établissements : tous (y compris ceux rattachés plus tard) ou une sélection.
// Corps : { mode: "tous" | "selection", establishmentIds?: string[], dryRun?: boolean }. Sans corps : mode « tous » (compatibilité).
// dryRun = simulation : renvoie le plan (à créer, à restaurer, à marquer hors périmètre) sans rien écrire.
// Un établissement retiré garde sa déclinaison, marquée « Hors périmètre » (état précédent mémorisé) ; s'il revient, l'état est restauré.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const __g = await guardRecord("strategicGoalCycle", params.id, "diffuser");
  if (!__g.ok) return __g.response;

  const body: any = await req.json().catch(() => ({}));
  const mode = body && body.mode ? body.mode : "tous";
  const ids = body ? body.establishmentIds : undefined;

  if (body && body.dryRun === true) {
    const res = await previewSelection(params.id, mode, ids);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status || 400 });
    const p = res.data;
    return NextResponse.json({ ok: true, dryRun: true, targets: p.targets.length, toCreate: p.toCreate.length, toRestore: p.toRestore.length, toRemove: p.toRemove.length });
  }
  const res = await applySelection(params.id, mode, ids, { id: user.id, name: user.name });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status || 400 });
  return NextResponse.json({ ok: true, ...res.data });
}

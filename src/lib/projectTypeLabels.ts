import { prisma } from "@/lib/db";
import { PROJECT_TYPES } from "@/lib/templateSeedData";

// Libellés des types de projet : référentiel en base (types ajoutés ou renommés par un
// administrateur) complété par les libellés d'origine — une clé inconnue s'affiche telle quelle.
export async function getTypeLabels(): Promise<Record<string, string>> {
  const labels: Record<string, string> = Object.fromEntries(PROJECT_TYPES.map((t) => [t.key, t.label]));
  try {
    const rows = await prisma.projectType.findMany({ select: { key: true, label: true } });
    for (const r of rows) labels[r.key] = r.label;
  } catch {
    // Table absente (avant `prisma db push`) : on garde les libellés d'origine.
  }
  return labels;
}

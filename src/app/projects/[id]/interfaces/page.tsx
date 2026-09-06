import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { InterfaceForm } from "@/components/EntityForms";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  ["a_specifier", "À spécifier"],
  ["en_developpement", "En développement"],
  ["en_test", "En test"],
  ["valide", "Validée"],
  ["bloquant", "Bloquante"],
].map(([value, label]) => ({ value, label }));

export default async function InterfacesPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const interfaces = await prisma.interface.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-1">Interopérabilité</h1>
      <p className="text-sm text-muted mb-4">Les interfaces sont-elles prêtes ?</p>
      <InterfaceForm projectId={params.id} />

      <div className="card p-0 overflow-hidden">
        <table className="table-hp">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-4">Interface</th>
              <th>Source → Cible</th>
              <th>Responsable</th>
              <th>Fournisseur</th>
              <th>Date prévue</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {interfaces.map((i) => (
              <tr key={i.id} className={i.status === "bloquant" ? "bg-bad/5" : ""}>
                <td className="pl-4 font-medium">{i.name}</td>
                <td className="text-sm text-ink/60">
                  {i.systemeSource || "?"} → {i.systemeCible || "?"}
                </td>
                <td>{i.responsable || "—"}</td>
                <td>{i.fournisseur || "—"}</td>
                <td>{i.datePrevue ? new Date(i.datePrevue).toLocaleDateString("fr-FR") : "—"}</td>
                <td>
                  <InlineSelect endpoint={`/api/interfaces/${i.id}`} field="status" value={i.status} options={STATUS_OPTIONS} />
                  {i.status === "bloquant" && <Pill text="remonte au Go/No Go" tone="bad" />}
                </td>
              </tr>
            ))}
            {interfaces.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-ink/50">
                  Aucune interface déclarée pour ce projet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

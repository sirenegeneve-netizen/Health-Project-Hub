import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LinkActorSelector } from "@/components/LinkActorSelector";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const actors = await prisma.actor.findMany({
    select: { id: true, name: true, fonction: true },
    orderBy: { name: "asc" },
    distinct: ["name"],
  });
  return (
    <div>
      <h1 className="font-display text-2xl text-ink mb-4">Paramètres</h1>
      <div className="card max-w-md">
        <div className="label mb-1">Compte</div>
        <div className="text-sm text-ink">{user?.name}</div>
        <div className="text-sm text-ink/60">{user?.email}</div>
      </div>

      <LinkActorSelector currentActorId={user?.actorId || null} actors={actors} />

      <div className="card max-w-md mt-6">
        <div className="font-medium text-sm mb-1">Configuration des projets</div>
        <p className="text-sm text-muted mb-2">Types de projet, modèles de pilotage (parcours, étapes, critères de passage) et bibliothèque d'étapes.</p>
        <Link href="/settings/projects" className="text-sm text-blue hover:underline">
          Configurer →
        </Link>
      </div>

      <div className="card max-w-md mt-6">
        <div className="font-medium text-sm mb-1">Critères de passage (ancien écran)</div>
        <p className="text-sm text-muted mb-2">
          Checklists des étapes Kick-off, Préparation et Clôture, par type d'initiative. Les initiatives rattachées à un modèle de projet utilisent désormais les critères de leur modèle.
        </p>
        <Link href="/settings/criteria" className="text-sm text-blue hover:underline">
          Configurer →
        </Link>
      </div>

      <div className="card max-w-md mt-6">
        <div className="font-medium text-sm mb-1">Comptes utilisateurs</div>
        <p className="text-sm text-muted mb-2">Créer des comptes, affecter rôles et périmètres, suspendre un accès.</p>
        <Link href="/admin/users" className="text-sm text-blue hover:underline">
          Gérer →
        </Link>
      </div>

      <div className="card max-w-md mt-6">
        <div className="font-medium text-sm mb-1">Chef de projet / Sponsor à rattacher</div>
        <p className="text-sm text-muted mb-2">Reliquat de la migration vers le référentiel Acteur : cas saisis en texte libre sans Acteur rattaché.</p>
        <Link href="/admin/chef-sponsor" className="text-sm text-blue hover:underline">
          Traiter →
        </Link>
      </div>
    </div>
  );
}

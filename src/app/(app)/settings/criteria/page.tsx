import { ensureDefaultTemplates } from "@/lib/stageCriteria";
import { CriteriaTemplateEditor } from "@/components/CriteriaTemplateEditor";

export const dynamic = "force-dynamic";

export default async function CriteriaSettingsPage() {
  await ensureDefaultTemplates();
  return (
    <div>
      <h1 className="font-display text-2xl text-ink mb-1">Critères de passage</h1>
      <p className="text-sm text-muted mb-6 max-w-2xl">
        Checklists des étapes Kick-off, Préparation et Clôture. Le modèle par défaut s'applique à tout projet dont le
        type n'a pas sa propre liste. Les autres étapes (Cadrage, Déploiement, Validation, Formation &
        Accompagnement, Mise en production, Stabilisation) sont calculées automatiquement à partir des données du
        projet et ne se configurent pas ici.
      </p>
      <CriteriaTemplateEditor />
    </div>
  );
}

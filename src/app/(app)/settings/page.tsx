import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  return (
    <div>
      <h1 className="font-display text-2xl text-ink mb-4">Paramètres</h1>
      <div className="card max-w-md">
        <div className="label mb-1">Compte</div>
        <div className="text-sm text-ink">{user?.name}</div>
        <div className="text-sm text-ink/60">{user?.email}</div>
      </div>
      <p className="text-xs text-muted mt-4">
        Les préférences d'affichage et de notifications ne sont pas encore configurables — cet espace s'enrichira au fil des besoins.
      </p>
    </div>
  );
}

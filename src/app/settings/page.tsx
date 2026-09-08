export const dynamic = "force-dynamic";

// Placeholder volontairement sobre pour la Phase 1 : la structure de navigation
// prévoit "Paramètres", mais tant qu'il n'y a pas de compte utilisateur ni de
// préférences à configurer (à venir avec l'authentification / Phase 6), on
// évite d'ajouter des réglages qui ne feraient rien.
export default function SettingsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink mb-4">Paramètres</h1>
      <div className="card text-sm text-ink/60 py-10 text-center">
        Aucun réglage disponible pour l'instant — l'outil ne gère pas encore de comptes utilisateurs.
        <br />
        Cet espace accueillera les préférences une fois l'authentification en place.
      </div>
    </div>
  );
}

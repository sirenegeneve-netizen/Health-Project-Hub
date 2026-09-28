// Rapprochement nom en texte libre → Acteur existant. Logique reprise de
// prisma/migrate-chef-sponsor.ts (script ponctuel déjà exécuté en prod) pour
// être réutilisée par la page de résolution manuelle des cas restants.
export const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

export function isFuzzyMatch(a: string, b: string): boolean {
  if (a === b) return false;
  if (a.length < 3 || b.length < 3) return false;
  if (a.includes(b) || b.includes(a)) return true;
  return levenshtein(a, b) <= 2;
}

// Candidats plausibles pour une valeur texte donnée, parmi une liste d'Acteurs
// (portefeuille entier, pas seulement ceux de l'initiative — un même
// "NDH"/"moi" peut désigner la même personne sur plusieurs initiatives).
export function findCandidates(valeurTexte: string, acteurs: { id: string; name: string }[]): { id: string; name: string }[] {
  const cible = norm(valeurTexte);
  const exacts = acteurs.filter((a) => norm(a.name) === cible);
  if (exacts.length > 0) return exacts;
  return acteurs.filter((a) => isFuzzyMatch(cible, norm(a.name)));
}

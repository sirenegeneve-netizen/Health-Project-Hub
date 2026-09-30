// Combine une Date (dont on garde l'année/mois/jour) avec une heure "HH:mm" et
// renvoie un Date complet à cette heure, le même jour. Renvoie null si le
// format est invalide — on ne fabrique jamais un horaire à partir de données
// absentes ou mal formées.
export function combineDateAndTime(date: Date, hhmm: string | null | undefined): Date | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// Durée en heures entre une heure de début et une heure de fin, le même jour
// que `date`. Renvoie null si l'une des deux heures manque ou si la fin
// précède le début (donnée incohérente — on ignore plutôt que d'inventer).
export function hoursBetween(date: Date, heureDebut: string | null | undefined, heureFin: string | null | undefined): number | null {
  const start = combineDateAndTime(date, heureDebut);
  const end = combineDateAndTime(date, heureFin);
  if (!start || !end) return null;
  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  return hours > 0 ? hours : null;
}

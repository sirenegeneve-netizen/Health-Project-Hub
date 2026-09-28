// Lundi de la semaine contenant `date`, à minuit (heure locale du serveur).
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

export function weekLabel(monday: Date): string {
  const end = addWeeks(monday, 1);
  end.setDate(end.getDate() - 1);
  const sameMonth = monday.getMonth() === end.getMonth();
  const startStr = monday.toLocaleDateString("fr-FR", { day: "numeric", month: sameMonth ? undefined : "short" });
  const endStr = end.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${startStr}–${endStr}`;
}

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

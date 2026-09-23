"use client";

import { DonutCard, BarCard, type Bucket } from "@/components/PortfolioCharts";

export function ReportsCharts({
  byHealth,
  byStatus,
  byPriority,
  byEstablishment,
  risksByCriticite,
  months,
  riskMonths,
}: {
  byHealth: Bucket[];
  byStatus: Bucket[];
  byPriority: Bucket[];
  byEstablishment: Bucket[];
  risksByCriticite: Bucket[];
  months: Bucket[];
  riskMonths: Bucket[];
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      <DonutCard title="Santé du portefeuille" data={byHealth} />
      <DonutCard title="Répartition par statut" data={byStatus} />
      <DonutCard title="Répartition par priorité" data={byPriority} />
      <BarCard title="Répartition par établissement" data={byEstablishment} color="#2563EB" />
      {risksByCriticite.length > 0 && <BarCard title="Risques ouverts par criticité" data={risksByCriticite} color="#DC2626" />}
      <BarCard title="Initiatives créées par mois" data={months} color="#7C3AED" />
      {riskMonths.some((m) => m.value > 0) && (
        <div className="md:col-span-2">
          <BarCard title="Risques identifiés par mois" data={riskMonths} color="#F59E0B" />
        </div>
      )}
    </div>
  );
}

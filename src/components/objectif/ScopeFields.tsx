"use client";

import { MultiSelectChips } from "@/components/objectif/MultiSelectChips";
import { PERIMETRES_ORGANISATIONNELS, POPULATIONS, normalizePopulations } from "@/lib/referentiels";

export interface ScopeValue {
  perimetreOrg: string[];
  populations: string[];
  scopeEstablishmentIds: string[];
  perimetre: string; // précision facultative (ancien texte libre conservé)
}

// Périmètre organisationnel + population concernée (deux dimensions distinctes, sélection multiple),
// établissements précisés (parmi les établissements existants du groupe) et précision facultative.
export function ScopeFields({
  value,
  onChange,
  establishments,
}: {
  value: ScopeValue;
  onChange: (next: ScopeValue) => void;
  establishments?: { id: string; name: string }[]; // fourni seulement pour un objectif de groupe
}) {
  return (
    <div className="space-y-4">
      <div className="grid xl:grid-cols-2 gap-4">
        <div>
          <div className="label mb-1">Périmètre organisationnel</div>
          <MultiSelectChips
            options={PERIMETRES_ORGANISATIONNELS}
            value={value.perimetreOrg}
            onChange={(perimetreOrg) => onChange({ ...value, perimetreOrg })}
            placeholder="Filtrer les périmètres…"
          />
        </div>
        <div>
          <div className="label mb-1">Population concernée</div>
          <MultiSelectChips
            options={POPULATIONS}
            value={value.populations}
            onChange={(next) => onChange({ ...value, populations: normalizePopulations(next, value.populations) })}
            placeholder="Filtrer les populations…"
          />
        </div>
      </div>
      {establishments && establishments.length > 0 && (
        <div>
          <div className="label mb-1">Établissements concernés (facultatif)</div>
          <MultiSelectChips
            options={establishments.map((e) => ({ code: e.id, label: e.name }))}
            value={value.scopeEstablishmentIds}
            onChange={(scopeEstablishmentIds) => onChange({ ...value, scopeEstablishmentIds })}
            placeholder="Filtrer les établissements…"
            emptyLabel="Tous les établissements du périmètre, ou précisez-les ici"
          />
        </div>
      )}
      <label className="block">
        <div className="label mb-1">Précision (facultatif)</div>
        <input className="input" value={value.perimetre} onChange={(e) => onChange({ ...value, perimetre: e.target.value })} placeholder="À renseigner seulement si les listes ne suffisent pas" />
      </label>
    </div>
  );
}

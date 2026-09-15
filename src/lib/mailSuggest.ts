// Heuristique volontairement simple et transparente : elle repère des mots-clés
// et des noms d'interfaces déjà connues du projet, puis propose (sans jamais
// créer automatiquement) une action et/ou un risque. §34 : "l'utilisateur valide
// ou refuse les propositions." Un vrai moteur NLP/IA pourrait remplacer cette
// fonction sans changer le contrat de l'API (mêmes champs en sortie).
export interface MailSuggestion {
  matchedInterfaces: string[];
  suggestRisk: boolean;
  suggestAction: boolean;
  suggestedActionTitle?: string;
  suggestedRiskDescription?: string;
}

const DELAY_KEYWORDS = ["retard", "repoussé", "repoussée", "décalé", "décalée", "délai", "ne pourra pas livrer", "reporté"];

export function analyzeText(text: string, knownInterfaceNames: string[]): MailSuggestion {
  const lower = text.toLowerCase();
  const matchedInterfaces = knownInterfaceNames.filter((n) => lower.includes(n.toLowerCase()));
  const hasDelay = DELAY_KEYWORDS.some((k) => lower.includes(k));

  const subject = matchedInterfaces[0] || "sujet mentionné dans le document";

  return {
    matchedInterfaces,
    suggestRisk: hasDelay,
    suggestAction: hasDelay,
    suggestedActionTitle: hasDelay ? `Statuer sur le retard : ${subject}` : undefined,
    suggestedRiskDescription: hasDelay ? `Retard identifié concernant : ${subject}` : undefined,
  };
}

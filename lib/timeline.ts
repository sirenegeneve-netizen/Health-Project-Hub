import { prisma } from "@/lib/db";

// Principe §35 : chaque événement significatif du projet s'inscrit automatiquement
// dans la timeline, sans saisie supplémentaire de l'utilisateur.
export async function logTimelineEvent(projectId: string, type: string, description: string) {
  return prisma.timelineEvent.create({
    data: { projectId, type, description },
  });
}

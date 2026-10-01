import { prisma } from "@/lib/db";
import { AcceptInviteForm } from "@/components/AcceptInviteForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const invite = await prisma.inviteToken.findUnique({ where: { token: params.token }, include: { user: true } });
  const valid = !!invite && !invite.usedAt && invite.expiresAt > new Date();

  if (!valid) {
    return (
      <div className="card">
        <p className="text-sm text-ink">Ce lien d'invitation n'est plus valide. Demandez-en un nouveau à votre administrateur.</p>
      </div>
    );
  }

  return <AcceptInviteForm token={params.token} name={invite!.user.name} />;
}

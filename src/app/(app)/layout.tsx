import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ScopeBar } from "@/components/ScopeBar";
import { UserMenu } from "@/components/UserMenu";
import { prisma } from "@/lib/db";
import { getScope } from "@/lib/scope";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [establishments, scope] = await Promise.all([
    prisma.establishment.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getScope(),
  ]);

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <div className="border-b border-line bg-white/60 backdrop-blur px-8 py-3 flex items-center gap-3 sticky top-0 z-30">
          <span className="text-xs uppercase tracking-wide text-ink/40 font-medium">Périmètre</span>
          <ScopeBar establishments={establishments} currentId={scope.establishmentId} currentName={scope.establishmentName} />
          <div className="ml-auto">
            <UserMenu name={user.name} />
          </div>
        </div>
        <main className="max-w-6xl mx-auto px-8 py-10">{children}</main>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { ScopeBar } from "@/components/ScopeBar";
import { prisma } from "@/lib/db";
import { getScope } from "@/lib/scope";
import "./globals.css";

export const metadata: Metadata = {
  title: "Health Project Hub",
  description: "Cockpit et mémoire des projets numériques en santé",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [establishments, scope] = await Promise.all([
    prisma.establishment.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getScope(),
  ]);

  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="min-h-screen flex">
          <Sidebar />
          <div className="flex-1 min-w-0">
            <div className="border-b border-line bg-white/60 backdrop-blur px-8 py-3 flex items-center gap-3 sticky top-0 z-30">
              <span className="text-xs uppercase tracking-wide text-ink/40 font-medium">Périmètre</span>
              <ScopeBar
                establishments={establishments}
                currentId={scope.establishmentId}
                currentName={scope.establishmentName}
              />
            </div>
            <main className="max-w-6xl mx-auto px-8 py-10">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}

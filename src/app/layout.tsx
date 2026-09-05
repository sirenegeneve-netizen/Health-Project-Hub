import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Health Project Hub",
  description: "Cockpit et mémoire des projets numériques en santé",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Source+Sans+3:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-teal-100 bg-white">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/" className="font-display text-xl text-teal-700">
                Health Project Hub
              </Link>
              <nav className="flex items-center gap-5 text-sm">
                <Link href="/" className="hover:text-teal-600">
                  Portefeuille
                </Link>
                <Link href="/search" className="hover:text-teal-600">
                  Recherche
                </Link>
                <Link href="/projects/new" className="btn">
                  Nouveau projet
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
          <footer className="border-t border-teal-100 py-4">
            <div className="max-w-6xl mx-auto px-6 text-xs text-ink/40">
              Health Project Hub — cockpit et mémoire des projets numériques en santé
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

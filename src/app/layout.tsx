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
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Source+Sans+3:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-10 border-b border-teal-100 bg-sand/90 backdrop-blur">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2.5">
                <Mark />
                <span className="font-display text-lg text-teal-700 leading-none">Health Project Hub</span>
              </Link>
              <nav className="flex items-center gap-6 text-sm">
                <Link href="/" className="text-ink/70 hover:text-teal-700 transition-colors">
                  Portefeuille
                </Link>
                <Link href="/search" className="text-ink/70 hover:text-teal-700 transition-colors">
                  Recherche
                </Link>
                <Link href="/projects/new" className="btn">
                  Nouveau projet
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">{children}</main>
          <footer className="border-t border-teal-100">
            <div className="max-w-6xl mx-auto px-6 py-5 text-xs text-ink/40">
              Health Project Hub — cockpit et mémoire des projets numériques en santé
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <rect width="26" height="26" rx="7" fill="#123A37" />
      <path d="M8 7v12M18 7v12M8 13h10" stroke="#C4623B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

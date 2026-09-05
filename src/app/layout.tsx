import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
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
        <div className="min-h-screen flex">
          <Sidebar />
          <div className="flex-1 min-w-0">
            <main className="max-w-6xl mx-auto px-8 py-10">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}

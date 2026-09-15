import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/sessionCookie";

// Garde-fou léger : bloque les appels API directs sans cookie de session.
// LIMITE CONNUE : vérifie uniquement la présence du cookie, pas sa validité en
// base (le runtime Edge du middleware ne peut pas interroger Postgres). La
// vérification réelle (session valide, non expirée) a lieu côté pages via
// (app)/layout.tsx. Un token expiré ou révoqué passera donc ce filtre — ce
// n'est pas un rempart complet, seulement un premier tri des accès anonymes.
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/((?!auth/).*)"],
};

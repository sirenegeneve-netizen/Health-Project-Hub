"use client";

import { useEffect, useState } from "react";

export const FLASH_KEY = "hph:flash";

// Message de confirmation affiché après une redirection (ex. suppression d'un
// groupe puis retour à la liste). Lit puis efface la valeur en sessionStorage.
export function setFlash(message: string, tone: "ok" | "error" = "ok") {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, tone }));
  } catch {
    // stockage indisponible : le message est simplement perdu
  }
  window.dispatchEvent(new Event("hph:flash"));
}

export function FlashMessage() {
  const [flash, setFlashState] = useState<{ message: string; tone: "ok" | "error" } | null>(null);

  useEffect(() => {
    function read() {
      try {
        const raw = sessionStorage.getItem(FLASH_KEY);
        if (!raw) return;
        sessionStorage.removeItem(FLASH_KEY);
        setFlashState(JSON.parse(raw));
      } catch {
        // ignoré
      }
    }
    read();
    window.addEventListener("hph:flash", read);
    return () => window.removeEventListener("hph:flash", read);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlashState(null), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  if (!flash) return null;
  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${
        flash.tone === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {flash.message}
    </div>
  );
}

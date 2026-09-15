"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, ChevronDown, Globe2 } from "lucide-react";

interface EstablishmentOption {
  id: string;
  name: string;
}

export function ScopeBar({
  establishments,
  currentId,
  currentName,
}: {
  establishments: EstablishmentOption[];
  currentId: string | null;
  currentName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function select(id: string | null) {
    if (id) {
      document.cookie = `hph_scope_establishment=${id}; path=/; max-age=${60 * 60 * 24 * 365}`;
    } else {
      document.cookie = "hph_scope_establishment=; path=/; max-age=0";
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink hover:border-primary/40 transition-colors"
      >
        {currentId ? <Building2 size={15} className="text-primary" /> : <Globe2 size={15} className="text-primary" />}
        <span className="font-medium">{currentName ?? "Tous les établissements"}</span>
        <ChevronDown size={14} className="text-ink/40" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-72 rounded-lg border border-line bg-white shadow-lg z-20 py-1 max-h-80 overflow-auto">
            <button
              onClick={() => select(null)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-teal-50 ${
                !currentId ? "text-primary font-medium" : "text-ink"
              }`}
            >
              <Globe2 size={14} />
              Tous les établissements
              <span className="ml-auto text-xs text-ink/40">Vue Groupe</span>
            </button>
            {establishments.length > 0 && <div className="my-1 border-t border-line" />}
            {establishments.map((e) => (
              <button
                key={e.id}
                onClick={() => select(e.id)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-teal-50 ${
                  currentId === e.id ? "text-primary font-medium" : "text-ink"
                }`}
              >
                <Building2 size={14} />
                {e.name}
              </button>
            ))}
            {establishments.length === 0 && (
              <div className="px-3 py-2 text-xs text-ink/40">Aucun établissement créé pour l'instant.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

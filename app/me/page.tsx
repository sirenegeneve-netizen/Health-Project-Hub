"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface MyItem {
  kind: string;
  label: string;
  projectName: string;
  href: string;
  date: string | null;
}

function MyActivityInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState(searchParams.get("nom") || "");
  const [items, setItems] = useState<MyItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(n: string) {
    if (!n.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/me?nom=${encodeURIComponent(n)}`);
    const data = await res.json();
    setItems(data.items);
    setLoading(false);
  }

  useEffect(() => {
    if (name) load(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Mon activité</h1>
        <p className="text-sm text-muted">
          Pas de compte utilisateur dans l'outil pour l'instant — indiquez votre nom tel qu'il apparaît dans les projets pour voir ce qui vous concerne.
        </p>
      </div>

      <form
        className="flex gap-2 mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(`/me?nom=${encodeURIComponent(name)}`);
          load(name);
        }}
      >
        <input className="input max-w-xs" placeholder="Votre nom" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn shrink-0" type="submit">
          Voir mon activité
        </button>
      </form>

      {loading && <div className="text-sm text-muted">Recherche…</div>}

      {items && (
        <>
          {items.length === 0 ? (
            <div className="card text-center text-ink/50 py-10">Aucun élément trouvé pour « {name} » — vérifiez l'orthographe utilisée dans les projets.</div>
          ) : (
            <div className="space-y-2">
              {items.map((it, i) => (
                <Link key={i} href={it.href} className="row-link">
                  <div className="card flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-sm">{it.label}</div>
                      <div className="text-xs text-muted">{it.projectName}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {it.date && <span className="text-xs text-muted">{new Date(it.date).toLocaleDateString("fr-FR")}</span>}
                      <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5">{it.kind}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MyActivityPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Chargement…</div>}>
      <MyActivityInner />
    </Suspense>
  );
}

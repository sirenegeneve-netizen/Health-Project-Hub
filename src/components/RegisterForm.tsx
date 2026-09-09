"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Création du compte impossible.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <label className="label block mb-1">Nom et prénom</label>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Tel qu'il apparaît comme chef de projet ou responsable" />
      </div>
      <div>
        <label className="label block mb-1">Email</label>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label block mb-1">Mot de passe</label>
        <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className="text-xs text-muted mt-1">8 caractères minimum.</p>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button type="submit" disabled={loading} className="btn w-full justify-center">
        {loading ? "Création…" : "Créer le compte"}
      </button>
      <p className="text-xs text-center text-muted">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-blue hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}

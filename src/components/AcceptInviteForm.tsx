"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";

export function AcceptInviteForm({ token, name }: { token: string; name: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("8 caractères minimum.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Impossible d'activer le compte.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <p className="label mb-1">Bienvenue, {name}</p>
        <p className="text-sm text-muted">Définissez votre mot de passe pour activer votre compte.</p>
      </div>
      <div>
        <label className="label block mb-1">Mot de passe</label>
        <PasswordInput required minLength={8} autoComplete="new-password" value={password} onChange={setPassword} />
      </div>
      <div>
        <label className="label block mb-1">Confirmer le mot de passe</label>
        <PasswordInput required minLength={8} autoComplete="new-password" value={confirm} onChange={setConfirm} />
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button type="submit" disabled={loading} className="btn w-full justify-center">
        {loading ? "Activation…" : "Activer mon compte"}
      </button>
    </form>
  );
}

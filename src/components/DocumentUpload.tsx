"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = [
  ["compte_rendu", "Compte rendu"],
  ["specification", "Spécification"],
  ["recette", "Recette"],
  ["formation", "Formation"],
  ["interop", "Interopérabilité"],
  ["mail", "Mail"],
  ["autre", "Autre"],
];

export function DocumentUpload({ initiativeId }: { initiativeId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("autre");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("initiativeId", initiativeId);
    formData.append("title", title || file.name);
    formData.append("type", type);
    const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Échec de l'envoi du fichier.");
      return;
    }
    setFile(null);
    setTitle("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <input
        type="file"
        className="text-sm block w-full text-ink/70 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-teal-50 file:text-primary file:text-sm"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          setFile(f);
          if (f && !title) setTitle(f.name);
        }}
      />
      {file && (
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="text-xs text-bad">{error}</p>}
      <button className="btn text-sm" onClick={upload} disabled={!file || uploading}>
        {uploading ? "Envoi..." : "Envoyer le fichier"}
      </button>
    </div>
  );
}

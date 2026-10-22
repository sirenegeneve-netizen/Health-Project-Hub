"use client";

import { useState } from "react";

// Champ de mot de passe avec bouton « œil » pour afficher / masquer la saisie.
export function PasswordInput({
  value,
  onChange,
  minLength,
  required,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
  required?: boolean;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        className="input pr-11"
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute inset-y-0 right-0 px-3 text-lg leading-none select-none"
      >
        {visible ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

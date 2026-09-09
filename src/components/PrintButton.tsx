"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn print:hidden">
      Imprimer / Exporter en PDF
    </button>
  );
}

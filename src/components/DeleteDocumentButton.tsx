"use client";

import { DeleteButton } from "@/components/DeleteButton";

// Conservé pour compatibilité : délègue au composant de suppression commun.
export function DeleteDocumentButton({ id }: { id: string }) {
  return <DeleteButton kind="document" id={id}>Retirer</DeleteButton>;
}

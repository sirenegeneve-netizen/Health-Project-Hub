"use client";

import { useRouter } from "next/navigation";

export function DeleteDocumentButton({ id }: { id: string }) {
  const router = useRouter();

  async function remove() {
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button className="text-xs text-red-500 hover:underline shrink-0" onClick={remove}>
      Retirer
    </button>
  );
}

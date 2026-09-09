"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";

export function UserMenu({ name }: { name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-sm text-ink/70 hover:text-ink">
        <span className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <User size={13} />
        </span>
        {name}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-44 rounded-lg border border-line bg-white shadow-lg z-20 py-1">
            <button
              onClick={logout}
              disabled={loading}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-ink/70 hover:bg-sand/60"
            >
              <LogOut size={14} />
              Se déconnecter
            </button>
          </div>
        </>
      )}
    </div>
  );
}

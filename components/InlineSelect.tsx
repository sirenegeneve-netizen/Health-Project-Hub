"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InlineSelect({
  endpoint,
  field,
  value,
  options,
}: {
  endpoint: string;
  field: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [saving, setSaving] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setCurrent(next);
    setSaving(true);
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <select className="text-xs border border-teal-100 rounded px-1.5 py-1 bg-white" value={current} onChange={onChange} disabled={saving}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

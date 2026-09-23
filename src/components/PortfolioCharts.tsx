"use client";

import { useState } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export interface Bucket {
  label: string;
  value: number;
  items: { id: string; name: string; sub?: string }[];
}

const COLORS = ["#0EA5A8", "#2563EB", "#7C3AED", "#F59E0B", "#DC2626", "#16A34A", "#64748B", "#0891B2", "#DB2777", "#65A30D"];

function DrilldownList({ items }: { items: { id: string; name: string; sub?: string }[] }) {
  if (items.length === 0) return <p className="text-xs text-ink/40 mt-2">Aucun élément.</p>;
  return (
    <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
      {items.map((it) => (
        <li key={it.id} className="text-xs">
          <Link href={`/initiatives/${it.id}`} className="text-blue hover:underline">
            {it.name}
          </Link>
          {it.sub && <span className="text-ink/40"> — {it.sub}</span>}
        </li>
      ))}
    </ul>
  );
}

export function DonutCard({ title, data }: { title: string; data: Bucket[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = data.find((d) => d.label === selected);

  return (
    <div className="card">
      <div className="font-medium text-sm mb-2">{title}</div>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={38}
              outerRadius={62}
              paddingAngle={2}
              onClick={(d) => setSelected(d.label === selected ? null : d.label)}
              cursor="pointer"
            >
              {data.map((d, i) => (
                <Cell key={d.label} fill={COLORS[i % COLORS.length]} opacity={selected && selected !== d.label ? 0.35 : 1} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [v, n]} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="text-xs space-y-1 flex-1 min-w-0">
          {data.map((d, i) => (
            <li key={d.label}>
              <button
                className={`flex items-center gap-1.5 w-full text-left hover:text-primary ${selected === d.label ? "font-medium text-primary" : "text-ink/70"}`}
                onClick={() => setSelected(d.label === selected ? null : d.label)}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate">{d.label}</span>
                <span className="ml-auto shrink-0">{d.value}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {active && (
        <div className="border-t border-line mt-3 pt-2">
          <div className="text-xs text-ink/50">{active.label} :</div>
          <DrilldownList items={active.items} />
        </div>
      )}
    </div>
  );
}

export function BarCard({ title, data, color = "#0EA5A8" }: { title: string; data: Bucket[]; color?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = data.find((d) => d.label === selected);

  return (
    <div className="card">
      <div className="font-medium text-sm mb-2">{title}</div>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 32, 80)}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar
            dataKey="value"
            fill={color}
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(d: any) => setSelected(d.label === selected ? null : d.label)}
          />
        </BarChart>
      </ResponsiveContainer>
      {active && (
        <div className="border-t border-line mt-1 pt-2">
          <div className="text-xs text-ink/50">{active.label} :</div>
          <DrilldownList items={active.items} />
        </div>
      )}
    </div>
  );
}

export function PortfolioCharts({
  byStatus,
  byType,
  byEstablishment,
  upcomingByWeek,
}: {
  byStatus: Bucket[];
  byType: Bucket[];
  byEstablishment: Bucket[];
  upcomingByWeek: Bucket[];
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <DonutCard title="Répartition par statut" data={byStatus} />
      <DonutCard title="Répartition par type" data={byType} />
      <BarCard title="Répartition par établissement" data={byEstablishment} color="#2563EB" />
      <BarCard title="Échéances à venir (par semaine)" data={upcomingByWeek} color="#F59E0B" />
    </div>
  );
}

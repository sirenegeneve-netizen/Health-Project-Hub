export function BarList({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-32 shrink-0 text-sm text-body truncate">{d.label}</div>
          <div className="flex-1 h-5 bg-ink/[0.04] rounded overflow-hidden">
            <div className="h-full bg-primary rounded" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <div className="w-8 shrink-0 text-sm text-muted text-right">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

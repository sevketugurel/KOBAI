function tr(n: number) { return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 }); }
function Card({ title, value, delta }: { title: string; value: number; delta?: number }) {
  return (
    <div className="rounded border border-stone-200 bg-white/60 p-4">
      <div className="text-xs text-stone-600 uppercase tracking-wide">{title}</div>
      <div className="text-2xl font-semibold mt-1">₺ {tr(value)}</div>
      {delta !== undefined && (
        <div className={`text-xs mt-1 ${delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
          {delta >= 0 ? "↑" : "↓"} {tr(Math.abs(delta))}
        </div>
      )}
    </div>
  );
}
export default function KPICards({ income, expense, net, taxBurden }: { income: number; expense: number; net: number; taxBurden: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card title="Toplam Gelir" value={income} />
      <Card title="Toplam Gider" value={expense} />
      <Card title="Net Nakit Akışı" value={net} />
      <Card title="Tahmini Vergi Yükü" value={taxBurden} />
    </div>
  );
}

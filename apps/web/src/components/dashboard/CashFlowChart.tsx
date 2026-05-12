import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import type { CashFlowMonth } from "../../api/types";

const AY_KISALTMA = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
function ayLabel(month: string): string {
  const [, mm] = month.split("-");
  if (!mm) return month;
  return AY_KISALTMA[Number(mm) - 1] ?? month;
}
function tr(n: number) { return "₺ " + n.toLocaleString("tr-TR", { maximumFractionDigits: 0 }); }

export default function CashFlowChart({ data }: { data: CashFlowMonth[] }) {
  const chartData = data.map(d => ({ ...d, ay: ayLabel(d.month) }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <XAxis dataKey="ay" />
          <YAxis tickFormatter={tr} />
          <Tooltip formatter={(v: number) => tr(v)} />
          <Legend />
          <Line type="monotone" dataKey="income" name="Gelir" stroke="#2563eb" />
          <Line type="monotone" dataKey="expense" name="Gider" stroke="#dc2626" />
          <Line type="monotone" dataKey="net" name="Net" stroke="#059669" />
          {chartData.map((d, i) => d.kdv_payment > 0 ? (
            <ReferenceLine key={`k${i}`} x={d.ay} stroke="#dc2626" strokeDasharray="3 3" label={{ value: "KDV", position: "top", fill: "#dc2626" }} />
          ) : null)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

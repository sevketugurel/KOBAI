import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { formatTRY } from "../../lib/utils";
import type { CashFlowMonth } from "../../api/types";

const AY_KISALTMA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function ayLabel(month: string): string {
  const [, mm] = month.split("-");
  if (!mm) return month;
  return AY_KISALTMA[Number(mm) - 1] ?? month;
}

// Recharts' dot prop typings are intentionally loose; using `any` keeps this readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NetDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  if (payload?.kdv_payment > 0) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={5} fill="#EF4444" stroke="white" strokeWidth={2} />
        <text
          x={cx}
          y={cy - 12}
          textAnchor="middle"
          fontSize={9}
          fontWeight={600}
          fill="#EF4444"
        >
          KDV
        </text>
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill="#10C896" />;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="card p-3 text-sm space-y-1">
      <div className="font-semibold text-navy-900 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-navy-600">
            <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium text-navy-900">{formatTRY(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

const LEGEND: Array<{ label: string; color: string }> = [
  { label: "Gelir", color: "#2A5298" },
  { label: "Gider", color: "#F87171" },
  { label: "Net", color: "#10C896" },
  { label: "Kümülatif", color: "#94A3B8" },
];

export default function CashFlowChart({ data }: { data: CashFlowMonth[] }) {
  const chartData = data.map((d) => ({ ...d, ay: ayLabel(d.month) }));

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-display font-semibold text-lg text-navy-900">Nakit Akışı Tahmini</h3>
          <span className="badge bg-navy-50 text-navy-600">{data.length} ay</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-navy-600">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2A5298" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2A5298" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F87171" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E7F0" vertical={false} />
          <XAxis
            dataKey="ay"
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatTRY(v)}
            width={80}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatTRY(v)}
            width={70}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="income"
            name="Gelir"
            stroke="#2A5298"
            strokeWidth={2}
            fill="url(#incomeFill)"
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="expense"
            name="Gider"
            stroke="#F87171"
            strokeWidth={2}
            fill="url(#expenseFill)"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="net"
            name="Net"
            stroke="#10C896"
            strokeWidth={2.5}
            dot={<NetDot />}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulative"
            name="Kümülatif"
            stroke="#94A3B8"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

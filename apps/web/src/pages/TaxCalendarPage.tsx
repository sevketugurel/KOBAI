import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { v2, type TaxCalendarItem, type TaxStatus, type TaxType } from "../api/v2";

const TAX_TYPE_LABELS: Record<TaxType, string> = {
  kdv: "KDV",
  muhtasar: "Muhtasar",
  gecici_vergi: "Geçici Vergi",
  sgk: "SGK",
  gelir_vergisi: "Gelir Vergisi",
  kurumlar_vergisi: "Kurumlar Vergisi",
};

const STATUS_LABELS: Record<TaxStatus, string> = {
  pending: "Bekliyor",
  paid: "Ödendi",
  overdue: "Gecikmiş",
};

const STATUS_CLASSES: Record<TaxStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-300",
  overdue: "bg-red-100 text-red-800 border-red-300",
};

const DATE_FMT = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "long", year: "numeric",
});

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const diff = d.getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(diff / 86400000);
}

export default function TaxCalendarPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const qc = useQueryClient();

  const items = useQuery({
    queryKey: ["tax-calendar", slug],
    queryFn: () => v2.listTaxCalendar(slug),
    enabled: Boolean(slug),
  });

  const markPaid = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) =>
      v2.patchTaxCalendarItem(slug, itemId, { status: "paid" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-calendar", slug] }),
  });

  if (items.isLoading) return <p className="text-sm text-neutral-500">Yükleniyor…</p>;
  if (items.isError) return <p className="text-sm text-red-600">Takvim yüklenemedi.</p>;

  const rows = items.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const overdue = rows.filter((r) => r.status === "overdue");
  const paid = rows.filter((r) => r.status === "paid");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-xl">Vergi Takvimi</h1>
        <p className="text-xs text-neutral-500">
          KDV, Muhtasar, SGK, Geçici Vergi ve yıllık beyannameler için son ödeme tarihleri.
        </p>
      </header>

      <Summary label="Gecikmiş" tone="overdue" count={overdue.length} />
      {overdue.length > 0 && <ItemList rows={overdue} onPaid={(id) => markPaid.mutate({ itemId: id })} />}

      <Summary label="Yaklaşan" tone="pending" count={pending.length} />
      <ItemList rows={pending} onPaid={(id) => markPaid.mutate({ itemId: id })} />

      {paid.length > 0 && (
        <>
          <Summary label="Ödenmiş" tone="paid" count={paid.length} />
          <ItemList rows={paid} muted />
        </>
      )}
    </div>
  );
}

function Summary({ label, count, tone }: { label: string; count: number; tone: TaxStatus }) {
  return (
    <div className={`inline-block rounded border px-3 py-1 text-sm ${STATUS_CLASSES[tone]}`}>
      {label}: <strong>{count}</strong>
    </div>
  );
}

function ItemList({
  rows, onPaid, muted = false,
}: {
  rows: TaxCalendarItem[];
  onPaid?: (id: string) => void;
  muted?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">Kayıt yok.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((it) => {
        const dl = daysUntil(it.due_date);
        const urgency =
          it.status === "overdue" ? "text-red-700"
          : dl <= 3 ? "text-amber-700"
          : "text-neutral-700";
        return (
          <li
            key={it.id}
            className={`flex items-center justify-between rounded border border-border bg-surface px-4 py-3 ${
              muted ? "opacity-60" : ""
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-neutral-500">
                  {TAX_TYPE_LABELS[it.tax_type]}
                </span>
                <span className={`text-xs ${STATUS_CLASSES[it.status]} rounded border px-2 py-0.5`}>
                  {STATUS_LABELS[it.status]}
                </span>
              </div>
              <div className="mt-1 text-sm font-medium">{it.title}</div>
              {it.description && (
                <div className="text-xs text-neutral-500">{it.description}</div>
              )}
            </div>
            <div className="text-right">
              <div className={`font-mono text-sm ${urgency}`}>
                {DATE_FMT.format(new Date(it.due_date))}
              </div>
              <div className="text-xs text-neutral-500">
                {it.status === "overdue"
                  ? `${Math.abs(dl)} gün geçti`
                  : dl === 0 ? "Bugün"
                  : dl > 0 ? `${dl} gün sonra`
                  : `${Math.abs(dl)} gün önce`}
              </div>
              {onPaid && it.status !== "paid" && (
                <button
                  onClick={() => onPaid(it.id)}
                  className="mt-1 text-xs text-navy-700 underline"
                >
                  Ödendi olarak işaretle
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

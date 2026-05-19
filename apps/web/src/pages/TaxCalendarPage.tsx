import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock } from "lucide-react";

import { v2, type TaxCalendarItem, type TaxStatus, type TaxType } from "../api/v2";
import AIActionButton from "../components/copilot/AIActionButton";
import { TenantAIActionProvider } from "../components/copilot/TenantAIActionContext";
import TenantCopilotRail from "../components/copilot/TenantCopilotRail";
import { Button, Card, EmptyState, KpiCard, PageHeader, StatusBadge } from "../components/ui";
import { useTenantPageAI } from "../hooks/useTenantPageAI";
import { getOrCreateSessionId } from "../lib/chatSession";
import { buildTaxItemAIPrompt } from "../lib/aiPrompts";
import { formatTRY } from "../lib/utils";

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
  const sessionId = useMemo(() => getOrCreateSessionId(slug), [slug]);
  const aiView = useTenantPageAI(slug, "tax-calendar");

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
  const pendingAmount = [...pending, ...overdue].reduce(
    (sum, r) => sum + Number(r.amount ?? 0),
    0,
  );
  const nextItem = [...pending, ...overdue].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  const pageEntryAction = aiView.data?.entry_actions?.[0];

  return (
    <TenantAIActionProvider>
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-8">
        <PageHeader
          title="Vergi Takvimi"
          subtitle="KDV, Muhtasar, SGK, Geçici Vergi ve yıllık beyannameler için ödeme görünümü."
          actions={pageEntryAction ? <AIActionButton action={pageEntryAction} /> : undefined}
        />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Açık Tutar" value={formatTRY(pendingAmount)} icon={<CalendarDays size={20} />} />
          <KpiCard label="Yaklaşan" value={`${pending.length} kalem`} icon={<Clock size={20} />} />
          <KpiCard label="Gecikmiş" value={`${overdue.length} kalem`} icon={<AlertTriangle size={20} />} />
          <KpiCard label="Ödenmiş" value={`${paid.length} kalem`} icon={<CheckCircle2 size={20} />} />
        </section>

        {nextItem ? (
          <Card>
            <Card.Body>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Sıradaki ödeme
                  </p>
                  <h2 className="mt-1 font-display text-lg text-navy-900">{nextItem.title}</h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    {TAX_TYPE_LABELS[nextItem.tax_type]} · {nextItem.period ?? "Dönem yok"} · {formatTRY(Number(nextItem.amount ?? 0))}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <StatusBadge
                    variant={nextItem.status === "overdue" ? "danger" : "warning"}
                    label={STATUS_LABELS[nextItem.status]}
                  />
                  <div className="mt-2">
                    <AIActionButton
                      action={{
                        id: `tax-next-priority-${nextItem.id}`,
                        label: "Neden Öncelikli?",
                        variant: "explain",
                        prompt: buildTaxItemAIPrompt(nextItem),
                      }}
                    />
                  </div>
                  <p className="mt-2 font-mono text-sm text-navy-900">
                    {DATE_FMT.format(new Date(nextItem.due_date))}
                  </p>
                </div>
              </div>
            </Card.Body>
          </Card>
        ) : null}

        <TaxSection title="Gecikmiş" rows={overdue} onPaid={(id) => markPaid.mutate({ itemId: id })} />
        <TaxSection title="Yaklaşan" rows={pending} onPaid={(id) => markPaid.mutate({ itemId: id })} />
        <TaxSection title="Ödenmiş" rows={paid} muted />
      </div>

      <TenantCopilotRail
        slug={slug}
        sessionId={sessionId}
        view={aiView.data}
        loading={aiView.isLoading}
      />
    </div>
    </TenantAIActionProvider>
  );
}

function TaxSection({
  title,
  rows,
  onPaid,
  muted,
}: {
  title: string;
  rows: TaxCalendarItem[];
  onPaid?: (id: string) => void;
  muted?: boolean;
}) {
  return (
    <Card>
      <Card.Header title={title} subtitle={`${rows.length} kayıt`} />
      <Card.Body>
        <ItemList rows={rows} onPaid={onPaid} muted={muted} />
      </Card.Body>
    </Card>
  );
}

function ItemList({
  rows, onPaid, muted = false,
}: {
  rows: TaxCalendarItem[];
  onPaid?: (id: string) => void;
  muted?: boolean;
}) {
  const actionableStatuses = new Set<TaxStatus>(["pending", "overdue"]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays size={32} />}
        title="Kayıt yok"
        message="Bu durum için vergi takvimi kalemi bulunmuyor."
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-neutral-500">
          <tr>
            <th className="py-2 pr-3">Kalem</th>
            <th className="py-2 pr-3">Dönem</th>
            <th className="py-2 pr-3">Durum</th>
            <th className="py-2 pr-3 text-right">Tutar</th>
            <th className="py-2 pr-3 text-right">Son Tarih</th>
            {onPaid ? <th className="py-2 pr-3 text-right">Aksiyon</th> : null}
          </tr>
        </thead>
        <tbody>
      {rows.map((it) => {
        const dl = daysUntil(it.due_date);
        const urgency =
          it.status === "overdue" ? "text-red-700"
          : dl <= 3 ? "text-amber-700"
          : "text-neutral-700";
        return (
          <tr
            key={it.id}
            className={`border-b border-border/60 ${muted ? "opacity-60" : ""}`}
          >
            <td className="py-3 pr-3">
              <div className="min-w-0">
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {TAX_TYPE_LABELS[it.tax_type]}
                </span>
              <div className="mt-1 font-medium text-navy-900">{it.title}</div>
              {it.description && (
                <div className="text-xs text-neutral-500">{it.description}</div>
              )}
              </div>
            </td>
            <td className="py-3 pr-3 font-mono text-xs text-neutral-600">{it.period ?? "—"}</td>
            <td className="py-3 pr-3">
              <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_CLASSES[it.status]}`}>
                {STATUS_LABELS[it.status]}
              </span>
            </td>
            <td className="py-3 pr-3 text-right font-mono text-navy-900">
              {formatTRY(Number(it.amount ?? 0))}
            </td>
            <td className="py-3 pr-3 text-right">
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
            </td>
            {onPaid ? (
              <td className="py-3 pr-3 text-right">
              {actionableStatuses.has(it.status) ? (
                <div className="mb-2">
                  <AIActionButton
                    action={{
                      id: `tax-analyze-${it.id}`,
                      label: "Bu Kalemi Analiz Et",
                      variant: "analyze",
                      prompt: buildTaxItemAIPrompt(it),
                    }}
                  />
                </div>
              ) : null}
              {onPaid && it.status !== "paid" && (
                <Button
                  onClick={() => onPaid(it.id)}
                  size="sm"
                  variant="secondary"
                >
                  Ödendi
                </Button>
              )}
              </td>
            ) : null}
          </tr>
        );
      })}
        </tbody>
      </table>
    </div>
  );
}

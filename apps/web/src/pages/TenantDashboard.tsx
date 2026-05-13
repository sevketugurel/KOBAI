import { useParams } from "react-router-dom";
import {
  Building2,
  Calendar,
  CreditCard,
  Link2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import {
  Card,
  EmptyState,
  KpiCard,
  PageHeader,
  StatusBadge,
} from "../components/ui";
import { useTenantDashboard } from "../hooks/useTenantDashboard";
import {
  formatDate,
  formatDateTime,
  formatRelative,
  formatTRY,
} from "../lib/utils";
import type {
  DashboardActivity,
  DashboardSummary,
  TaxCalendarItem,
} from "../api/v2";

function toNumber(s: string | null | undefined): number {
  if (s == null) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function taxStatusVariant(item: TaxCalendarItem) {
  if (item.status === "overdue") return "danger" as const;
  if (item.status === "paid") return "success" as const;
  return "warning" as const;
}

function activityIcon(type: DashboardActivity["type"]) {
  if (type === "bank") return <Building2 size={16} />;
  if (type === "pos") return <CreditCard size={16} />;
  return <Calendar size={16} />;
}

export default function TenantDashboard() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = useTenantDashboard(slug);
  const summary = data as DashboardSummary | undefined;

  const netFlow = toNumber(summary?.net_flow_this_month);
  const posSales = toNumber(summary?.pos_sales_this_month);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
      <PageHeader
        title={`${slug} Dashboard`}
        subtitle={
          summary?.updated_at
            ? `Son güncelleme: ${formatDateTime(summary.updated_at)}`
            : "Veriler yükleniyor…"
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Bu Ay Net Akış"
          value={formatTRY(netFlow)}
          icon={netFlow >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          loading={isLoading}
        />
        <KpiCard
          label="Bu Ay POS Satışı"
          value={formatTRY(posSales)}
          icon={<CreditCard size={20} />}
          loading={isLoading}
        />
        <KpiCard
          label="Yaklaşan Vergi"
          value={`${summary?.upcoming_tax_count ?? 0} kalem`}
          icon={<Calendar size={20} />}
          loading={isLoading}
        />
        <KpiCard
          label="Aktif Entegrasyon"
          value={String(summary?.integration_count ?? 0)}
          icon={<Link2 size={20} />}
          loading={isLoading}
        />
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <Card.Header
            title="Yaklaşan 3 Vergi Kalemi"
            subtitle="Önümüzdeki 30 gün içinde ödenmesi gerekenler"
          />
          <Card.Body>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-12" />
                ))}
              </div>
            ) : !summary || summary.upcoming_taxes.length === 0 ? (
              <EmptyState
                icon={<Calendar size={32} />}
                title="Yaklaşan vergi yok"
                message="Önümüzdeki 30 gün için ödenmemiş vergi kalemi bulunmuyor."
              />
            ) : (
              <ul className="divide-y divide-border">
                {summary.upcoming_taxes.map((item, i) => (
                  <li
                    key={item.id}
                    className="py-3 flex items-center justify-between animate-slide-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-navy-900 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-navy-500 mt-0.5">
                        {item.tax_type.toUpperCase()}
                        {item.period ? ` • ${item.period}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge
                        variant={taxStatusVariant(item)}
                        label={item.status}
                      />
                      <span className="font-mono text-sm text-navy-700 tabular-nums">
                        {formatDate(item.due_date)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header title="Son Aktiviteler" subtitle="Banka ve POS hareketleri" />
          <Card.Body>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-10" />
                ))}
              </div>
            ) : !summary || summary.recent_activities.length === 0 ? (
              <EmptyState
                icon={<Building2 size={28} />}
                title="Aktivite yok"
                message="Banka veya POS hareketi henüz kaydedilmedi."
              />
            ) : (
              <ul className="space-y-3">
                {summary.recent_activities.map((a, i) => {
                  const amount = toNumber(a.amount);
                  const positive = amount >= 0;
                  return (
                    <li
                      key={a.id}
                      className="flex items-start gap-3 animate-slide-up"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="mt-0.5 text-navy-400">{activityIcon(a.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-navy-900 truncate">{a.title}</p>
                        <p className="text-xs text-navy-500">
                          {formatRelative(a.timestamp)}
                        </p>
                      </div>
                      {a.amount != null ? (
                        <span
                          className={
                            "font-mono text-sm tabular-nums " +
                            (positive ? "text-emerald-600" : "text-red-600")
                          }
                        >
                          {formatTRY(amount)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card.Body>
        </Card>
      </section>

      {isError ? (
        <p className="text-sm text-red-600">
          Dashboard verisi yüklenemedi. Lütfen sayfayı yenileyin.
        </p>
      ) : null}
    </div>
  );
}

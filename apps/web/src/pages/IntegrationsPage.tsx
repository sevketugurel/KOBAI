import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useParams } from "react-router-dom";
import { AlertCircle, Building2, CheckCircle2, Plug, RefreshCw, Unplug } from "lucide-react";

import { V2ApiError, isMockMode, v2, type BankTransaction, type Integration } from "../api/v2";
import { Button, Card, EmptyState, KpiCard, PageHeader, StatusBadge } from "../components/ui";
import { formatDateTime, formatTRY } from "../lib/utils";

const BANK_LABELS: Record<string, string> = {
  is_bankasi: "İş Bankası",
  garanti: "Garanti BBVA",
  akbank: "Akbank",
  yapi_kredi: "Yapı Kredi",
  ziraat: "Ziraat Bankası",
  halkbank: "Halkbank",
  vakifbank: "VakıfBank",
  qnb_finansbank: "QNB Finansbank",
  denizbank: "DenizBank",
  diger: "Diğer",
};

const CATEGORY_LABELS: Record<string, string> = {
  personel: "Personel",
  kira: "Kira",
  hammadde: "Hammadde",
  vergi: "Vergi",
  sgk: "SGK",
  mal_satis: "Mal Satışı",
  hizmet_satis: "Hizmet Satışı",
  diger: "Diğer",
};

function integrationLabel(provider: string): string {
  const labels: Record<string, string> = {
    banka_ekstresi: "Banka Ekstresi",
    iyzico_checkout: "iyzico Checkout",
    craftgate: "Craftgate",
    "e-Defter": "e-Defter",
  };
  return labels[provider] ?? provider;
}

function signedAmount(t: BankTransaction): number {
  return (t.direction === "credit" ? 1 : -1) * Number.parseFloat(t.amount);
}

export default function IntegrationsPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const qc = useQueryClient();

  const integrations = useQuery({
    queryKey: ["integrations", slug],
    queryFn: () => v2.listIntegrations(slug),
    enabled: Boolean(slug),
  });

  const txs = useQuery({
    queryKey: ["bank-transactions", slug],
    queryFn: () => v2.listBankTransactions(slug, 100),
    enabled: Boolean(slug),
  });

  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [mockOverrides, setMockOverrides] = useState<Record<string, boolean>>({});

  const upload = useMutation({
    mutationFn: (file: File) => v2.uploadBankStatement(slug, file),
    onSuccess: (res) => {
      setImportErr(null);
      setImportMsg(
        `${BANK_LABELS[res.bank_name] ?? res.bank_name}: ${res.transactions_imported} hareket eklendi` +
          (res.transactions_skipped_duplicate > 0
            ? `, ${res.transactions_skipped_duplicate} mükerrer atlandı.`
            : "."),
      );
      qc.invalidateQueries({ queryKey: ["bank-transactions", slug] });
      qc.invalidateQueries({ queryKey: ["integrations", slug] });
    },
    onError: (err: unknown) => {
      setImportMsg(null);
      if (err instanceof V2ApiError) {
        const detail = (err.detail as { detail?: string } | null)?.detail;
        setImportErr(detail ?? `HTTP ${err.status}`);
      } else {
        setImportErr(err instanceof Error ? err.message : "Bilinmeyen hata");
      }
    },
  });

  const onDrop = useCallback(
    (files: File[]) => {
      if (files[0]) upload.mutate(files[0]);
    },
    [upload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: upload.isPending,
  });

  const rows = txs.data ?? [];
  const activeIntegrations = (integrations.data ?? []).filter(
    (i) => mockOverrides[i.id] ?? i.is_active,
  );
  const monthlyCredits = rows
    .filter((t) => t.direction === "credit")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const monthlyDebits = rows
    .filter((t) => t.direction === "debit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Entegrasyonlar"
        subtitle="Banka, POS ve e-belge bağlantılarının son durumunu izleyin."
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Aktif Bağlantı" value={String(activeIntegrations.length)} icon={<Plug size={20} />} loading={integrations.isLoading} />
        <KpiCard label="Banka Girişi" value={formatTRY(monthlyCredits)} icon={<Building2 size={20} />} loading={txs.isLoading} />
        <KpiCard label="Banka Çıkışı" value={formatTRY(monthlyDebits)} icon={<AlertCircle size={20} />} loading={txs.isLoading} />
        <KpiCard label="Hareket" value={String(rows.length)} icon={<RefreshCw size={20} />} loading={txs.isLoading} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <Card.Header
            title="Bağlı Servisler"
            subtitle={isMockMode ? "Mock modunda aksiyonlar yerel demo durumunu değiştirir." : "Gerçek v2 API bağlantı durumu."}
          />
          <Card.Body>
            {integrations.isLoading ? (
              <div className="grid gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-32" />)}
              </div>
            ) : integrations.data && integrations.data.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-3">
                {integrations.data.map((i) => {
                  const active = mockOverrides[i.id] ?? i.is_active;
                  return (
                    <IntegrationCard
                      key={i.id}
                      integration={i}
                      active={active}
                      onToggle={() => setMockOverrides((prev) => ({ ...prev, [i.id]: !active }))}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Plug size={32} />}
                title="Entegrasyon yok"
                message="Bu tenant için henüz bağlantı kaydı görünmüyor."
              />
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header title="Ekstre Yükleme" subtitle="PDF banka ekstresi içe aktarımı" />
          <Card.Body>
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition ${
            isDragActive ? "border-navy-700 bg-navy-50" : "border-neutral-300 bg-surface"
          } ${upload.isPending ? "opacity-60" : ""}`}
        >
          <input {...getInputProps()} />
          <p className="text-sm">
            {upload.isPending
              ? "PDF işleniyor… (Gemini Vision parse)"
              : "Banka ekstresi PDF'ini buraya sürükle veya tıklayıp seç"}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {isMockMode ? "Mock modunda deterministic demo sonucu döner." : "PDF parse sonucu banka hareketlerine eklenir."}
          </p>
        </div>

        {importMsg && <p className="mt-3 text-sm text-emerald-700">{importMsg}</p>}
        {importErr && <p className="mt-3 text-sm text-red-600">Yükleme hatası: {importErr}</p>}
          </Card.Body>
        </Card>
      </section>

      <Card>
        <Card.Header title="Banka Hareketleri" subtitle="Bu ay içe aktarılan son hareketler" />
        <Card.Body>
          {txs.isLoading && <div className="skeleton h-48" />}
          {txs.data && txs.data.length === 0 && (
            <EmptyState
              icon={<Building2 size={32} />}
              title="Henüz hareket yok"
              message="Bir ekstre yüklediğinizde banka hareketleri burada listelenir."
            />
          )}
          {txs.data && txs.data.length > 0 && <TxTable rows={txs.data} />}
        </Card.Body>
      </Card>
    </div>
  );
}

function IntegrationCard({
  integration,
  active,
  onToggle,
}: {
  integration: Integration;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-navy-900">{integrationLabel(integration.provider)}</h3>
          <p className="mt-1 text-xs text-neutral-500">
            {integration.last_sync_at ? `Son sync: ${formatDateTime(integration.last_sync_at)}` : "Henüz sync yok"}
          </p>
        </div>
        <StatusBadge
          variant={integration.last_error ? "danger" : active ? "success" : "neutral"}
          label={integration.last_error ? "Hata" : active ? "Aktif" : "Pasif"}
          dot={active && !integration.last_error}
        />
      </div>
      {integration.last_error ? (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {integration.last_error}
        </p>
      ) : (
        <p className="mt-3 text-xs text-neutral-600">
          {active ? "Veriler düzenli olarak demo çalışma alanına akıyor." : "Bağlantı askıya alınmış durumda."}
        </p>
      )}
      <Button
        type="button"
        variant={active ? "secondary" : "primary"}
        size="sm"
        className="mt-4 w-full"
        onClick={onToggle}
      >
        {active ? <Unplug size={14} /> : <CheckCircle2 size={14} />}
        {active ? "Bağlantıyı Kes" : "Bağlan"}
      </Button>
    </div>
  );
}

function TxTable({ rows }: { rows: BankTransaction[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-neutral-500">
          <tr>
            <th className="py-2 pr-3">Tarih</th>
            <th className="py-2 pr-3">Açıklama</th>
            <th className="py-2 pr-3">Kategori</th>
            <th className="py-2 pr-3 text-right">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const value = signedAmount(t);
            return (
              <tr key={t.id} className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">
                  {new Date(t.transacted_at).toLocaleDateString("tr-TR")}
                </td>
                <td className="py-2 pr-3">{t.description ?? "—"}</td>
                <td className="py-2 pr-3 text-xs text-neutral-600">
                  {t.category ? CATEGORY_LABELS[t.category] ?? t.category : "—"}
                </td>
                <td
                  className={`py-2 pr-3 text-right font-mono ${
                    value >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {formatTRY(value)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

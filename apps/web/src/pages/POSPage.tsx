import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { CreditCard, RefreshCw, ReceiptText, TrendingUp } from "lucide-react";

import {
  isMockMode,
  V2ApiError,
  v2,
  type PosProvider,
  type PosTransaction,
} from "../api/v2";
import { Button, Card, EmptyState, KpiCard, PageHeader, StatusBadge } from "../components/ui";
import { formatDateTime, formatTRY } from "../lib/utils";

const DATE_TIME = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

const TXN_TYPE_LABELS: Record<PosTransaction["txn_type"], string> = {
  sale: "Satış",
  refund: "İade",
  void: "İptal",
  preauth: "Ön Otorizasyon",
};

const STATUS_CLASSES: Record<PosTransaction["status"], string> = {
  success: "bg-emerald-100 text-emerald-800 border-emerald-300",
  failed: "bg-red-100 text-red-800 border-red-300",
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  cancelled: "bg-neutral-100 text-neutral-700 border-neutral-300",
};

const STATUS_LABELS: Record<PosTransaction["status"], string> = {
  success: "Başarılı",
  failed: "Hatalı",
  pending: "Bekliyor",
  cancelled: "İptal",
};

function signedTxn(t: PosTransaction): number {
  const value = Number(t.amount);
  return t.txn_type === "refund" ? -value : value;
}

function successfulNet(rows: PosTransaction[]): number {
  return rows.filter((t) => t.status === "success").reduce((sum, t) => sum + signedTxn(t), 0);
}

export default function POSPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const qc = useQueryClient();

  const cfg = useQuery({
    queryKey: ["pos-config", slug],
    queryFn: () => v2.getPosConfig(slug),
    enabled: Boolean(slug),
  });
  const txns = useQuery({
    queryKey: ["pos-transactions", slug],
    queryFn: () => v2.listPosTransactions(slug, 50),
    enabled: Boolean(slug),
    // MVP: polling. Faz 7+'da Supabase Realtime subscription.
    refetchInterval: 15000,
  });
  const summary = useQuery({
    queryKey: ["pos-summary", slug],
    queryFn: () => v2.getPosSummary(slug),
    enabled: Boolean(slug),
    refetchInterval: 30000,
  });

  const [provider, setProvider] = useState<PosProvider>("iyzico_checkout");
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      v2.putPosConfig(slug, {
        provider,
        credentials: { api_key: apiKey, secret_key: secretKey },
        webhook_secret: webhookSecret,
      }),
    onSuccess: () => {
      setOkMsg("Yapılandırma kaydedildi.");
      setErr(null);
      setSecretKey("");
      setWebhookSecret("");
      qc.invalidateQueries({ queryKey: ["pos-config", slug] });
    },
    onError: (e: unknown) => {
      setOkMsg(null);
      if (e instanceof V2ApiError) {
        const d = (e.detail as { detail?: string } | null)?.detail;
        setErr(d ?? `HTTP ${e.status}`);
      } else {
        setErr(e instanceof Error ? e.message : "Bilinmeyen hata");
      }
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  const c = cfg.data;
  const webhookFull = c?.webhook_url
    ? `${window.location.origin.replace(/:\d+$/, ":8000")}${c.webhook_url}`
    : null;
  const txRows = txns.data ?? [];
  const monthNet = successfulNet(txRows);
  const weekNet = successfulNet(txRows.slice(0, 7));
  const saleItems = txRows.filter((t) => t.status === "success" && t.txn_type === "sale").length;
  const terminals = [
    { name: "Web Checkout", provider: "iyzico", status: "Aktif", amount: monthNet * 0.62 },
    { name: "Mağaza Terminali", provider: "iyzico", status: "Aktif", amount: monthNet * 0.28 },
    { name: "Mobil Link", provider: "Craftgate", status: "Test", amount: monthNet * 0.1 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sanal POS"
        subtitle="Online ödeme terminalleri, günlük özet ve işlem akışı."
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Bugün Net"
          value={formatTRY(Number(summary.data?.net_amount ?? 0))}
          icon={<CreditCard size={20} />}
          loading={summary.isLoading}
        />
        <KpiCard
          label="Haftalık Net"
          value={formatTRY(weekNet)}
          icon={<TrendingUp size={20} />}
          loading={txns.isLoading}
        />
        <KpiCard
          label="Bu Ay POS"
          value={formatTRY(monthNet)}
          icon={<ReceiptText size={20} />}
          loading={txns.isLoading}
        />
        <KpiCard
          label="Başarılı Satış"
          value={String(saleItems)}
          icon={<RefreshCw size={20} />}
          loading={txns.isLoading}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <Card.Header title="Terminaller" subtitle="Sağlayıcı ve kanal bazlı satış dağılımı" />
          <Card.Body>
            <div className="grid gap-3 md:grid-cols-3">
              {terminals.map((terminal) => (
                <div key={terminal.name} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-navy-900">{terminal.name}</h3>
                      <p className="mt-1 text-xs text-neutral-500">{terminal.provider}</p>
                    </div>
                    <StatusBadge
                      variant={terminal.status === "Aktif" ? "success" : "warning"}
                      label={terminal.status}
                      dot={terminal.status === "Aktif"}
                    />
                  </div>
                  <p className="mt-4 font-mono text-lg font-semibold text-navy-900">
                    {formatTRY(terminal.amount)}
                  </p>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header title="Yapılandırma" subtitle="Webhook ve sağlayıcı durumu" />
          <Card.Body>
        {cfg.isLoading && <div className="skeleton h-20" />}
        {c && (
          <div className="space-y-2 text-sm text-neutral-700">
            <p>Sağlayıcı: <strong>{c.provider ?? "—"}</strong></p>
            <p>Aktif: <strong>{c.is_active ? "Evet" : "Hayır"}</strong></p>
            <p>Son webhook: {c.last_sync_at ? formatDateTime(c.last_sync_at) : "—"}</p>
          </div>
        )}

        {webhookFull && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>Webhook URL:</strong>{" "}
            <code className="font-mono">{webhookFull}</code>
            <br />
            HMAC-SHA256, header: <code>X-Pos-Signature</code>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 space-y-2 text-sm">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as PosProvider)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5"
          >
            <option value="iyzico_checkout">iyzico Checkout</option>
            <option value="craftgate">Craftgate</option>
          </select>
          <input
            type="text"
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required={!isMockMode}
            className="w-full rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            type="password"
            placeholder="Secret Key"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            required={!isMockMode}
            className="w-full rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            type="text"
            placeholder="Webhook Secret (8-128 karakter)"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            required={!isMockMode}
            minLength={8}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 font-mono"
          />
          {okMsg && <p className="text-emerald-700">{okMsg}</p>}
          {err && <p className="text-red-600">{err}</p>}
          <Button
            type="submit"
            loading={save.isPending}
            size="sm"
          >
            Kaydet
          </Button>
        </form>
          </Card.Body>
        </Card>
      </section>

      <Card>
        <Card.Header title="Son İşlemler" subtitle="Satış, iade ve bekleyen POS hareketleri" />
        <Card.Body>
        {txns.isLoading && <div className="skeleton h-48" />}
        {txns.data && txns.data.length === 0 && (
          <EmptyState
            icon={<CreditCard size={32} />}
            title="Henüz işlem yok"
            message="Webhook üzerinden gelen POS hareketleri burada listelenir."
          />
        )}
        {txns.data && txns.data.length > 0 && <TxTable rows={txns.data} />}
        </Card.Body>
      </Card>
    </div>
  );
}

function TxTable({ rows }: { rows: PosTransaction[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-neutral-500">
          <tr>
            <th className="py-2 pr-3">Tarih</th>
            <th className="py-2 pr-3">Tür</th>
            <th className="py-2 pr-3">Durum</th>
            <th className="py-2 pr-3">Kart</th>
            <th className="py-2 pr-3 text-right">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-border/60">
              <td className="py-2 pr-3 font-mono text-xs">
                {DATE_TIME.format(new Date(t.transacted_at))}
              </td>
              <td className="py-2 pr-3">{TXN_TYPE_LABELS[t.txn_type]}</td>
              <td className="py-2 pr-3">
                <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_CLASSES[t.status]}`}>
                  {STATUS_LABELS[t.status]}
                </span>
              </td>
              <td className="py-2 pr-3 font-mono text-xs text-neutral-600">
                {t.card_last_four ? `**** ${t.card_last_four}` : "—"}
                {t.installments > 1 && (
                  <span className="ml-1 text-[10px] text-neutral-500">{t.installments}x</span>
                )}
              </td>
              <td
                className={`py-2 pr-3 text-right font-mono ${
                  t.txn_type === "refund" ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {formatTRY(signedTxn(t))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

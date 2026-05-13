import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";

import {
  V2ApiError,
  v2,
  type PosProvider,
  type PosTransaction,
} from "../api/v2";

const TRY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
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

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-xl">Sanal POS</h1>
        <p className="text-xs text-neutral-500">
          iyzico Checkout BYOI. Webhook ile gelen online ödemeleri yakalar.
        </p>
      </header>

      {summary.data && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Bugün Satış" value={TRY.format(Number(summary.data.total_sales))} />
          <Kpi label="Bugün İade" value={TRY.format(Number(summary.data.total_refunds))} />
          <Kpi
            label="Net"
            value={TRY.format(Number(summary.data.net_amount))}
            tone={Number(summary.data.net_amount) >= 0 ? "good" : "bad"}
          />
          <Kpi label="İşlem" value={String(summary.data.sale_count + summary.data.refund_count)} />
        </section>
      )}

      <section className="rounded border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium">Yapılandırma</h2>
        {cfg.isLoading && <p className="text-xs text-neutral-500">Yükleniyor…</p>}
        {c && (
          <p className="text-xs text-neutral-600">
            Sağlayıcı: <strong>{c.provider ?? "—"}</strong> · Aktif:{" "}
            <strong>{c.is_active ? "Evet" : "Hayır"}</strong> · Son webhook:{" "}
            {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString("tr-TR") : "—"}
          </p>
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
            required
            className="w-full rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            type="password"
            placeholder="Secret Key"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            required
            className="w-full rounded border border-neutral-300 px-2 py-1.5"
          />
          <input
            type="text"
            placeholder="Webhook Secret (8-128 karakter)"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            required
            minLength={8}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 font-mono"
          />
          {okMsg && <p className="text-emerald-700">{okMsg}</p>}
          {err && <p className="text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded bg-navy-900 px-3 py-1.5 text-white disabled:opacity-60"
          >
            {save.isPending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg">Son İşlemler</h2>
        {txns.isLoading && <p className="text-sm text-neutral-500">Yükleniyor…</p>}
        {txns.data && txns.data.length === 0 && (
          <p className="text-sm text-neutral-500">Henüz işlem yok.</p>
        )}
        {txns.data && txns.data.length > 0 && <TxTable rows={txns.data} />}
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "bad" ? "text-red-700" : tone === "good" ? "text-emerald-700" : "text-neutral-900";
  return (
    <div className="rounded border border-border bg-surface px-4 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-1 font-mono text-lg ${color}`}>{value}</div>
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
                  {t.status}
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
                {t.txn_type === "refund" ? "−" : ""}
                {TRY.format(Number.parseFloat(t.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

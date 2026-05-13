import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useParams } from "react-router-dom";

import { V2ApiError, v2, type BankTransaction } from "../api/v2";

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

const TRY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });

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

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 font-display text-xl">Entegrasyonlar</h1>

        <div
          {...getRootProps()}
          className={`cursor-pointer rounded border-2 border-dashed p-8 text-center transition ${
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
            Faz 3 — yalnızca PDF parse; banka API bağlantısı v2'de yok.
          </p>
        </div>

        {importMsg && <p className="mt-3 text-sm text-emerald-700">{importMsg}</p>}
        {importErr && <p className="mt-3 text-sm text-red-600">Yükleme hatası: {importErr}</p>}

        <h2 className="mt-6 mb-2 text-sm font-medium text-neutral-700">Bağlı Servisler</h2>
        {integrations.isLoading && <p className="text-sm text-neutral-500">Yükleniyor…</p>}
        {integrations.data && integrations.data.length === 0 && (
          <p className="text-sm text-neutral-500">Henüz entegrasyon yok.</p>
        )}
        <ul className="space-y-1">
          {integrations.data?.map((i) => (
            <li key={i.id} className="rounded border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium">{i.provider}</span>
              {i.last_sync_at && (
                <span className="ml-2 text-xs text-neutral-500">
                  son senk: {new Date(i.last_sync_at).toLocaleString("tr-TR")}
                </span>
              )}
              {i.last_error && (
                <span className="ml-2 text-xs text-red-600">son hata: {i.last_error}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg">Banka Hareketleri</h2>
        {txs.isLoading && <p className="text-sm text-neutral-500">Yükleniyor…</p>}
        {txs.data && txs.data.length === 0 && (
          <p className="text-sm text-neutral-500">Henüz hareket yok. Bir ekstre yükle.</p>
        )}
        {txs.data && txs.data.length > 0 && <TxTable rows={txs.data} />}
      </section>
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
            const sign = t.direction === "credit" ? 1 : -1;
            const value = sign * Number.parseFloat(t.amount);
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
                  {TRY.format(value)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

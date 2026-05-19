import type {
  AIContextAction,
  AIInsightCard,
  Integration,
  PosTransaction,
  RecommendedAction,
  TaxCalendarItem,
} from "../api/v2";

function textOrFallback(value: string | null | undefined, fallback: string) {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

function moneyOrFallback(amount: string | null | undefined, currency: string | null | undefined) {
  if (!amount) return "tutar bilinmiyor";
  return `${amount} ${textOrFallback(currency, "TRY")}`;
}

export function buildIntegrationAIPrompt(integration: Integration): string {
  const lastSync = textOrFallback(integration.last_sync_at, "son sync bilgisi yok");
  const lastError = textOrFallback(integration.last_error, "aktif hata görünmüyor");
  const activeStatus = integration.is_active ? "aktif" : "pasif";
  return [
    "Entegrasyon kartını analiz et.",
    `Sağlayıcı: ${integration.provider}.`,
    `Durum: ${activeStatus}.`,
    `Son sync: ${lastSync}.`,
    `Son hata: ${lastError}.`,
    "Bu bağlantının operasyonel etkisini, kök neden ihtimallerini ve sonraki en doğru adımı açıkla.",
  ].join(" ");
}

export function buildTaxItemAIPrompt(item: TaxCalendarItem): string {
  return [
    "Vergi kalemini analiz et.",
    `Kalem: ${item.title}.`,
    `Tür: ${item.tax_type}.`,
    `Vade: ${textOrFallback(item.due_date, "bilinmiyor")}.`,
    `Tutar: ${moneyOrFallback(item.amount, item.currency)}.`,
    `Durum: ${item.status}.`,
    `Dönem: ${textOrFallback(item.period, "dönem bilgisi yok")}.`,
    `Not: ${textOrFallback(item.notes, "ek not yok")}.`,
    "Öncelik seviyesini, gecikme riskini ve bugün alınması gereken aksiyonu belirt.",
  ].join(" ");
}

export function buildPosTransactionAIPrompt(txn: PosTransaction): string {
  return [
    "POS işlemini açıkla ve yorumla.",
    `İşlem tipi: ${txn.txn_type}.`,
    `Durum: ${txn.status}.`,
    `Tutar: ${moneyOrFallback(txn.amount, txn.currency)}.`,
    `Taksit: ${txn.installments || 1}.`,
    `Sağlayıcı: ${txn.pos_provider}.`,
    `Kart son dört: ${textOrFallback(txn.card_last_four, "bilinmiyor")}.`,
    `Açıklama: ${textOrFallback(txn.description, "açıklama yok")}.`,
    "Bu işlemin olası anlamını, risk seviyesini ve kontrol edilmesi gereken paterni anlat.",
  ].join(" ");
}

export function buildPosTerminalAIPrompt(terminal: {
  name: string;
  provider: string;
  status: string;
  amount: number;
}) {
  return [
    "POS terminal performansını yorumla.",
    `Terminal: ${terminal.name}.`,
    `Sağlayıcı: ${terminal.provider}.`,
    `Durum: ${terminal.status}.`,
    `Hacim: ${terminal.amount.toFixed(2)} TRY.`,
    "Bu kanalın performansını, olası darboğazlarını ve optimize edilmesi gereken noktaları açıkla.",
  ].join(" ");
}

export function buildDashboardActionPrompt(action: RecommendedAction): string {
  return [
    "Dashboard aksiyonunu gerekçelendir ve plana çevir.",
    `Aksiyon: ${action.title}.`,
    `Detay: ${action.detail}.`,
    `Öncelik: ${action.priority}.`,
    `Zaman ipucu: ${action.due_hint}.`,
    `Kaynak ajan: ${action.source_agent}.`,
    "Neden önemli olduğunu ve bugün uygulanabilir kısa bir planı yaz.",
  ].join(" ");
}

export function buildDashboardRiskPrompt(input: {
  riskLabel?: string | null;
  riskScore?: number | null;
  explanation?: string | null;
}) {
  return [
    "Dashboard risk panelini derinleştir.",
    `Risk etiketi: ${textOrFallback(input.riskLabel, "bilinmiyor")}.`,
    `Risk skoru: ${input.riskScore ?? "bilinmiyor"}.`,
    `Açıklama: ${textOrFallback(input.explanation, "açıklama yok")}.`,
    "Ana sürücüleri, erken alarm işaretlerini ve azaltım sırasını açıkla.",
  ].join(" ");
}

export function buildCashFlowScenarioPrompt(input: {
  nextNet?: number | null;
  upcomingTaxTotal?: number;
  posSales?: number;
}) {
  return [
    "Nakit akışı için kısa senaryo analizi yap.",
    `Sonraki dönem net beklenti: ${input.nextNet ?? "bilinmiyor"} TRY.`,
    `Yaklaşan vergi toplamı: ${(input.upcomingTaxTotal ?? 0).toFixed(2)} TRY.`,
    `Bu ay POS satışı: ${(input.posSales ?? 0).toFixed(2)} TRY.`,
    "En iyi, baz ve stres senaryosunda hangi tahsilat veya ödeme kararı değişmeli?",
  ].join(" ");
}

export function buildUploadAnalysisPrompt(input: {
  importedCount?: number | null;
  duplicateCount?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}) {
  return [
    "Banka ekstresi yüklendikten sonra hangi analizlerin çalışacağını açıkla.",
    `İçe aktarılan hareket: ${input.importedCount ?? 0}.`,
    `Mükerrer atlanan: ${input.duplicateCount ?? 0}.`,
    `Dönem başlangıcı: ${textOrFallback(input.periodStart, "bilinmiyor")}.`,
    `Dönem bitişi: ${textOrFallback(input.periodEnd, "bilinmiyor")}.`,
    "Beklenen içgörüleri, kontrolleri ve eksik veri risklerini özetle.",
  ].join(" ");
}

export function buildInsightExplainAction(insight: AIInsightCard): AIContextAction {
  return {
    id: `${insight.id}-explain`,
    label: "Sorunu Yorumla",
    variant: "explain",
    prompt: [
      "Bu AI içgörüsünü açıkla.",
      `Başlık: ${insight.title}.`,
      `Detay: ${insight.detail}.`,
      `Ton: ${textOrFallback(insight.tone, "neutral")}.`,
      "Bu sinyalin ne anlama geldiğini ve ne yapılması gerektiğini belirt.",
    ].join(" "),
  };
}

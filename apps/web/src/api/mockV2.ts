import type {
  BankImportResult,
  BankTransaction,
  ChatMessageV2,
  ChatRequestV2,
  DashboardActivity,
  DashboardSummary,
  Integration,
  PosConfigIn,
  PosConfigOut,
  PosDailySummary,
  PosTransaction,
  TaxCalendarItem,
  TaxCalendarPatch,
  TaxStatus,
  TenantCreate,
  TenantOut,
} from "./v2";

const MOCK_NOW = new Date("2026-05-16T09:30:00+03:00");
const MOCK_TODAY = MOCK_NOW.toISOString().slice(0, 10);

function hashSlug(slug: string): number {
  return slug.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function tenantId(slug: string): string {
  return `tenant_${slug.replace(/[^a-z0-9_-]/gi, "_")}`;
}

function isoDay(offset: number, hour = 10, minute = 0): string {
  const d = new Date(MOCK_NOW);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function amount(n: number): string {
  return n.toFixed(2);
}

function displayName(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1))
    .join(" ") || "Demo İşletme";
}

function tenant(slug: string): TenantOut {
  return {
    id: tenantId(slug),
    slug,
    display_name: displayName(slug),
    sector: hashSlug(slug) % 2 === 0 ? "Perakende" : "Hizmet",
    company_type: hashSlug(slug) % 3 === 0 ? "limited" : "anonim",
    tax_number: `39${String(hashSlug(slug)).padStart(8, "0").slice(0, 8)}`,
    is_active: true,
    created_at: "2026-01-10T08:00:00.000Z",
  };
}

function integrations(slug: string): Integration[] {
  const id = tenantId(slug);
  return [
    {
      id: `${id}_int_bank`,
      provider: "banka_ekstresi",
      is_active: true,
      config: { bank_name: hashSlug(slug) % 2 === 0 ? "Garanti BBVA" : "İş Bankası" },
      last_sync_at: isoDay(-1, 17, 20),
      last_error: null,
    },
    {
      id: `${id}_int_pos`,
      provider: "iyzico_checkout",
      is_active: true,
      config: { mode: "test", terminal_count: 3 },
      last_sync_at: isoDay(0, 8, 45),
      last_error: null,
    },
    {
      id: `${id}_int_edefter`,
      provider: "e-Defter",
      is_active: false,
      config: { period: "2026-05" },
      last_sync_at: isoDay(-8, 11, 15),
      last_error: "Yetki yenilemesi gerekiyor",
    },
  ];
}

function bankTransactions(slug: string): BankTransaction[] {
  const id = tenantId(slug);
  const seed = hashSlug(slug) % 900;
  const rows: Array<[number, "credit" | "debit", number, string, string]> = [
    [-1, "credit", 98500 + seed, "Kurumsal müşteri tahsilatı", "hizmet_satis"],
    [-2, "debit", 18400, "Mayıs personel avansı", "personel"],
    [-4, "debit", 12600, "Depo kira ödemesi", "kira"],
    [-5, "credit", 56250 + seed, "E-ticaret toplu ödeme", "mal_satis"],
    [-7, "debit", 8300, "SGK prim ödemesi", "sgk"],
    [-10, "debit", 22450, "Tedarikçi mal alımı", "hammadde"],
  ];

  return rows.map(([offset, direction, value, description, category], index) => ({
    id: `${id}_bank_${index + 1}`,
    tenant_id: id,
    source_document_id: `${id}_doc_mayis`,
    bank_name: hashSlug(slug) % 2 === 0 ? "garanti" : "is_bankasi",
    account_iban: "TR00 0000 0000 0000 0000 0000 00",
    amount: amount(value),
    currency: "TRY",
    direction,
    description,
    reference_no: `REF-${hashSlug(slug)}-${index + 1}`,
    category,
    transacted_at: isoDay(offset, 12 + index, 5),
    created_at: isoDay(offset, 12 + index, 7),
  }));
}

function posTransactions(slug: string): PosTransaction[] {
  const id = tenantId(slug);
  const seed = hashSlug(slug) % 500;
  const rows: Array<[number, number, PosTransaction["txn_type"], PosTransaction["status"], string, number]> = [
    [0, 12450 + seed, "sale", "success", "4821", 1],
    [0, 8790, "sale", "success", "1934", 3],
    [0, 2450, "refund", "success", "1934", 3],
    [-1, 18600 + seed, "sale", "success", "7742", 1],
    [-2, 9200, "sale", "success", "5510", 2],
    [-3, 4100, "sale", "pending", "6204", 1],
    [-6, 13600, "sale", "success", "0881", 1],
    [-9, 5200, "refund", "success", "7742", 1],
    [-12, 24900 + seed, "sale", "success", "3108", 4],
  ];

  return rows.map(([offset, value, txnType, status, card, installments], index) => ({
    id: `${id}_pos_${index + 1}`,
    tenant_id: id,
    pos_provider: "iyzico_checkout",
    external_id: `mock-${slug}-${index + 1}`,
    amount: amount(value),
    currency: "TRY",
    txn_type: txnType,
    status,
    payment_method: index % 3 === 0 ? "debit_card" : "credit_card",
    installments,
    card_last_four: card,
    description: txnType === "refund" ? "Müşteri iadesi" : "Online satış",
    transacted_at: isoDay(offset, 9 + index, 20),
    created_at: isoDay(offset, 9 + index, 21),
  }));
}

function taxCalendar(slug: string): TaxCalendarItem[] {
  const id = tenantId(slug);
  return [
    {
      id: `${id}_tax_kdv`,
      tenant_id: id,
      title: "Mayıs KDV Beyannamesi",
      description: "Nisan dönemi KDV tahakkuku",
      tax_type: "kdv",
      due_date: isoDay(10).slice(0, 10),
      amount: amount(28400 + (hashSlug(slug) % 700)),
      currency: "TRY",
      status: "pending",
      period: "2026-04",
      notes: "POS satışları ve e-fatura kayıtlarıyla mutabakat bekliyor.",
      created_at: isoDay(-15),
      updated_at: isoDay(-1),
    },
    {
      id: `${id}_tax_sgk`,
      tenant_id: id,
      title: "SGK Prim Ödemesi",
      description: "Nisan bordro primleri",
      tax_type: "sgk",
      due_date: isoDay(15).slice(0, 10),
      amount: amount(18650),
      currency: "TRY",
      status: "pending",
      period: "2026-04",
      notes: null,
      created_at: isoDay(-15),
      updated_at: isoDay(-1),
    },
    {
      id: `${id}_tax_muhtasar`,
      tenant_id: id,
      title: "Muhtasar Beyanname",
      description: "Stopaj ve muhtasar prim bildirimi",
      tax_type: "muhtasar",
      due_date: isoDay(-3).slice(0, 10),
      amount: amount(9400),
      currency: "TRY",
      status: "overdue",
      period: "2026-04",
      notes: "Gecikme cezası oluşmadan kapatılmalı.",
      created_at: isoDay(-20),
      updated_at: isoDay(-3),
    },
    {
      id: `${id}_tax_gecici`,
      tenant_id: id,
      title: "Geçici Vergi",
      description: "1. dönem geçici vergi",
      tax_type: "gecici_vergi",
      due_date: isoDay(-6).slice(0, 10),
      amount: amount(31200),
      currency: "TRY",
      status: "paid",
      period: "2026-Q1",
      notes: "Banka üzerinden ödendi.",
      created_at: isoDay(-30),
      updated_at: isoDay(-6),
    },
  ];
}

function posSummary(slug: string, targetDate = MOCK_TODAY): PosDailySummary {
  const rows = posTransactions(slug).filter((t) => t.transacted_at.slice(0, 10) === targetDate);
  const saleRows = rows.filter((t) => t.txn_type === "sale" && t.status === "success");
  const refundRows = rows.filter((t) => t.txn_type === "refund" && t.status === "success");
  const totalSales = saleRows.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalRefunds = refundRows.reduce((sum, t) => sum + Number(t.amount), 0);
  const net = totalSales - totalRefunds;
  return {
    date: targetDate,
    total_sales: amount(totalSales),
    total_refunds: amount(totalRefunds),
    net_amount: amount(net),
    sale_count: saleRows.length,
    refund_count: refundRows.length,
    avg_ticket: saleRows.length > 0 ? amount(totalSales / saleRows.length) : null,
  };
}

function dashboardSummary(slug: string): DashboardSummary {
  const banks = bankTransactions(slug);
  const pos = posTransactions(slug);
  const taxes = taxCalendar(slug);
  const month = "2026-05";
  const bankNet = banks.reduce(
    (sum, t) => sum + (t.direction === "credit" ? 1 : -1) * Number(t.amount),
    0,
  );
  const posSalesMonth = pos
    .filter((t) => t.status === "success" && t.transacted_at.startsWith(month))
    .reduce((sum, t) => sum + (t.txn_type === "refund" ? -Number(t.amount) : Number(t.amount)), 0);
  const upcomingTaxes = taxes
    .filter((t) => t.status === "pending")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const bankActivities: DashboardActivity[] = banks.slice(0, 4).map((t) => ({
    id: `${t.id}_act`,
    type: "bank",
    title: t.description ?? "Banka hareketi",
    amount: amount((t.direction === "credit" ? 1 : -1) * Number(t.amount)),
    currency: t.currency,
    timestamp: t.transacted_at,
  }));
  const posActivities: DashboardActivity[] = pos.slice(0, 4).map((t) => ({
    id: `${t.id}_act`,
    type: "pos",
    title: t.txn_type === "refund" ? "POS iadesi" : "POS satışı",
    amount: amount((t.txn_type === "refund" ? -1 : 1) * Number(t.amount)),
    currency: t.currency,
    timestamp: t.transacted_at,
  }));
  const taxActivities: DashboardActivity[] = taxes.slice(0, 2).map((t) => ({
    id: `${t.id}_act`,
    type: "tax",
    title: t.status === "paid" ? `${t.title} ödendi` : `${t.title} bekliyor`,
    amount: t.amount ? amount(-Number(t.amount)) : null,
    currency: t.currency,
    timestamp: t.updated_at,
  }));

  return {
    period_start: "2026-05-01",
    period_end: MOCK_TODAY,
    net_flow_this_month: amount(bankNet + posSalesMonth),
    pos_sales_this_month: amount(posSalesMonth),
    upcoming_tax_count: upcomingTaxes.length,
    integration_count: integrations(slug).filter((i) => i.is_active).length,
    upcoming_taxes: upcomingTaxes.slice(0, 3),
    recent_activities: [...bankActivities, ...posActivities, ...taxActivities]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8),
    updated_at: MOCK_NOW.toISOString(),
  };
}

export const mockV2 = {
  registerTenant: async (payload: TenantCreate): Promise<TenantOut> => tenant(payload.slug),
  listMyTenants: async (): Promise<TenantOut[]> => [tenant("kuzey-market"), tenant("atlas-mobilya")],
  getTenant: async (slug: string): Promise<TenantOut> => tenant(slug),
  updateTenant: async (
    slug: string,
    patch?: Partial<Pick<TenantCreate, "display_name" | "sector" | "tax_number">>,
  ): Promise<TenantOut> => ({ ...tenant(slug), ...patch }),
  listMembers: async (slug: string) => [
    {
      id: `${tenantId(slug)}_member_owner`,
      tenant_id: tenantId(slug),
      user_id: "mock-user",
      role: "owner" as const,
      created_at: "2026-01-10T08:00:00.000Z",
    },
  ],
  uploadBankStatement: async (slug: string, _file?: File): Promise<BankImportResult> => ({
    document_id: `${tenantId(slug)}_doc_upload`,
    transactions_imported: 6,
    transactions_skipped_duplicate: 1,
    bank_name: hashSlug(slug) % 2 === 0 ? "garanti" : "is_bankasi",
    period_start: "2026-05-01",
    period_end: MOCK_TODAY,
  }),
  listIntegrations: async (slug: string): Promise<Integration[]> => integrations(slug),
  listBankTransactions: async (slug: string, limit = 100): Promise<BankTransaction[]> =>
    bankTransactions(slug).slice(0, limit),
  listTaxCalendar: async (
    slug: string,
    opts?: { upcomingDays?: number; status?: TaxStatus },
  ): Promise<TaxCalendarItem[]> => {
    let rows = taxCalendar(slug);
    if (opts?.status) rows = rows.filter((r) => r.status === opts.status);
    if (opts?.upcomingDays) {
      const cutoff = new Date(MOCK_NOW);
      cutoff.setDate(cutoff.getDate() + opts.upcomingDays);
      rows = rows.filter((r) => new Date(r.due_date) <= cutoff);
    }
    return rows;
  },
  patchTaxCalendarItem: async (
    slug: string,
    itemId: string,
    patch: TaxCalendarPatch,
  ): Promise<TaxCalendarItem> => {
    const rows = taxCalendar(slug);
    const row = rows.find((item) => item.id === itemId) ?? rows[0];
    if (!row) throw new Error("Mock tax calendar is empty");
    return { ...row, ...patch, updated_at: MOCK_NOW.toISOString() };
  },
  getPosConfig: async (slug: string): Promise<PosConfigOut> => ({
    provider: "iyzico_checkout",
    is_active: true,
    has_credentials: true,
    has_webhook_secret: true,
    last_sync_at: isoDay(0, 8, 45),
    last_error: null,
    webhook_url: `/v2/${encodeURIComponent(slug)}/pos/webhook`,
  }),
  putPosConfig: async (_slug: string, payload: PosConfigIn): Promise<PosConfigOut> => ({
    provider: payload.provider,
    is_active: true,
    has_credentials: true,
    has_webhook_secret: true,
    last_sync_at: MOCK_NOW.toISOString(),
    last_error: null,
    webhook_url: `/v2/${encodeURIComponent(_slug)}/pos/webhook`,
  }),
  listPosTransactions: async (slug: string, limit = 100): Promise<PosTransaction[]> =>
    posTransactions(slug).slice(0, limit),
  getPosSummary: async (slug: string, targetDate?: string): Promise<PosDailySummary> =>
    posSummary(slug, targetDate ?? MOCK_TODAY),
  getDashboardSummary: async (slug: string): Promise<DashboardSummary> => dashboardSummary(slug),
  getChatHistory: async (
    _slug?: string,
    _sessionId?: string,
    _limit?: number,
  ): Promise<ChatMessageV2[]> => [],
  streamChatV2: async (
    slug: string,
    payload: ChatRequestV2,
    onChunk: (text: string) => void,
    _signal?: AbortSignal,
  ): Promise<void> => {
    const summary = dashboardSummary(slug);
    const text = [
      `${displayName(slug)} için mock demo yanıtı:`,
      `bu ay POS net satışı ${Number(summary.pos_sales_this_month).toLocaleString("tr-TR")} TL.`,
      payload.message.toLocaleLowerCase("tr-TR").includes("kdv")
        ? `Yaklaşan KDV kalemi ${summary.upcoming_taxes[0]?.amount ?? "0"} TL görünüyor.`
        : "Banka, POS ve vergi verileri demo veri setinden okunuyor.",
    ].join(" ");
    for (const part of text.match(/.{1,32}(\s|$)/g) ?? [text]) {
      onChunk(part);
      await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
    }
  },
};

import type {
  AIPageKind,
  AIQuickAction,
  AIInsightCard,
  BankImportResult,
  BankTransaction,
  ChatMessageV2,
  ChatRequestV2,
  AnalysisResult,
  AnalyzeRequestV2,
  DashboardActivity,
  DashboardSummary,
  Integration,
  InvoiceData,
  InvoiceUploadOut,
  JobStartedOut,
  PosConfigIn,
  PosConfigOut,
  PosDailySummary,
  PosTransaction,
  TaxCalendarItem,
  TaxCalendarPatch,
  TaxStatus,
  TenantPageAIView,
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
    recommended_actions: [
      {
        title: "KDV ve SGK çıkışlarını sırala",
        detail: "Bu hafta vadesi yaklaşan vergi kalemlerini tahsilat planıyla eşleştirip önce cezaya açık kalemleri kapatın.",
        priority: "high",
        due_hint: "Bu hafta",
        source_agent: "risk",
      },
      {
        title: "Başarısız POS işlemlerini gözden geçir",
        detail: "Başarısız satış denemelerini kanal ve banka bazında inceleyip kayıp tahsilatı azaltın.",
        priority: "medium",
        due_hint: "Bu ay",
        source_agent: "collections_agent",
      },
    ],
    updated_at: MOCK_NOW.toISOString(),
  };
}

function mockInvoice(slug: string): InvoiceData {
  const seed = hashSlug(slug) % 700;
  return {
    invoice_id: `INV-${slug}-2026-05`,
    vendor_name: `${displayName(slug)} Tedarik`,
    vendor_tax_no: "3912345678",
    date: "2026-05-12",
    due_date: "2026-05-26",
    items: [
      {
        description: "Perakende stok alımı",
        quantity: 1,
        unit_price: 42000 + seed,
        total: 42000 + seed,
        kdv_rate: 20,
      },
    ],
    subtotal: 42000 + seed,
    kdv_amount: 8400 + seed * 0.2,
    total_amount: 50400 + seed * 1.2,
    currency: "TRY",
    category: "gider",
    raw_text: "Mock tenant demo invoice",
  };
}

function mockAnalysis(slug: string, jobId = `mock-job-${slug}`): AnalysisResult {
  const summary = dashboardSummary(slug);
  const invoice = mockInvoice(slug);
  return {
    job_id: jobId,
    status: "completed",
    invoices: [invoice],
    cash_flow_forecast: [
      {
        month: "2026-06",
        income: 182000,
        expense: 126000,
        net: 48750,
        kdv_payment: 0,
        sgk_payment: 7250,
        cumulative: 48750,
      },
      {
        month: "2026-07",
        income: 176000,
        expense: 132500,
        net: 35800,
        kdv_payment: 0,
        sgk_payment: 7700,
        cumulative: 84550,
      },
      {
        month: "2026-08",
        income: 190000,
        expense: 138000,
        net: 29400,
        kdv_payment: 14200,
        sgk_payment: 8400,
        cumulative: 113950,
      },
    ],
    risk_score: 3,
    risk_label: "yellow",
    risk_explanation:
      "POS satışları sağlıklı ancak Mayıs sonunda KDV ve SGK çıkışları nakit tamponunu azaltıyor.",
    risk_key_drivers: [
      "Mayıs sonunda biriken KDV ve SGK çıkışları nakit tamponunu daraltıyor.",
      "Gecikmiş muhtasar kalemi operasyonel takip baskısı yaratıyor.",
    ],
    risk_recommended_actions: [
      {
        title: "Vergi ödeme sırasını netleştirin",
        detail: "KDV, SGK ve gecikmiş muhtasar kalemlerini aynı haftada çıkacak nakit ihtiyacına göre önceliklendirin.",
        priority: "high",
        due_hint: "Bu hafta",
        source_agent: "risk",
      },
      {
        title: "Tahsilat tamponu oluşturun",
        detail: "Önümüzdeki vergi haftası için en hızlı tahsil edilebilecek müşteri bakiyelerini öne çekin.",
        priority: "medium",
        due_hint: "Bu ay",
        source_agent: "collections_agent",
      },
    ],
    risk_priority: "high",
    risk_time_horizon: "this_week",
    tax_recommendations: [
      {
        recommendation:
          "Mayıs KDV beyannamesi için POS satışları ve banka tahsilatlarını 24 Mayıs'a kadar mutabık hale getirin.",
        source: "KDV Kanunu",
        article: "KDV genel beyan dönemi",
        confidence: 4.2,
        scope: "global",
        action: "review",
      },
      {
        recommendation:
          "Tedarikçi faturalarını dönem kapanmadan belgeleyerek indirilecek KDV etkisini netleştirin.",
        source: "Tenant belgeleri",
        article: "Mock özel belge",
        confidence: 3.8,
        scope: "private",
        action: "review",
      },
    ],
    kosgeb_suggestions: [
      {
        title: "KOSGEB Girişimcilik Destek Programı",
        detail: "Perakende ve dijital satış kanalı yatırımları için başvuru koşulları kontrol edilmeli.",
        url: "https://www.kosgeb.gov.tr",
      },
    ],
    agent_trace: [
      {
        agent_name: "nakit_akisi",
        action: "3 aylık nakit akışı projeksiyonu oluşturuluyor",
        input: { invoice_count: 1 },
        output: { summary: "3 aylık tahmin üretildi" },
        duration_ms: 42,
        confidence: 4.1,
      },
      {
        agent_name: "risk",
        action: "Finansal anomaliler ve eşik değerleri kontrol ediliyor",
        input: { net_flow: summary.net_flow_this_month },
        output: { summary: "Risk Seviyesi: YELLOW" },
        duration_ms: 31,
        confidence: 4,
      },
      {
        agent_name: "mevzuat_rag",
        action: "Global ve tenant RAG kaynakları taranıyor",
        input: { query: "KDV SGK ödeme takvimi" },
        output: { summary: "2 mevzuat önerisi bulundu" },
        duration_ms: 86,
        confidence: 4.2,
      },
      {
        agent_name: "kosgeb",
        action: "Sektörel destek programları eşleştiriliyor",
        input: { sector: tenant(slug).sector },
        output: { summary: "1 destek programı eşleşti" },
        duration_ms: 19,
        confidence: 3.9,
      },
    ],
    created_at: MOCK_NOW.toISOString(),
    completed_at: MOCK_NOW.toISOString(),
    error: null,
  };
}

function pageAIView(slug: string, page: AIPageKind): TenantPageAIView {
  const dashboard = dashboardSummary(slug);
  const taxes = taxCalendar(slug);
  const integrationsRows = integrations(slug);
  const posRows = posTransactions(slug);
  const bankRows = bankTransactions(slug);

  const basePrompts = {
    dashboard: [
      "Bugün en kritik finansal riskim ne?",
      "Bu hafta hangi ödemeleri öne almalıyım?",
      "Tahsilat ve POS tarafında nerede sorun görüyor musun?",
    ],
    integrations: [
      "Bugün hangi entegrasyon daha fazla risk taşıyor?",
      "Banka ve POS veri akışında kopukluk görüyor musun?",
      "Hangi bağlantıyı önce stabilize etmeliyim?",
    ],
    "tax-calendar": [
      "Bu hafta hangi vergi ödemesini önce kapatmalıyım?",
      "Gecikmiş kalemlerin nakit akışına etkisi ne olur?",
      "KDV ve SGK'yı aynı haftada nasıl planlamalıyım?",
    ],
    pos: [
      "POS işlemlerinde kayıp tahsilat sinyali var mı?",
      "İade ve bekleyen işlemler ne anlatıyor?",
      "Bugünkü POS performansına göre hangi aksiyonu almalıyım?",
    ],
  } satisfies Record<AIPageKind, string[]>;

  if (page === "integrations") {
    const failing = integrationsRows.filter((item) => item.last_error);
    const lastImport = bankRows[0];
    const insights: AIInsightCard[] = [
      {
        id: "integration-health",
        title: "Bağlantı Sağlığı",
        detail:
          failing.length > 0
            ? `${failing.map((item) => item.provider).join(", ")} bağlantısında müdahale gerektiren durum var.`
            : `${integrationsRows.filter((item) => item.is_active).length} aktif servis düzenli veri akışı sağlıyor.`,
        tone: failing.length > 0 ? "warning" : "success",
      },
      {
        id: "bank-sync",
        title: "Son Veri Akışı",
        detail: lastImport
          ? `${lastImport.description ?? "Banka hareketi"} son import zincirinde içeri alınmış görünüyor.`
          : "Henüz banka import verisi görünmüyor.",
        tone: lastImport ? "neutral" : "warning",
      },
    ];
    const quickActions: AIQuickAction[] = [
      {
        id: "integration-priority",
        label: "Kontrol sırası",
        prompt: "Bu entegrasyonları bugün hangi sırayla kontrol etmeliyim?",
      },
      {
        id: "integration-risk",
        label: "Riski özetle",
        prompt: "Entegrasyonlarda bugün en kritik operasyonel risk nedir?",
      },
    ];
    return {
      page,
      title: "AI Entegrasyon Özeti",
      subtitle: "Bağlantı sağlığı ve veri akışı sinyalleri",
      summary:
        failing.length > 0
          ? "Bir veya daha fazla bağlantıda takip gerektiren sinyal var."
          : "Bağlantılar çalışıyor; veri tazeliği ve hata sinyalleri normal aralıkta.",
      insights,
      quick_actions: quickActions,
      sample_prompts: basePrompts[page],
    };
  }

  if (page === "tax-calendar") {
    const open = taxes.filter((item) => item.status !== "paid");
    const overdue = open.filter((item) => item.status === "overdue");
    const next = [...open].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
    return {
      page,
      title: "AI Vergi Öncelikleri",
      subtitle: "Ödeme sırası ve ceza baskısı",
      summary: next
        ? `${next.title} yakın vade baskısı nedeniyle ilk sıraya alınmalı.`
        : "Açık vergi yükümlülüğü görünmüyor.",
      insights: [
        {
          id: "tax-next",
          title: "Sıradaki Kritik Kalem",
          detail: next
            ? `${next.title} için ${next.due_date} vadeli ${next.amount} ${next.currency} ödeme bekleniyor.`
            : "Açık kalem yok.",
          tone: next?.status === "overdue" ? "danger" : "warning",
        },
        {
          id: "tax-overdue",
          title: "Gecikme Riski",
          detail:
            overdue.length > 0
              ? `${overdue.length} kalem gecikmiş; nakit uygun olsa da önce ceza riski azaltılmalı.`
              : "Gecikmiş vergi kalemi görünmüyor.",
          tone: overdue.length > 0 ? "danger" : "success",
        },
      ],
      quick_actions: [
        {
          id: "tax-order",
          label: "Ödeme sırası",
          prompt: "Vergi kalemlerini nakit etkisine göre hangi sırayla ödemeliyim?",
        },
        {
          id: "tax-penalty",
          label: "Ceza riski",
          prompt: "Vergi takviminde bugün en çok ceza riski taşıyan kalem hangisi?",
        },
      ],
      sample_prompts: basePrompts[page],
    };
  }

  if (page === "pos") {
    const pending = posRows.filter((item) => item.status === "pending").length;
    const refunds = posRows.filter((item) => item.txn_type === "refund").length;
    const summary = posSummary(slug);
    return {
      page,
      title: "AI POS Analizi",
      subtitle: "Tahsilat kalitesi ve işlem performansı",
      summary:
        Number(summary.net_amount) > 0
          ? "POS akışı pozitif; yine de bekleyen ve iade paternleri izlenmeli."
          : "POS performansı beklenen seviyenin altında; kanal kalitesi gözden geçirilmeli.",
      insights: [
        {
          id: "pos-net",
          title: "Net Tahsilat",
          detail: `Bugünkü net POS akışı ${summary.net_amount} TRY seviyesinde.`,
          tone: Number(summary.net_amount) > 0 ? "success" : "warning",
        },
        {
          id: "pos-quality",
          title: "İşlem Kalitesi",
          detail:
            pending > 0 || refunds > 0
              ? `${pending} bekleyen ve ${refunds} iade işlemi dönüşüm kaybı sinyali veriyor.`
              : "İşlem akışında belirgin kalite sorunu görünmüyor.",
          tone: pending > 0 ? "warning" : "neutral",
        },
      ],
      quick_actions: [
        {
          id: "pos-risk",
          label: "Riski özetle",
          prompt: "POS tarafında bugün en kritik tahsilat riski nedir?",
        },
        {
          id: "pos-conversion",
          label: "Dönüşümü incele",
          prompt: "Bekleyen veya iade işlemlerine göre hangi aksiyonu almalıyım?",
        },
      ],
      sample_prompts: basePrompts[page],
    };
  }

  return {
    page,
    title: "AI Dashboard Özeti",
    subtitle: "Risk, aksiyon ve operasyon sinyalleri",
    summary:
      dashboard.recommended_actions?.[0]?.detail ??
      "Dashboard sinyalleri yeni aksiyon ürettikçe bu alan güncellenir.",
    insights: (dashboard.recommended_actions ?? []).slice(0, 2).map((action, index) => ({
      id: `dashboard-${index}`,
      title: action.title,
      detail: action.detail,
      tone: action.priority === "high" ? "danger" : action.priority === "medium" ? "warning" : "success",
      badge: action.due_hint,
    })),
    quick_actions: [
      {
        id: "dashboard-priority",
        label: "Önceliği sor",
        prompt: "Bugün en kritik finansal önceliği tek cümlede özetler misin?",
      },
    ],
    sample_prompts: basePrompts[page],
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
  getTenantPageAIView: async (slug: string, page: AIPageKind): Promise<TenantPageAIView> =>
    pageAIView(slug, page),
  uploadInvoice: async (slug: string, _file?: File): Promise<InvoiceUploadOut> => ({
    document_id: `${tenantId(slug)}_invoice_doc`,
    invoice: mockInvoice(slug),
  }),
  startAnalysis: async (slug: string, _payload: AnalyzeRequestV2): Promise<JobStartedOut> => ({
    job_id: `mock-job-${slug}`,
    status: "pending",
  }),
  getAnalysis: async (slug: string, jobId: string): Promise<AnalysisResult> =>
    mockAnalysis(slug, jobId),
  downloadAnalysisReport: async (slug: string, jobId: string): Promise<Blob> =>
    new Blob([`Mock PDF report for ${slug}/${jobId}`], { type: "application/pdf" }),
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

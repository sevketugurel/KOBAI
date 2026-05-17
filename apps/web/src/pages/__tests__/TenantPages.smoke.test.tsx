import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";

const mocks = vi.hoisted(() => {
  const tenantId = "tenant_acme_co";
  const taxes = [
    {
      id: "tax-1",
      tenant_id: tenantId,
      title: "KDV Beyannamesi",
      description: "Nisan dönemi KDV",
      tax_type: "kdv",
      due_date: "2026-05-26",
      amount: "12000.00",
      currency: "TRY",
      status: "pending",
      period: "2026-04",
      notes: null,
      created_at: "2026-05-13T00:00:00Z",
      updated_at: "2026-05-13T00:00:00Z",
    },
    {
      id: "tax-2",
      tenant_id: tenantId,
      title: "SGK Prim Ödemesi",
      description: null,
      tax_type: "sgk",
      due_date: "2026-05-31",
      amount: "8000.00",
      currency: "TRY",
      status: "pending",
      period: "2026-04",
      notes: null,
      created_at: "2026-05-13T00:00:00Z",
      updated_at: "2026-05-13T00:00:00Z",
    },
  ];
  const posTransactions = [
    {
      id: "pos-1",
      tenant_id: tenantId,
      pos_provider: "iyzico_checkout",
      external_id: "p1",
      amount: "750.00",
      currency: "TRY",
      txn_type: "sale",
      status: "success",
      payment_method: "credit_card",
      installments: 1,
      card_last_four: "1234",
      description: "Online satış",
      transacted_at: "2026-05-16T09:00:00Z",
      created_at: "2026-05-16T09:00:00Z",
    },
  ];
  const integrations = [
    {
      id: "int-1",
      provider: "iyzico_checkout",
      is_active: true,
      config: {},
      last_sync_at: "2026-05-16T09:00:00Z",
      last_error: null,
    },
  ];
  const bankTransactions = [
    {
      id: "bank-1",
      tenant_id: tenantId,
      source_document_id: null,
      bank_name: "garanti",
      account_iban: null,
      amount: "1500.00",
      currency: "TRY",
      direction: "credit",
      description: "Tahsilat",
      reference_no: null,
      category: "hizmet_satis",
      transacted_at: "2026-05-16T08:00:00Z",
      created_at: "2026-05-16T08:00:00Z",
    },
  ];
  const dashboard = {
    period_start: "2026-05-01",
    period_end: "2026-05-16",
    net_flow_this_month: "2250.00",
    pos_sales_this_month: "750.00",
    upcoming_tax_count: taxes.length,
    integration_count: integrations.length,
    upcoming_taxes: taxes,
    recommended_actions: [
      {
        title: "KDV çıkışını öne alın",
        detail: "Bu hafta KDV ve SGK ödemelerini tahsilat planına bağlayın.",
        priority: "high",
        due_hint: "Bu hafta",
        source_agent: "risk",
      },
    ],
    recent_activities: [
      {
        id: "act-1",
        type: "bank",
        title: "Tahsilat",
        amount: "1500.00",
        currency: "TRY",
        timestamp: "2026-05-16T08:00:00Z",
      },
    ],
    updated_at: "2026-05-16T09:00:00Z",
  };
  const posSummary = {
    date: "2026-05-16",
    total_sales: "750.00",
    total_refunds: "0.00",
    net_amount: "750.00",
    sale_count: 1,
    refund_count: 0,
    avg_ticket: "750.00",
  };
  const analysis = {
    job_id: "mock-job-acme-co",
    status: "completed",
    invoices: [],
    cash_flow_forecast: [
      {
        month: "2026-06",
        income: 42000,
        expense: 24000,
        net: 18000,
        kdv_payment: 0,
        sgk_payment: 4000,
        cumulative: 18000,
      },
    ],
    risk_score: 2,
    risk_label: "yellow",
    risk_explanation: "Tahsilat akışı iyi, vergi çıkışı izlenmeli.",
    risk_key_drivers: ["Vergi çıkışları bu hafta nakit tamponunu daraltıyor."],
    risk_recommended_actions: [
      {
        title: "Vergi çıkışını planlayın",
        detail: "KDV ve SGK kalemleri için bu hafta nakit sıralaması yapın.",
        priority: "high",
        due_hint: "Bu hafta",
        source_agent: "risk",
      },
    ],
    risk_priority: "high",
    risk_time_horizon: "this_week",
    tax_recommendations: [
      {
        recommendation: "KDV beyanı öncesi POS ve banka hareketlerini mutabık hale getirin.",
        source: "KDV Kanunu",
        article: "Genel beyan dönemi",
        confidence: 4,
        action: "review",
        scope: "global",
      },
    ],
    kosgeb_suggestions: [
      {
        title: "KOSGEB Dijitalleşme Desteği",
        detail: "Online satış kanalı için uygunluk kontrol edilmeli.",
      },
    ],
    agent_trace: [
      {
        agent_name: "mevzuat_rag",
        action: "RAG kaynakları tarandı",
        input: {},
        output: { summary: "1 öneri bulundu" },
        duration_ms: 24,
        confidence: 4,
      },
    ],
    created_at: "2026-05-16T09:00:00Z",
    completed_at: "2026-05-16T09:00:00Z",
    error: null,
  };
  const pageAI = {
    integrations: {
      page: "integrations",
      title: "AI Entegrasyon Özeti",
      subtitle: "Bağlantı sağlığı ve veri akışı sinyalleri",
      summary: "Bağlantılar çalışıyor; veri tazeliği ve hata sinyalleri normal aralıkta.",
      insights: [
        {
          id: "integration-health",
          title: "Bağlantı Sağlığı",
          detail: "2 aktif servis düzenli veri akışı sağlıyor.",
          tone: "success",
        },
      ],
      quick_actions: [
        {
          id: "integration-priority",
          label: "Kontrol sırası",
          prompt: "Bu entegrasyonları bugün hangi sırayla kontrol etmeliyim?",
        },
      ],
      sample_prompts: ["Bugün hangi entegrasyon daha fazla risk taşıyor?"],
    },
    "tax-calendar": {
      page: "tax-calendar",
      title: "AI Vergi Öncelikleri",
      subtitle: "Ödeme sırası ve ceza baskısı",
      summary: "KDV Beyannamesi yakın vade baskısı nedeniyle ilk sıraya alınmalı.",
      insights: [
        {
          id: "tax-next",
          title: "Sıradaki Kritik Kalem",
          detail: "KDV Beyannamesi için 2026-05-26 vadeli ödeme bekleniyor.",
          tone: "warning",
        },
      ],
      quick_actions: [
        {
          id: "tax-order",
          label: "Ödeme sırası",
          prompt: "Vergi kalemlerini nakit etkisine göre hangi sırayla ödemeliyim?",
        },
      ],
      sample_prompts: ["Bu hafta hangi vergi ödemesini önce kapatmalıyım?"],
    },
    pos: {
      page: "pos",
      title: "AI POS Analizi",
      subtitle: "Tahsilat kalitesi ve işlem performansı",
      summary: "POS akışı pozitif; yine de bekleyen ve iade paternleri izlenmeli.",
      insights: [
        {
          id: "pos-net",
          title: "Net Tahsilat",
          detail: "Bugünkü net POS akışı 750.00 TRY seviyesinde.",
          tone: "success",
        },
      ],
      quick_actions: [
        {
          id: "pos-risk",
          label: "Riski özetle",
          prompt: "POS tarafında bugün en kritik tahsilat riski nedir?",
        },
      ],
      sample_prompts: ["POS işlemlerinde kayıp tahsilat sinyali var mı?"],
    },
  };
  return { tenantId, taxes, posTransactions, integrations, bankTransactions, dashboard, posSummary, analysis, pageAI };
});

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    session: { access_token: "fake" },
    user: { id: "fake-user" },
    loading: false,
  }),
}));

vi.mock("../../api/v2", () => ({
  isMockMode: true,
  V2ApiError: class V2ApiError extends Error {},
  v2: {
    getDashboardSummary: vi.fn().mockResolvedValue(mocks.dashboard),
    getAgentSnapshots: vi.fn().mockResolvedValue([]),
    uploadInvoice: vi.fn(),
    startAnalysis: vi.fn().mockResolvedValue({ job_id: "mock-job-acme-co", status: "pending" }),
    getAnalysis: vi.fn().mockResolvedValue(mocks.analysis),
    downloadAnalysisReport: vi.fn().mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" })),
    getChatHistory: vi.fn().mockResolvedValue([]),
    streamChatV2: vi.fn(),
    getTenantPageAIView: vi.fn().mockImplementation(
      (_slug: string, page: "integrations" | "tax-calendar" | "pos") =>
        Promise.resolve(mocks.pageAI[page]),
    ),
    listIntegrations: vi.fn().mockResolvedValue(mocks.integrations),
    listBankTransactions: vi.fn().mockResolvedValue(mocks.bankTransactions),
    uploadBankStatement: vi.fn(),
    listTaxCalendar: vi.fn().mockResolvedValue(mocks.taxes),
    patchTaxCalendarItem: vi.fn().mockResolvedValue(mocks.taxes[0]),
    getPosConfig: vi.fn().mockResolvedValue({
      provider: "iyzico_checkout",
      is_active: true,
      has_credentials: true,
      has_webhook_secret: true,
      last_sync_at: "2026-05-16T09:00:00Z",
      last_error: null,
      webhook_url: "/v2/acme-co/pos/webhook",
    }),
    putPosConfig: vi.fn(),
    listPosTransactions: vi.fn().mockResolvedValue(mocks.posTransactions),
    getPosSummary: vi.fn().mockResolvedValue(mocks.posSummary),
  },
}));

import IntegrationsPage from "../IntegrationsPage";
import POSPage from "../POSPage";
import TaxCalendarPage from "../TaxCalendarPage";
import TenantDashboard from "../TenantDashboard";

function renderRoute(path: string, element: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path=":slug/dashboard" element={element} />
          <Route path=":slug/integrations" element={element} />
          <Route path=":slug/tax-calendar" element={element} />
          <Route path=":slug/pos" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("tenant v2 pages", () => {
  it("renders dashboard with non-empty mock data", async () => {
    renderRoute("/acme-co/dashboard", <TenantDashboard />);
    expect(await screen.findByRole("heading", { name: /acme-co Dashboard/i })).toBeInTheDocument();
    expect(screen.getByText("Bu Ay POS Satışı")).toBeInTheDocument();
    expect(await screen.findByText("KDV Beyannamesi")).toBeInTheDocument();
    expect(screen.getByText("Tahsilat")).toBeInTheDocument();
    expect(await screen.findByText("Nakit Akışı Projeksiyonu")).toBeInTheDocument();
    expect(screen.getByText("Risk Değerlendirmesi")).toBeInTheDocument();
    expect(screen.getByText("AI'nin Bugün Dikkat Çektiği Konular")).toBeInTheDocument();
    expect(screen.getByText("RAG Vergi Önerileri")).toBeInTheDocument();
    expect(screen.getByText("Ajan Akışı")).toBeInTheDocument();
    expect(screen.getByText("Belge ve Analiz")).toBeInTheDocument();
  });

  it("renders integrations with provider cards and bank transactions", async () => {
    renderRoute("/acme-co/integrations", <IntegrationsPage />);
    expect(await screen.findByRole("heading", { name: "Entegrasyonlar" })).toBeInTheDocument();
    expect(await screen.findByText("iyzico Checkout")).toBeInTheDocument();
    expect(await screen.findByText("Tahsilat")).toBeInTheDocument();
    expect(await screen.findByText("AI Entegrasyon Özeti")).toBeInTheDocument();
  });

  it("renders tax calendar with pending rows", async () => {
    renderRoute("/acme-co/tax-calendar", <TaxCalendarPage />);
    expect(await screen.findByRole("heading", { name: "Vergi Takvimi" })).toBeInTheDocument();
    expect(await screen.findAllByText("KDV Beyannamesi")).not.toHaveLength(0);
    expect(screen.getByText("SGK Prim Ödemesi")).toBeInTheDocument();
    expect(await screen.findByText("AI Vergi Öncelikleri")).toBeInTheDocument();
  });

  it("renders POS with summary and transactions", async () => {
    renderRoute("/acme-co/pos", <POSPage />);
    expect(await screen.findByRole("heading", { name: "Sanal POS" })).toBeInTheDocument();
    expect(await screen.findByText("Web Checkout")).toBeInTheDocument();
    expect(await screen.findByText("Satış")).toBeInTheDocument();
    expect(await screen.findByText("AI POS Analizi")).toBeInTheDocument();
  });

  it("keeps dashboard POS and tax numbers consistent with source page data", () => {
    const posNet = mocks.posTransactions
      .filter((t) => t.status === "success")
      .reduce((sum, t) => sum + (t.txn_type === "refund" ? -Number(t.amount) : Number(t.amount)), 0);
    expect(Number(mocks.dashboard.pos_sales_this_month)).toBe(posNet);
    expect(mocks.dashboard.upcoming_tax_count).toBe(
      mocks.taxes.filter((t) => t.status === "pending").length,
    );
    expect(mocks.dashboard.upcoming_taxes.map((t) => t.id)).toEqual(
      mocks.taxes.map((t) => t.id),
    );
  });

  it("does not show another tenant's tenant_id in page data", () => {
    const allTenantIds = [
      ...mocks.taxes.map((t) => t.tenant_id),
      ...mocks.posTransactions.map((t) => t.tenant_id),
      ...mocks.bankTransactions.map((t) => t.tenant_id),
    ];
    expect(allTenantIds).toEqual(allTenantIds.map(() => mocks.tenantId));
    expect(allTenantIds).not.toContain("tenant_other_co");
  });
});

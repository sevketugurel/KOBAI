import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    session: { access_token: "fake" },
    user: null,
    loading: false,
  }),
}));

vi.mock("../../api/v2", () => ({
  v2: {
    getDashboardSummary: vi.fn().mockResolvedValue({
      period_start: "2026-05-01",
      period_end: "2026-05-13",
      net_flow_this_month: "1500",
      pos_sales_this_month: "750",
      upcoming_tax_count: 2,
      integration_count: 1,
      upcoming_taxes: [
        {
          id: "t1",
          tenant_id: "x",
          title: "KDV Beyannamesi",
          description: null,
          tax_type: "kdv",
          due_date: "2026-05-26",
          amount: null,
          currency: "TRY",
          status: "pending",
          period: "2026-04",
          notes: null,
          created_at: "2026-05-13T00:00:00Z",
          updated_at: "2026-05-13T00:00:00Z",
        },
      ],
      recent_activities: [],
      updated_at: "2026-05-13T12:00:00Z",
    }),
  },
}));

import TenantDashboard from "../TenantDashboard";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/acme-co/dashboard"]}>
        <Routes>
          <Route path=":slug/dashboard" element={<TenantDashboard />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TenantDashboard (smoke)", () => {
  it("renders title with slug and KPI labels", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /acme-co Dashboard/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bu Ay Net Akış")).toBeInTheDocument();
    expect(screen.getByText("Bu Ay POS Satışı")).toBeInTheDocument();
    expect(screen.getByText("Yaklaşan Vergi")).toBeInTheDocument();
    expect(screen.getByText("Aktif Entegrasyon")).toBeInTheDocument();
  });

  it("renders an upcoming tax row from mocked summary", async () => {
    renderPage();
    expect(await screen.findByText("KDV Beyannamesi")).toBeInTheDocument();
  });
});

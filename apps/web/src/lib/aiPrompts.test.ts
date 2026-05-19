import { describe, expect, it } from "vitest";

import {
  buildIntegrationAIPrompt,
  buildPosTransactionAIPrompt,
  buildTaxItemAIPrompt,
} from "./aiPrompts";

describe("ai prompt builders", () => {
  it("builds integration prompt with important fields", () => {
    const prompt = buildIntegrationAIPrompt({
      id: "int-1",
      provider: "iyzico_checkout",
      is_active: true,
      config: {},
      last_sync_at: "2026-05-16T09:00:00Z",
      last_error: "401 unauthorized",
    });

    expect(prompt).toContain("iyzico_checkout");
    expect(prompt).toContain("2026-05-16T09:00:00Z");
    expect(prompt).toContain("401 unauthorized");
    expect(prompt).toContain("aktif");
  });

  it("builds tax prompt with fallback text for missing fields", () => {
    const prompt = buildTaxItemAIPrompt({
      id: "tax-1",
      tenant_id: "tenant-1",
      title: "KDV",
      description: null,
      tax_type: "kdv",
      due_date: "2026-05-26",
      amount: null,
      currency: "TRY",
      status: "pending",
      period: null,
      notes: null,
      created_at: "2026-05-16T09:00:00Z",
      updated_at: "2026-05-16T09:00:00Z",
    });

    expect(prompt).toContain("tutar bilinmiyor");
    expect(prompt).toContain("dönem bilgisi yok");
    expect(prompt).toContain("ek not yok");
  });

  it("builds POS transaction prompt with transaction context", () => {
    const prompt = buildPosTransactionAIPrompt({
      id: "pos-1",
      tenant_id: "tenant-1",
      pos_provider: "iyzico_checkout",
      external_id: "ext-1",
      amount: "1250.00",
      currency: "TRY",
      txn_type: "refund",
      status: "pending",
      payment_method: "credit_card",
      installments: 3,
      card_last_four: null,
      description: null,
      transacted_at: "2026-05-16T09:00:00Z",
      created_at: "2026-05-16T09:00:00Z",
    });

    expect(prompt).toContain("refund");
    expect(prompt).toContain("pending");
    expect(prompt).toContain("1250.00 TRY");
    expect(prompt).toContain("3");
    expect(prompt).toContain("iyzico_checkout");
    expect(prompt).toContain("bilinmiyor");
  });
});

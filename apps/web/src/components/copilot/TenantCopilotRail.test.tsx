import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TenantCopilotRail from "./TenantCopilotRail";
import { TenantAIActionProvider } from "./TenantAIActionContext";

vi.mock("../chat/ChatPanelV2", () => ({
  default: () => <div>Mock Chat Panel</div>,
}));

describe("TenantCopilotRail", () => {
  it("renders entry actions and insight actions", () => {
    render(
      <TenantAIActionProvider>
        <TenantCopilotRail
          slug="acme"
          sessionId="s-1"
          view={{
            page: "integrations",
            title: "AI Entegrasyon Özeti",
            subtitle: "Bağlantı sağlığı",
            summary: "Özet",
            entry_actions: [
              {
                id: "entry-1",
                label: "Bağlantı Sağlığını Analiz Et",
                prompt: "Analiz et",
                variant: "analyze",
              },
            ],
            insights: [
              {
                id: "insight-1",
                title: "Bağlantı Sağlığı",
                detail: "Bir hata var",
                actions: [
                  {
                    id: "insight-action-1",
                    label: "Sorunu Yorumla",
                    prompt: "Yorumla",
                    variant: "explain",
                  },
                ],
              },
            ],
            quick_actions: [],
            sample_prompts: [],
          }}
        />
      </TenantAIActionProvider>,
    );

    expect(screen.getByRole("button", { name: /bağlantı sağlığını analiz et/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sorunu yorumla/i })).toBeInTheDocument();
  });
});

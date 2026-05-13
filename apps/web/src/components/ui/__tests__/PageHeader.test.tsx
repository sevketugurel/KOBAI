import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../PageHeader";

describe("PageHeader", () => {
  it("renders title, subtitle, and actions", () => {
    render(
      <PageHeader
        title="Dashboard"
        subtitle="Son güncelleme"
        actions={<button>Yenile</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Son güncelleme")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yenile" })).toBeInTheDocument();
  });
});

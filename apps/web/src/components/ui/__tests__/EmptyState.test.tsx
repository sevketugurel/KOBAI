import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders title, message, and action", () => {
    render(
      <EmptyState
        title="Veri yok"
        message="Henüz hareket eklemediniz"
        action={<button>Ekle</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Veri yok" })).toBeInTheDocument();
    expect(screen.getByText("Henüz hareket eklemediniz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ekle" })).toBeInTheDocument();
  });

  it("renders without message or action", () => {
    render(<EmptyState title="Boş" />);
    expect(screen.getByRole("heading", { name: "Boş" })).toBeInTheDocument();
  });
});

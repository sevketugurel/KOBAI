import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import KPICards from "./KPICards";

describe("KPICards", () => {
  it("renders four cards in tr-TR locale", () => {
    render(<KPICards income={150000} expense={90000} net={60000} taxBurden={18000} />);
    expect(screen.getByText(/Toplam Gelir/i)).toBeInTheDocument();
    expect(screen.getByText(/150\.000/)).toBeInTheDocument();
  });
});

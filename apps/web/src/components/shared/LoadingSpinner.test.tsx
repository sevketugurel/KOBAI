import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LoadingSpinner from "./LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders accessible label", () => {
    render(<LoadingSpinner label="Yükleniyor" />);
    expect(screen.getByRole("status")).toHaveTextContent("Yükleniyor");
  });
});

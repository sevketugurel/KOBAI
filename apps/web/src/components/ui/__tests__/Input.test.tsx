import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "../Input";

describe("Input", () => {
  it("renders label and associates it with input", () => {
    render(<Input label="E-posta" />);
    const input = screen.getByLabelText("E-posta");
    expect(input).toBeInTheDocument();
  });

  it("shows error message and red border class when error provided", () => {
    render(<Input label="E-posta" error="Geçersiz" />);
    expect(screen.getByText("Geçersiz")).toBeInTheDocument();
    expect(screen.getByLabelText("E-posta").className).toMatch(/border-red-500/);
  });

  it("shows hint when no error", () => {
    render(<Input label="Şifre" hint="En az 8 karakter" />);
    expect(screen.getByText("En az 8 karakter")).toBeInTheDocument();
  });

  it("error takes precedence over hint", () => {
    render(<Input label="X" hint="hint" error="err" />);
    expect(screen.getByText("err")).toBeInTheDocument();
    expect(screen.queryByText("hint")).not.toBeInTheDocument();
  });
});

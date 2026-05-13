import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Kaydet</Button>);
    expect(screen.getByRole("button", { name: /kaydet/i })).toBeInTheDocument();
  });

  it("applies primary variant classes by default", () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole("button").className).toMatch(/bg-navy-600/);
  });

  it("applies danger variant classes", () => {
    render(<Button variant="danger">Sil</Button>);
    expect(screen.getByRole("button").className).toMatch(/bg-red-600/);
  });

  it("is disabled when loading", () => {
    render(<Button loading>Yükleniyor</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("fires onClick", () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(fn).toHaveBeenCalledOnce();
  });

  it("does not fire onClick when loading", () => {
    const fn = vi.fn();
    render(
      <Button onClick={fn} loading>
        Click
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(fn).not.toHaveBeenCalled();
  });
});

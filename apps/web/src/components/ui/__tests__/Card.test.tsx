import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "../Card";

describe("Card", () => {
  it("renders title and body", () => {
    render(
      <Card>
        <Card.Header title="Başlık" />
        <Card.Body>İçerik</Card.Body>
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "Başlık" })).toBeInTheDocument();
    expect(screen.getByText("İçerik")).toBeInTheDocument();
  });

  it("renders subtitle and action", () => {
    render(
      <Card>
        <Card.Header title="T" subtitle="alt" action={<button>X</button>} />
        <Card.Body>body</Card.Body>
      </Card>,
    );
    expect(screen.getByText("alt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "X" })).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Select } from "../Select";

describe("Select", () => {
  it("renders options and label", () => {
    render(
      <Select label="Banka">
        <option value="a">Akbank</option>
        <option value="b">İş Bankası</option>
      </Select>,
    );
    expect(screen.getByLabelText("Banka")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Akbank" })).toBeInTheDocument();
  });

  it("fires onChange", () => {
    const fn = vi.fn();
    render(
      <Select label="X" onChange={fn} defaultValue="a">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    fireEvent.change(screen.getByLabelText("X"), { target: { value: "b" } });
    expect(fn).toHaveBeenCalled();
  });
});

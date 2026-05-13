import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable, type Column } from "../DataTable";

interface Row {
  id: string;
  name: string;
  amount: number;
}

const columns: Column<Row>[] = [
  { key: "name", header: "Ad" },
  {
    key: "amount",
    header: "Tutar",
    align: "right",
    render: (r) => <span data-testid={`amt-${r.id}`}>{r.amount}</span>,
  },
];

describe("DataTable", () => {
  it("renders rows with custom render", () => {
    render(
      <DataTable<Row>
        columns={columns}
        rows={[
          { id: "1", name: "Akbank", amount: 100 },
          { id: "2", name: "İş", amount: 200 },
        ]}
        keyField="id"
      />,
    );
    expect(screen.getByText("Akbank")).toBeInTheDocument();
    expect(screen.getByTestId("amt-2")).toHaveTextContent("200");
  });

  it("shows skeleton rows when loading", () => {
    const { container } = render(
      <DataTable<Row> columns={columns} rows={[]} keyField="id" loading skeletonRows={3} />,
    );
    expect(container.querySelectorAll(".skeleton").length).toBe(3 * columns.length);
  });

  it("shows empty state when no rows", () => {
    render(
      <DataTable<Row>
        columns={columns}
        rows={[]}
        keyField="id"
        emptyTitle="Hiç kayıt yok"
      />,
    );
    expect(screen.getByRole("heading", { name: "Hiç kayıt yok" })).toBeInTheDocument();
  });

  it("renders headers with align class", () => {
    render(<DataTable<Row> columns={columns} rows={[]} keyField="id" />);
    const tutarHeader = screen.getByRole("columnheader", { name: "Tutar" });
    expect(tutarHeader.className).toMatch(/text-right/);
  });
});

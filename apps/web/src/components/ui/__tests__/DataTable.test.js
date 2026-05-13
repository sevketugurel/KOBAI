import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable } from "../DataTable";
const columns = [
    { key: "name", header: "Ad" },
    {
        key: "amount",
        header: "Tutar",
        align: "right",
        render: (r) => _jsx("span", { "data-testid": `amt-${r.id}`, children: r.amount }),
    },
];
describe("DataTable", () => {
    it("renders rows with custom render", () => {
        render(_jsx(DataTable, { columns: columns, rows: [
                { id: "1", name: "Akbank", amount: 100 },
                { id: "2", name: "İş", amount: 200 },
            ], keyField: "id" }));
        expect(screen.getByText("Akbank")).toBeInTheDocument();
        expect(screen.getByTestId("amt-2")).toHaveTextContent("200");
    });
    it("shows skeleton rows when loading", () => {
        const { container } = render(_jsx(DataTable, { columns: columns, rows: [], keyField: "id", loading: true, skeletonRows: 3 }));
        expect(container.querySelectorAll(".skeleton").length).toBe(3 * columns.length);
    });
    it("shows empty state when no rows", () => {
        render(_jsx(DataTable, { columns: columns, rows: [], keyField: "id", emptyTitle: "Hi\u00E7 kay\u0131t yok" }));
        expect(screen.getByRole("heading", { name: "Hiç kayıt yok" })).toBeInTheDocument();
    });
    it("renders headers with align class", () => {
        render(_jsx(DataTable, { columns: columns, rows: [], keyField: "id" }));
        const tutarHeader = screen.getByRole("columnheader", { name: "Tutar" });
        expect(tutarHeader.className).toMatch(/text-right/);
    });
});

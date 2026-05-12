import { jsx as _jsx } from "react/jsx-runtime";
import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import CashFlowChart from "./CashFlowChart";
describe("CashFlowChart", () => {
    it("renders with provided data", () => {
        render(_jsx(CashFlowChart, { data: [
                { month: "2026-04", income: 100, expense: 50, net: 50, kdv_payment: 0, sgk_payment: 5, cumulative: 50 },
                { month: "2026-05", income: 110, expense: 60, net: 50, kdv_payment: 0, sgk_payment: 5, cumulative: 100 },
                { month: "2026-06", income: 105, expense: 55, net: 50, kdv_payment: 10, sgk_payment: 5, cumulative: 140 },
            ] }));
    });
});

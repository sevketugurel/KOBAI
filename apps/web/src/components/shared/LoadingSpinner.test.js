import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LoadingSpinner from "./LoadingSpinner";
describe("LoadingSpinner", () => {
    it("renders accessible label", () => {
        render(_jsx(LoadingSpinner, { label: "Y\u00FCkleniyor" }));
        expect(screen.getByRole("status")).toHaveTextContent("Yükleniyor");
    });
});

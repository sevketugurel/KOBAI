import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import OnboardingWizard from "./OnboardingWizard";
describe("OnboardingWizard", () => {
    it("completes 3 steps and submits", () => {
        const onComplete = vi.fn();
        render(_jsx(OnboardingWizard, { onComplete: onComplete }));
        fireEvent.click(screen.getByRole("button", { name: /Şahıs Şirketi/ }));
        fireEvent.click(screen.getByRole("button", { name: /İleri/ }));
        fireEvent.click(screen.getByRole("button", { name: /Gıda/ }));
        fireEvent.click(screen.getByRole("button", { name: /İleri/ }));
        fireEvent.click(screen.getByRole("button", { name: /Son 6 ay/ }));
        fireEvent.click(screen.getByRole("button", { name: /Analizi Başlat/ }));
        expect(onComplete).toHaveBeenCalledWith({
            company_type: "Şahıs Şirketi",
            sector: "Gıda & İçecek",
            period: "6m",
        });
    });
});

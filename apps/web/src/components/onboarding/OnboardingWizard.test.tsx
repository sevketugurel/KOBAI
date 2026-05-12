import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import OnboardingWizard from "./OnboardingWizard";

describe("OnboardingWizard", () => {
  it("completes 3 steps and submits", () => {
    const onComplete = vi.fn();
    render(<OnboardingWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByLabelText(/Şahıs Şirketi/));
    fireEvent.click(screen.getByText(/İleri/));
    fireEvent.click(screen.getByLabelText(/Gıda/));
    fireEvent.click(screen.getByText(/İleri/));
    fireEvent.click(screen.getByLabelText(/Son 6 ay/));
    fireEvent.click(screen.getByText(/Analizi Başlat/));
    expect(onComplete).toHaveBeenCalledWith({
      company_type: "Şahıs Şirketi", sector: "Gıda & İçecek", period: "6m",
    });
  });
});

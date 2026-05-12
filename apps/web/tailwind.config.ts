import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 50: "#EEF2F9", 100: "#D5DFF0", 200: "#AAC0E1", 300: "#7FA0D2", 400: "#5481C3", 500: "#2A5298", 600: "#1F3D72", 700: "#17305A", 800: "#0F2240", 900: "#081429", 950: "#040A14" },
        emerald: { 400: "#34D399", 500: "#10C896", 600: "#00B584", 700: "#008C66" },
        amber: { 400: "#FBBF24", 500: "#F59E0B", 600: "#D97706" },
        surface: "#FFFFFF",
        background: "#F4F6FB",
        border: "#E2E7F0",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "Inter", "ui-sans-serif", "sans-serif"],
      },
      fontSize: { "2xs": ["0.625rem", { lineHeight: "0.875rem" }] },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(15,34,64,0.05)",
        "card-hover": "0 4px 8px rgba(0,0,0,0.08), 0 12px 32px rgba(15,34,64,0.10)",
        glow: "0 0 0 3px rgba(42,82,152,0.15)",
      },
      borderRadius: { DEFAULT: "8px", lg: "12px", xl: "16px", "2xl": "20px", "3xl": "24px" },
      animation: {
        shimmer: "shimmer 1.5s infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.25s ease-out",
        "pulse-dot": "pulseDot 1.5s ease-in-out infinite",
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        pulseDot: { "0%,100%": { transform: "scale(1)", opacity: "1" }, "50%": { transform: "scale(1.2)", opacity: "0.7" } },
      },
      backgroundImage: {
        "hero-grid": "radial-gradient(circle at 20% 50%, rgba(42,82,152,0.06) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(0,181,132,0.06) 0%, transparent 50%)",
      },
    },
  },
  plugins: [],
} satisfies Config;

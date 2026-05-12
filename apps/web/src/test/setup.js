import "@testing-library/jest-dom/vitest";
// Recharts uses ResizeObserver, which jsdom does not provide.
class ResizeObserverPolyfill {
    observe() { }
    unobserve() { }
    disconnect() { }
}
if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver =
        ResizeObserverPolyfill;
}

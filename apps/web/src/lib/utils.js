export function cn(...classes) {
    return classes.filter(Boolean).join(" ");
}
export function formatTRY(n) {
    return "₺ " + n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}
export function formatPercent(n) {
    return "%" + n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

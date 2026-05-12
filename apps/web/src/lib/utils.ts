export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatTRY(n: number): string {
  return "₺ " + n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export function formatPercent(n: number): string {
  return "%" + n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

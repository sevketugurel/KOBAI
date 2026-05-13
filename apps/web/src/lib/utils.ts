export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatTRY(n: number): string {
  return "₺ " + n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export function formatPercent(n: number): string {
  return "%" + n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

const DATE_FMT = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATE_TIME_FMT = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const REL_FMT = new Intl.RelativeTimeFormat("tr-TR", { numeric: "always" });

function toDate(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input);
}

export function formatDate(input: string | Date): string {
  return DATE_FMT.format(toDate(input));
}

export function formatDateTime(input: string | Date): string {
  return DATE_TIME_FMT.format(toDate(input));
}

const MS_PER_DAY = 86_400_000;

export function formatRelative(input: string | Date, now: Date = new Date()): string {
  const target = toDate(input);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(target) - startOfDay(now)) / MS_PER_DAY);
  if (diffDays === 0) return "bugün";
  return REL_FMT.format(diffDays, "day");
}

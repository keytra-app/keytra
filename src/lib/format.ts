const relativeTime = new Intl.RelativeTimeFormat("de", { numeric: "auto", style: "short" });
const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const MONTH = 30 * DAY;

export function formatRelativeTime(iso: string, nowMs: number): string {
  const thenMs = new Date(iso).getTime();
  if (Number.isNaN(thenMs)) return "";

  const diffSec = Math.round((thenMs - nowMs) / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec < 45) return "gerade eben";
  if (absSec < HOUR) return relativeTime.format(Math.round(diffSec / MINUTE), "minute");
  if (absSec < DAY) return relativeTime.format(Math.round(diffSec / HOUR), "hour");
  if (absSec < MONTH) return relativeTime.format(Math.round(diffSec / DAY), "day");
  return date.format(new Date(thenMs));
}

export function formatDate(iso: string): string {
  return date.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  const value = new Date(iso);
  return Number.isNaN(value.getTime()) ? "" : dateTime.format(value);
}

export function formatPercent(pct: number): string {
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

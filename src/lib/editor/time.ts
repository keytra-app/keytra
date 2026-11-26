const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto", style: "short" });

export function formatRelativeTime(iso: string, nowMs: number): string {
  const thenMs = new Date(iso).getTime();
  if (Number.isNaN(thenMs)) return "";

  const diffSec = Math.round((thenMs - nowMs) / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec < 45) return "gerade eben";
  if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (absSec < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (absSec < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");

  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(thenMs));
}

export function formatAbsoluteTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

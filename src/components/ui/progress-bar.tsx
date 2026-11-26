/** Stacked translated (green) and outdated (amber) share of `total`. */
export function ProgressBar({
  translated,
  outdated,
  total,
  className,
}: {
  translated: number;
  outdated: number;
  total: number;
  className: string;
}) {
  const translatedPct = total > 0 ? Math.min(100, (translated / total) * 100) : 0;
  const outdatedPct = total > 0 ? Math.min(100 - translatedPct, (outdated / total) * 100) : 0;

  return (
    <div className={`overflow-hidden rounded-full ${className}`}>
      {translatedPct > 0 && (
        <div
          className="h-full bg-emerald-500/85 transition-[width] duration-200"
          style={{ width: `${translatedPct}%` }}
        />
      )}
      {outdatedPct > 0 && (
        <div
          className="h-full bg-amber-500/80 transition-[width] duration-200"
          style={{ width: `${outdatedPct}%` }}
        />
      )}
    </div>
  );
}

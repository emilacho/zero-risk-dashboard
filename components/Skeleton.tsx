export function Skeleton({
  lines = 4,
  className = "",
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded bg-muted/40"
          style={{ width: `${60 + ((i * 17) % 38)}%` }}
        />
      ))}
    </div>
  )
}

/**
 * Skeleton · BlurFade-style placeholders for Suspense boundaries.
 *
 * `kind="overview"` mirrors the home page layout (KPI bento + 2-col list grid).
 * `kind="page"` is a generic stack of cards for detail routes.
 * `kind="lines"` is a simple list of shimmering lines (legacy default).
 */
export function Skeleton({
  kind = "lines",
  lines = 5,
  className = "",
}: {
  kind?: "overview" | "page" | "lines"
  lines?: number
  className?: string
}) {
  if (kind === "overview") {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          <div className="skel-card lg:col-span-2 lg:row-span-2 h-44 lg:h-full" />
          <div className="skel-card h-32" />
          <div className="skel-card h-32" />
          <div className="skel-card h-32" />
          <div className="hidden lg:block" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="skel-card h-72">
            <div className="space-y-3">
              <div className="skel-line w-2/5" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skel-line" style={{ width: `${50 + ((i * 17) % 40)}%` }} />
              ))}
            </div>
          </div>
          <div className="skel-card h-72">
            <div className="space-y-3">
              <div className="skel-line w-2/5" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skel-line" style={{ width: `${55 + ((i * 11) % 35)}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (kind === "page") {
    return (
      <div className={`grid gap-4 ${className}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skel-card h-28" />
        ))}
      </div>
    )
  }

  // legacy "lines" mode · kept for any caller still passing the default
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skel-line"
          style={{ width: `${60 + ((i * 17) % 38)}%` }}
        />
      ))}
    </div>
  )
}

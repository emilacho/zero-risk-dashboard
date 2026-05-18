/**
 * Skeleton · BlurFade-style placeholders for Suspense boundaries.
 *
 * Kinds (Sprint #8 P1 expansion · D2 audit gap closed):
 *   - "overview"        · home page layout (KPI bento + 2-col list grid)
 *   - "page"            · generic stack of cards for detail routes
 *   - "lines"           · list of shimmering text lines (legacy default)
 *   - "table-row"       · table row placeholder (use inside <tbody> · honors `lines` prop for row count)
 *   - "card-grid"       · responsive card grid · `lines` controls card count
 *   - "text-paragraph"  · paragraph block · 1 title line + body lines
 *   - "avatar-circle"   · circular avatar + name+subtitle lines · stacks horizontally
 *
 * a11y · role="status" + aria-live="polite" + aria-label so screen readers
 * announce loading state once.
 */
export function Skeleton({
  kind = "lines",
  lines = 5,
  className = "",
  ariaLabel = "Loading",
}: {
  kind?:
    | "overview"
    | "page"
    | "lines"
    | "table-row"
    | "card-grid"
    | "text-paragraph"
    | "avatar-circle"
  lines?: number
  className?: string
  ariaLabel?: string
}) {
  const a11yProps = {
    role: "status" as const,
    "aria-live": "polite" as const,
    "aria-label": ariaLabel,
  }

  if (kind === "overview") {
    return (
      <div className={`space-y-6 ${className}`} {...a11yProps}>
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
        <span className="sr-only">{ariaLabel}</span>
      </div>
    )
  }

  if (kind === "page") {
    return (
      <div className={`grid gap-4 ${className}`} {...a11yProps}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skel-card h-28" />
        ))}
        <span className="sr-only">{ariaLabel}</span>
      </div>
    )
  }

  if (kind === "table-row") {
    // Renders `lines` <tr> rows · drop into existing <tbody>. The outer
    // wrapper is a Fragment-equivalent so it doesn't break table layout.
    return (
      <>
        {Array.from({ length: lines }).map((_, i) => (
          <tr
            key={i}
            className={`border-b-[0.5px] border-[hsl(var(--border)/0.4)] ${className}`}
            {...(i === 0 ? a11yProps : {})}
          >
            <td colSpan={99} className="px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="skel-line h-3 w-4" />
                <div className="skel-line h-3 flex-1" style={{ maxWidth: `${50 + ((i * 17) % 40)}%` }} />
                <div className="skel-line h-3 w-16" />
                <div className="skel-line h-3 w-12" />
              </div>
            </td>
          </tr>
        ))}
      </>
    )
  }

  if (kind === "card-grid") {
    return (
      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
        {...a11yProps}
      >
        {Array.from({ length: lines || 6 }).map((_, i) => (
          <div key={i} className="skel-card h-48">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="skel-line h-8 w-8 rounded-full" />
                <div className="skel-line h-3 flex-1" style={{ maxWidth: "60%" }} />
              </div>
              <div className="skel-line w-full" />
              <div className="skel-line" style={{ width: `${55 + ((i * 13) % 35)}%` }} />
              <div className="mt-auto flex gap-2">
                <div className="skel-line h-5 w-12 rounded" />
                <div className="skel-line h-5 w-16 rounded" />
              </div>
            </div>
          </div>
        ))}
        <span className="sr-only">{ariaLabel}</span>
      </div>
    )
  }

  if (kind === "text-paragraph") {
    return (
      <div className={`space-y-2 ${className}`} {...a11yProps}>
        <div className="skel-line w-1/3 h-4" />
        <div className="h-1" />
        {Array.from({ length: lines || 4 }).map((_, i) => (
          <div
            key={i}
            className="skel-line"
            style={{ width: `${70 + ((i * 11) % 28)}%` }}
          />
        ))}
        <span className="sr-only">{ariaLabel}</span>
      </div>
    )
  }

  if (kind === "avatar-circle") {
    return (
      <div className={`flex items-center gap-3 ${className}`} {...a11yProps}>
        <div className="skel-line h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skel-line h-3 w-2/5" />
          <div className="skel-line h-3 w-3/5" />
        </div>
        <span className="sr-only">{ariaLabel}</span>
      </div>
    )
  }

  // legacy "lines" mode · kept for any caller still passing the default
  return (
    <div className={`space-y-2 ${className}`} {...a11yProps}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skel-line"
          style={{ width: `${60 + ((i * 17) % 38)}%` }}
        />
      ))}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  )
}
